import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewClaim } from "@/lib/permissions";
import { generateCoverSheet } from "@/lib/pdf/cover-sheet";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await params;

  const claim = await prisma.claim.findUnique({
    where: { id },
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
  });

  if (!claim) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (!canViewClaim(session.user, { claimantId: claim.claimantId, departmentId: claim.departmentId })) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const orgSetting = await prisma.settings.findUnique({ where: { key: "org_name" } });
  const orgName = String(orgSetting?.value ?? "Majlis Daerah Setiu");

  const buffer = await generateCoverSheet({
    orgName,
    refNo: claim.refNo,
    claimantName: claim.claimant.name,
    staffNo: claim.claimant.staffNo,
    departmentName: claim.department?.name ?? null,
    forMonth: claim.forMonth,
    forYear: claim.forYear,
    claimFor: claim.claimFor,
    claimForChildNo: claim.claimForChildNo,
    status: claim.status,
    submittedAt: claim.submittedAt,
    totalClaimedMyr: Number(claim.totalClaimedMyr),
    totalEligibleMyr: claim.totalEligibleMyr ? Number(claim.totalEligibleMyr) : null,
    totalApprovedMyr: claim.totalApprovedMyr ? Number(claim.totalApprovedMyr) : null,
    receipts: claim.receipts.map((r) => ({
      vendor: r.vendor,
      receiptDate: r.receiptDate,
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
  });

  const filename = `tuntutan-${claim.refNo.replace(/\//g, "-")}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
