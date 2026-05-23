import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ClaimStatus, Role, ReceiptStatus } from "@/generated/prisma";
import { ChartSpendingTrend } from "./_components/chart-spending-trend";
import { ChartClaimStatus } from "./_components/chart-claim-status";
import { ChartMiniMonthly } from "./_components/chart-mini-monthly";
import { ChartMiniSystemStatus } from "./_components/chart-mini-system-status";
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, Plus } from "lucide-react";

const STATUS_LABELS: Record<ClaimStatus, { label: string; color: string }> = {
  DRAFT:            { label: "Draf",              color: "secondary" },
  SUBMITTED:        { label: "Dihantar",          color: "default" },
  HEAD_APPROVED:    { label: "Sokong KJ",         color: "outline" },
  FINANCE_REVIEWED: { label: "Semakan Kewangan",  color: "outline" },
  APPROVED:         { label: "Diluluskan",        color: "default" },
  REJECTED:         { label: "Ditolak",           color: "destructive" },
  PAID:             { label: "Dibayar",           color: "default" },
  WITHDRAWN:        { label: "Tarik Balik",       color: "secondary" },
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const currentYear = new Date().getFullYear();

  // Annual allocation for current user
  const allocation = await prisma.annualAllocation.findUnique({
    where: { userId_year: { userId, year: currentYear } },
  });

  const limit = Number(allocation?.limitMyr ?? 1200);
  const used = Number(allocation?.usedMyr ?? 0);
  const remaining = limit - used;
  const usedPercent = Math.min((used / limit) * 100, 100);

  // Unsorted receipts count
  const unsortedCount = await prisma.receipt.count({
    where: { ownerId: userId, status: ReceiptStatus.UNSORTED },
  });

  // My recent claims
  const myClaims = await prisma.claim.findMany({
    where: { claimantId: userId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Chart A — personal monthly spending (12 months, zero-filled)
  const rawMonthly = await prisma.$queryRaw<Array<{ forMonth: number; total: string }>>`
    SELECT "forMonth", SUM("totalClaimedMyr") AS total
    FROM "Claim"
    WHERE "claimantId" = ${userId} AND "forYear" = ${currentYear}
    GROUP BY "forMonth"
    ORDER BY "forMonth"
  `;
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const row = rawMonthly.find((r) => Number(r.forMonth) === i + 1);
    return { month: i + 1, total: row ? Number(row.total) : 0 };
  });

  // Chart B — personal status breakdown (all-time, not year-filtered)
  const rawStatus = await prisma.$queryRaw<Array<{ status: string; count: string }>>`
    SELECT status, COUNT(*) AS count
    FROM "Claim"
    WHERE "claimantId" = ${userId}
    GROUP BY status
  `;
  const statusData = rawStatus.map((r) => ({ status: r.status, count: Number(r.count) }));

  // Management mini-charts — HEAD/FINANCE/APPROVER/ADMIN only
  const mgmtRoles: Role[] = [Role.HEAD, Role.FINANCE, Role.APPROVER, Role.YDP, Role.ADMIN];
  const nonHeadMgmtRoles: Role[] = [Role.FINANCE, Role.APPROVER, Role.YDP, Role.ADMIN];
  const isMgmt = roles.some((r) => mgmtRoles.includes(r));
  const isHeadOnly =
    roles.includes(Role.HEAD) &&
    !roles.some((r) => nonHeadMgmtRoles.includes(r));
  const mgmtDeptId = isHeadOnly ? (session.user.departmentId ?? null) : null;

  let miniMonthlyData: { month: number; total: number; count: number }[] = [];
  let miniStatusData: { status: string; count: number }[] = [];

  if (isMgmt && !(isHeadOnly && !session.user.departmentId)) {
    let rawMiniMonthly: Array<{ forMonth: number; total: string; count: string }>;
    let rawMiniStatus: Array<{ status: string; count: string }>;

    if (mgmtDeptId) {
      [rawMiniMonthly, rawMiniStatus] = await Promise.all([
        prisma.$queryRaw<Array<{ forMonth: number; total: string; count: string }>>`
          SELECT "forMonth", SUM("totalClaimedMyr") AS total, COUNT(*) AS count
          FROM "Claim"
          WHERE "forYear" = ${currentYear} AND "departmentId" = ${mgmtDeptId}
          GROUP BY "forMonth"
          ORDER BY "forMonth"
        `,
        prisma.$queryRaw<Array<{ status: string; count: string }>>`
          SELECT status, COUNT(*) AS count
          FROM "Claim"
          WHERE "forYear" = ${currentYear} AND "departmentId" = ${mgmtDeptId}
          GROUP BY status
        `,
      ]);
    } else {
      [rawMiniMonthly, rawMiniStatus] = await Promise.all([
        prisma.$queryRaw<Array<{ forMonth: number; total: string; count: string }>>`
          SELECT "forMonth", SUM("totalClaimedMyr") AS total, COUNT(*) AS count
          FROM "Claim"
          WHERE "forYear" = ${currentYear}
          GROUP BY "forMonth"
          ORDER BY "forMonth"
        `,
        prisma.$queryRaw<Array<{ status: string; count: string }>>`
          SELECT status, COUNT(*) AS count
          FROM "Claim"
          WHERE "forYear" = ${currentYear}
          GROUP BY status
        `,
      ]);
    }

    miniMonthlyData = Array.from({ length: 12 }, (_, i) => {
      const row = rawMiniMonthly.find((r) => Number(r.forMonth) === i + 1);
      return { month: i + 1, total: row ? Number(row.total) : 0, count: row ? Number(row.count) : 0 };
    });

    miniStatusData = rawMiniStatus.map((r) => ({ status: r.status, count: Number(r.count) }));
  }

  // Pending actions count (role-aware)
  let pendingHead = 0;
  let pendingFinance = 0;
  let pendingApprover = 0;

  if (roles.includes(Role.HEAD)) {
    pendingHead = await prisma.claim.count({
      where: {
        status: ClaimStatus.SUBMITTED,
        departmentId: session.user.departmentId ?? undefined,
        claimantId: { not: userId },
      },
    });
  }

  if (roles.includes(Role.FINANCE)) {
    pendingFinance = await prisma.claim.count({
      where: { status: ClaimStatus.HEAD_APPROVED },
    });
  }

  if (roles.includes(Role.APPROVER) || roles.includes(Role.YDP)) {
    pendingApprover = await prisma.claim.count({
      where: { status: ClaimStatus.FINANCE_REVIEWED },
    });
  }

  const pendingTotal = pendingHead + pendingFinance + pendingApprover;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Papan Pemuka</h1>
        <p className="text-gray-500 text-sm mt-1">Selamat datang, {session.user.name}</p>
      </div>

      {/* Allocation card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Baki Peruntukan Perubatan {currentYear}</CardTitle>
            <CardDescription>Had tahunan: RM {limit.toFixed(2)} | Guna pakai: RM {used.toFixed(2)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between mb-2">
              <div>
                <span className="text-3xl font-bold text-green-700">RM {remaining.toFixed(2)}</span>
                <span className="text-gray-500 text-sm ml-2">baki</span>
              </div>
              <span className={`text-sm font-medium ${usedPercent >= 90 ? "text-red-600" : usedPercent >= 70 ? "text-amber-600" : "text-green-600"}`}>
                {usedPercent.toFixed(0)}% diguna
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${usedPercent >= 90 ? "bg-red-500" : usedPercent >= 70 ? "bg-amber-500" : "bg-green-500"}`}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            {remaining < 200 && remaining > 0 && (
              <p className="text-amber-600 text-xs mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Baki hampir habis. Peruntukan tidak boleh dibawa ke tahun hadapan.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tindakan Perlu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingTotal === 0 ? (
              <p className="text-gray-500 text-sm">Tiada tindakan tertangguh.</p>
            ) : (
              <>
                {pendingHead > 0 && (
                  <Link href="/sokongan" className="flex items-center justify-between p-2 bg-blue-50 rounded-lg hover:bg-blue-100">
                    <span className="text-sm text-blue-800">Sokongan KJ</span>
                    <Badge variant="default">{pendingHead}</Badge>
                  </Link>
                )}
                {pendingFinance > 0 && (
                  <Link href="/semakan" className="flex items-center justify-between p-2 bg-amber-50 rounded-lg hover:bg-amber-100">
                    <span className="text-sm text-amber-800">Semakan Kewangan</span>
                    <Badge variant="default">{pendingFinance}</Badge>
                  </Link>
                )}
                {pendingApprover > 0 && (
                  <Link href="/kelulusan" className="flex items-center justify-between p-2 bg-green-50 rounded-lg hover:bg-green-100">
                    <span className="text-sm text-green-800">Kelulusan</span>
                    <Badge variant="default">{pendingApprover}</Badge>
                  </Link>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 flex-wrap">
        <Button asChild className="bg-green-700 hover:bg-green-800">
          <Link href="/resit">
            <Plus className="w-4 h-4 mr-2" />
            Upload Resit
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/tuntutan/baru">
            <FileText className="w-4 h-4 mr-2" />
            Buat Tuntutan
          </Link>
        </Button>
      </div>

      {/* Personal Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartSpendingTrend data={monthlyData} year={currentYear} />
        <ChartClaimStatus data={statusData} />
      </div>

      {/* Management mini-charts */}
      {isMgmt && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Gambaran Sistem {currentYear}
            </h2>
            <Link href="/analitik" className="text-xs text-green-700 hover:underline">
              Lihat analitik penuh →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartMiniMonthly data={miniMonthlyData} year={currentYear} />
            <ChartMiniSystemStatus data={miniStatusData} year={currentYear} />
          </div>
        </div>
      )}

      {/* Inbox resit belum dituntut */}
      {unsortedCount > 0 && (
        <Link href="/resit" className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800">
              <span className="font-semibold">{unsortedCount} resit</span> dalam inbox belum dibuat tuntutan
            </span>
          </div>
          <span className="text-xs text-amber-600 font-medium">Semak →</span>
        </Link>
      )}

      {/* Recent claims */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tuntutan Terkini</CardTitle>
        </CardHeader>
        <CardContent>
          {myClaims.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">Tiada tuntutan lagi.</p>
          ) : (
            <div className="space-y-2">
              {myClaims.map((claim) => {
                const statusInfo = STATUS_LABELS[claim.status];
                return (
                  <Link
                    key={claim.id}
                    href={`/tuntutan/${claim.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium">{claim.refNo}</p>
                        <p className="text-xs text-gray-500">
                          Bulan {claim.forMonth}/{claim.forYear} · RM {Number(claim.totalClaimedMyr).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={statusInfo.color as "default" | "secondary" | "destructive" | "outline"}>
                      {statusInfo.label}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
          {myClaims.length > 0 && (
            <div className="mt-3 text-center">
              <Link href="/tuntutan" className="text-sm text-green-700 hover:underline">
                Lihat semua tuntutan →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
