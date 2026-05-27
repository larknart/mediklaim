import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin, isFinance } from "@/lib/permissions";
import { generateBulkCoverSheets } from "@/lib/pdf/cover-sheet";
import type { CoverSheetData } from "@/lib/pdf/cover-sheet";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!isFinance(session.user) && !isAdmin(session.user)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
  if (ids.length === 0) return NextResponse.json({ error: "ids array required" }, { status: 400 });
  if (ids.length > 200) return NextResponse.json({ error: "Terlalu banyak tuntutan (maks 200)" }, { status: 400 });

  const [claims, orgSetting] = await Promise.all([
    prisma.claim.findMany({
      where: { id: { in: ids } },
      include: {
        claimant: true,
        department: true,
        receipts: {
          include: { items: true },
          orderBy: { receiptDate: "asc" },
        },
        approvals: {
          include: { actor: { select: { name: true } } },
          orderBy: { decidedAt: "asc" },
        },
      },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.settings.findUnique({ where: { key: "org_name" } }),
  ]);

  const orgName = String(orgSetting?.value ?? "Majlis Daerah Setiu");

  const coverSheets: CoverSheetData[] = claims.map((claim) => ({
    orgName,
    refNo: claim.refNo,
    claimantName: claim.claimant.name,
    staffNo: claim.claimant.staffNo,
    departmentName: claim.department?.name ?? null,
    forMonth: claim.forMonth,
    forYear: claim.forYear,
    status: claim.status,
    submittedAt: claim.submittedAt,
    totalClaimedMyr: Number(claim.totalClaimedMyr),
    totalEligibleMyr: claim.totalEligibleMyr ? Number(claim.totalEligibleMyr) : null,
    totalApprovedMyr: claim.totalApprovedMyr ? Number(claim.totalApprovedMyr) : null,
    receipts: claim.receipts.map((r) => ({
      vendor: r.vendor,
      receiptDate: r.receiptDate,
      claimFor: r.claimFor,
      claimForChildNo: r.claimForChildNo,
      items: r.items.map((i) => ({
        description: i.description,
        qty: i.qty,
        unitMyr: Number(i.unitMyr),
        amountMyr: Number(i.amountMyr),
        isEligible: i.isEligible,
        flaggedReason: i.flaggedReason,
      })),
    })),
    approvals: claim.approvals.map((a) => ({
      step: a.step,
      actorName: a.actor.name,
      decision: a.decision,
      comment: a.comment,
      decidedAt: a.decidedAt,
    })),
  }));

  const date = new Date().toISOString().slice(0, 10);
  const buffer = await generateBulkCoverSheets(coverSheets);
  const filename = `eksport-coversheet-${date}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
