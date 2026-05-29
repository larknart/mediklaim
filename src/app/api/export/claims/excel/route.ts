import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin, isFinance } from "@/lib/permissions";
import { generateLaporan } from "@/lib/excel/laporan";
import type { ClaimRow } from "@/lib/excel/laporan";
import { allow } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!allow(`export:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!isFinance(session.user) && !isAdmin(session.user)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids)
    ? (body.ids as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  if (ids.length === 0) return NextResponse.json({ error: "ids array required" }, { status: 400 });
  if (ids.length > 200) return NextResponse.json({ error: "Terlalu banyak tuntutan (maks 200)" }, { status: 400 });

  const claims = await prisma.claim.findMany({
    where: { id: { in: ids } },
    include: {
      claimant: true,
      department: true,
      receipts: { select: { claimFor: true, claimForChildNo: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  const orgSetting = await prisma.settings.findUnique({ where: { key: "org_name" } });
  const orgName = String(orgSetting?.value ?? "Majlis Daerah Setiu");

  function beneficiarySummary(receipts: Array<{ claimFor: string; claimForChildNo: number | null }>): string {
    const labels = new Set(receipts.map((r) => {
      if (r.claimFor === "SPOUSE") return "Pasangan";
      if (r.claimFor === "CHILD") return `Anak ke-${r.claimForChildNo ?? 1}`;
      return "Diri";
    }));
    return [...labels].join(", ") || "Diri";
  }

  const rows: ClaimRow[] = claims.map((c) => ({
    refNo: c.refNo,
    claimantName: c.claimant.name,
    staffNo: c.claimant.staffNo,
    department: c.department?.name ?? null,
    forMonth: c.forMonth,
    forYear: c.forYear,
    claimFor: beneficiarySummary(c.receipts),
    claimForChildNo: null,
    status: c.status,
    totalClaimedMyr: Number(c.totalClaimedMyr),
    totalEligibleMyr: c.totalEligibleMyr ? Number(c.totalEligibleMyr) : null,
    totalApprovedMyr: c.totalApprovedMyr ? Number(c.totalApprovedMyr) : null,
    submittedAt: c.submittedAt,
    paidAt: c.paidAt,
    voucherNo: c.voucherNo,
  }));

  const date = new Date().toISOString().slice(0, 10);
  const buffer = await generateLaporan(rows, `Pilihan (${rows.length} tuntutan)`, orgName);
  const filename = `eksport-excel-${date}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
  } catch (err) {
    console.error("export/excel error:", err);
    return NextResponse.json({ error: "Ralat menjana eksport." }, { status: 500 });
  }
}
