import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isAdmin, isFinance, isApprover, isYdp } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { FileSpreadsheet, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LaporanFilter } from "./_components/laporan-filter";

const MONTHS_BM = ["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ogos","Sep","Okt","Nov","Dis"];
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draf", SUBMITTED: "Menunggu Sokongan", HEAD_APPROVED: "Menunggu Kewangan",
  FINANCE_REVIEWED: "Menunggu Kelulusan", APPROVED: "Diluluskan", REJECTED: "Ditolak", PAID: "Dibayar",
};

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
        <Button asChild className="bg-green-700 hover:bg-green-800">
          <Link href={`/api/laporan/excel?${exportParams}`}>
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Link>
        </Button>
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
      <div className="grid grid-cols-3 gap-3">
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

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="p-3 text-left">Ref No</th>
                <th className="p-3 text-left">Kakitangan</th>
                <th className="p-3 text-left">Jabatan</th>
                <th className="p-3 text-center">Bulan</th>
                <th className="p-3 text-right">Tuntut</th>
                <th className="p-3 text-right">Lulus</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {claims.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Tiada tuntutan untuk penapisan ini.</p>
                  </td>
                </tr>
              ) : (
                claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <Link href={`/tuntutan/${claim.id}`} className="text-green-700 hover:underline font-medium">
                        {claim.refNo}
                      </Link>
                    </td>
                    <td className="p-3 text-gray-700">{claim.claimant.name}</td>
                    <td className="p-3 text-gray-500">{claim.department?.name ?? "—"}</td>
                    <td className="p-3 text-center text-gray-500">
                      {MONTHS_BM[claim.forMonth - 1]} {claim.forYear}
                    </td>
                    <td className="p-3 text-right">RM {Number(claim.totalClaimedMyr).toFixed(2)}</td>
                    <td className="p-3 text-right text-green-700">
                      {claim.totalApprovedMyr ? `RM ${Number(claim.totalApprovedMyr).toFixed(2)}` : "—"}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        claim.status === "APPROVED" || claim.status === "PAID"
                          ? "bg-green-100 text-green-700"
                          : claim.status === "REJECTED"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {STATUS_LABELS[claim.status] ?? claim.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
