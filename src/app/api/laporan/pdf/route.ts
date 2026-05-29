import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin, isFinance, isApprover, isYdp } from "@/lib/permissions";
import { generateLaporanPdf } from "@/lib/pdf/laporan";

export async function GET(req: NextRequest) {
  try {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const canExport = isAdmin(session.user) || isFinance(session.user) || isApprover(session.user) || isYdp(session.user);
  if (!canExport) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const filterYear = parseInt(sp.get("year") ?? String(new Date().getFullYear()));
  const filterMonth = sp.get("month") ? parseInt(sp.get("month")!) : undefined;
  const filterStatus = sp.get("status") || undefined;
  const filterDept = sp.get("dept") || undefined;

  const claims = await prisma.claim.findMany({
    where: {
      forYear: filterYear,
      ...(filterMonth && { forMonth: filterMonth }),
      ...(filterStatus && { status: filterStatus as never }),
      ...(filterDept && { departmentId: filterDept }),
    },
    include: {
      claimant: true,
      department: true,
      receipts: { select: { claimFor: true, claimForChildNo: true } },
    },
    orderBy: [{ forMonth: "asc" }, { submittedAt: "asc" }],
  });

  const orgSetting = await prisma.settings.findUnique({ where: { key: "org_name" } });
  const orgName = String(orgSetting?.value ?? "Majlis Daerah Setiu");

  const months = ["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ogos","Sep","Okt","Nov","Dis"];
  const label = filterMonth
    ? `${months[filterMonth - 1]} ${filterYear}`
    : `Tahun ${filterYear}`;

  function beneficiarySummary(receipts: Array<{ claimFor: string; claimForChildNo: number | null }>): string {
    const labels = new Set(receipts.map((r) => {
      if (r.claimFor === "SPOUSE") return "Pasangan";
      if (r.claimFor === "CHILD") return `Anak ke-${r.claimForChildNo ?? 1}`;
      return "Diri";
    }));
    return [...labels].join(", ") || "Diri";
  }

  const buffer = await generateLaporanPdf(
    claims.map((c) => ({
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
    })),
    label,
    orgName
  );

  const filename = `laporan-tuntutan-${filterYear}${filterMonth ? `-${String(filterMonth).padStart(2, "0")}` : ""}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
  } catch (err) {
    console.error("laporan/pdf error:", err);
    return NextResponse.json({ error: "Ralat menjana laporan." }, { status: 500 });
  }
}
