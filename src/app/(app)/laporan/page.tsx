import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isAdmin, isFinance, isApprover, isYdp } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LaporanFilter } from "./_components/laporan-filter";
import { LaporanTable } from "./_components/laporan-table";
import type { LaporanClaimItem } from "./_components/laporan-table";

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; dept?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const canView = isAdmin(session.user) || isFinance(session.user) || isApprover(session.user) || isYdp(session.user);
  if (!canView) redirect("/dashboard");

  const sp = await searchParams;
  const currentYear = new Date().getFullYear();
  const filterYear = parseInt(sp.year ?? String(currentYear));
  const filterMonth = sp.month ? parseInt(sp.month) : undefined;
  const filterStatus = sp.status || undefined;
  const filterDept = sp.dept || undefined;

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
      resubmittedFrom: { select: { refNo: true } },
    },
    orderBy: [{ forMonth: "asc" }, { submittedAt: "asc" }],
  });

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });

  const totalApproved = claims
    .filter((c) => c.status === "APPROVED" || c.status === "PAID")
    .reduce((s, c) => s + Number(c.totalApprovedMyr ?? 0), 0);

  const exportParams = new URLSearchParams({
    year: String(filterYear),
    ...(filterMonth && { month: String(filterMonth) }),
    ...(filterStatus && { status: filterStatus }),
    ...(filterDept && { dept: filterDept }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan</h1>
          <p className="text-gray-500 text-sm mt-1">{claims.length} tuntutan</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/api/laporan/pdf?${exportParams}`}>
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Link>
          </Button>
          <Button asChild className="bg-green-700 hover:bg-green-800">
            <Link href={`/api/laporan/excel?${exportParams}`}>
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Link>
          </Button>
        </div>
      </div>

      <LaporanFilter
        currentYear={currentYear}
        filterYear={filterYear}
        filterMonth={filterMonth ?? null}
        filterStatus={filterStatus ?? null}
        filterDept={filterDept ?? null}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-gray-500">Jumlah Tuntutan</p>
            <p className="text-xl font-bold mt-1">{claims.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-gray-500">Diluluskan</p>
            <p className="text-xl font-bold mt-1 text-green-700">
              {claims.filter((c) => c.status === "APPROVED" || c.status === "PAID").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-gray-500">Jumlah Lulus (RM)</p>
            <p className="text-lg font-bold mt-1 text-green-700">{totalApproved.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <LaporanTable
            claims={claims.map((claim): LaporanClaimItem => ({
              id: claim.id,
              refNo: claim.refNo,
              claimantName: claim.claimant.name,
              departmentName: claim.department?.name ?? null,
              forMonth: claim.forMonth,
              forYear: claim.forYear,
              status: claim.status,
              totalClaimedMyr: Number(claim.totalClaimedMyr),
              totalApprovedMyr: claim.totalApprovedMyr ? Number(claim.totalApprovedMyr) : null,
              resubmittedFromRefNo: claim.resubmittedFrom?.refNo ?? null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
