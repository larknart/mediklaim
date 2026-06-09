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
import { ChartDeptBreakdown } from "./_components/chart-dept-breakdown";
import { FileText, AlertCircle, Plus, Timer } from "lucide-react";
import { computeSla } from "@/lib/sla";
import { CLAIM_STATUS_CONFIG } from "@/lib/claim-status";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";

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
  let deptBreakdownData: { deptName: string | null; claimCount: number; totalClaimed: number }[] = [];

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

    // Per-dept breakdown (global view only — not HEAD-scoped)
    if (!mgmtDeptId) {
      const rawDept = await prisma.$queryRaw<Array<{ deptName: string | null; claimCount: string; totalClaimed: string }>>`
        SELECT d.name AS "deptName", COUNT(*)::text AS "claimCount", COALESCE(SUM(c."totalClaimedMyr"),0)::text AS "totalClaimed"
        FROM "Claim" c
        LEFT JOIN "Department" d ON d.id = c."departmentId"
        WHERE c."forYear" = ${currentYear}
        GROUP BY d.id, d.name
        ORDER BY COUNT(*) DESC
        LIMIT 15
      `;
      deptBreakdownData = rawDept.map((r) => ({
        deptName: r.deptName,
        claimCount: Number(r.claimCount),
        totalClaimed: Number(r.totalClaimed),
      }));
    }
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

  // SLA overdue counts — only computed for relevant roles
  let overdueHead = 0;
  let overdueFinance = 0;
  let overdueApprover = 0;

  const hasMgmtRole = roles.includes(Role.HEAD) || roles.includes(Role.FINANCE) || roles.includes(Role.APPROVER) || roles.includes(Role.YDP) || roles.includes(Role.ADMIN);
  if (hasMgmtRole) {
    const [slaSettings, holidays] = await Promise.all([
      prisma.settings.findMany({ where: { key: { in: ["sla_head_days", "sla_finance_days", "sla_approver_days"] } } }),
      prisma.publicHoliday.findMany({ where: { year: { in: [currentYear, currentYear - 1] } }, select: { date: true } }),
    ]);
    const slaMap = Object.fromEntries(slaSettings.map((s) => [s.key, Number(s.value)]));
    const slaHeadDays = slaMap["sla_head_days"] ?? 3;
    const slaFinanceDays = slaMap["sla_finance_days"] ?? 5;
    const slaApproverDays = slaMap["sla_approver_days"] ?? 3;
    const holidaySet = new Set(holidays.map((h) => h.date.toISOString().split("T")[0]));

    if (roles.includes(Role.HEAD)) {
      const submitted = await prisma.claim.findMany({
        where: { status: ClaimStatus.SUBMITTED, departmentId: session.user.departmentId ?? undefined, submittedAt: { not: null }, claimantId: { not: userId } },
        select: { submittedAt: true },
      });
      overdueHead = submitted.filter((c) => c.submittedAt && computeSla(c.submittedAt, slaHeadDays, holidaySet).status === "OVERDUE").length;
    }
    if (roles.includes(Role.FINANCE)) {
      const haApprovals = await prisma.approval.findMany({
        where: { step: "HEAD", claim: { status: ClaimStatus.HEAD_APPROVED } },
        select: { decidedAt: true },
      });
      overdueFinance = haApprovals.filter((a) => computeSla(a.decidedAt, slaFinanceDays, holidaySet).status === "OVERDUE").length;
    }
    if (roles.includes(Role.APPROVER) || roles.includes(Role.YDP)) {
      const frApprovals = await prisma.approval.findMany({
        where: { step: "FINANCE", claim: { status: ClaimStatus.FINANCE_REVIEWED } },
        select: { decidedAt: true },
      });
      overdueApprover = frApprovals.filter((a) => computeSla(a.decidedAt, slaApproverDays, holidaySet).status === "OVERDUE").length;
    }
  }

  const overdueTotal = overdueHead + overdueFinance + overdueApprover;

  return (
    <div className="space-y-6">
      <PageHeader title="Papan Pemuka" subtitle={`Selamat datang, ${session.user.name}`} />

      {/* SLA overdue alert banner — role-aware */}
      {overdueTotal > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-red-200 bg-red-50">
          <Timer className="w-4 h-4 text-red-600 shrink-0" />
          <div className="flex-1 text-sm text-red-800">
            <span className="font-semibold">{overdueTotal} tuntutan</span> telah melebihi SLA.
            {overdueHead > 0 && <span> Sokongan: {overdueHead}.</span>}
            {overdueFinance > 0 && <span> Kewangan: {overdueFinance}.</span>}
            {overdueApprover > 0 && <span> Kelulusan: {overdueApprover}.</span>}
          </div>
        </div>
      )}

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
                <span className="text-3xl font-bold text-primary">RM {remaining.toFixed(2)}</span>
                <span className="text-muted-foreground text-sm ml-2">baki</span>
              </div>
              <span className={`text-sm font-medium ${usedPercent >= 90 ? "text-destructive" : usedPercent >= 70 ? "text-warning" : "text-success"}`}>
                {usedPercent.toFixed(0)}% diguna
              </span>
            </div>
            <Progress
              value={usedPercent}
              className="h-3"
              indicatorClassName={
                usedPercent >= 90
                  ? "bg-destructive"
                  : usedPercent >= 70
                  ? "bg-warning"
                  : "bg-success"
              }
            />
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
              <p className="text-muted-foreground text-sm">Tiada tindakan tertangguh.</p>
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
                  <Link href="/kelulusan" className="flex items-center justify-between p-2 bg-success/5 rounded-lg hover:bg-primary/10">
                    <span className="text-sm text-primary">Kelulusan</span>
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
        <Button asChild>
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
            <h2 className="text-sm font-semibold text-muted-foreground">
              Gambaran Sistem {currentYear}
            </h2>
            <Link href="/analitik" className="text-xs text-primary hover:underline">
              Lihat analitik penuh →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartMiniMonthly data={miniMonthlyData} year={currentYear} />
            <ChartMiniSystemStatus data={miniStatusData} year={currentYear} />
          </div>
          {deptBreakdownData.length > 0 && (
            <ChartDeptBreakdown data={deptBreakdownData} year={currentYear} />
          )}
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
            <p className="text-muted-foreground text-sm text-center py-6">Tiada tuntutan lagi.</p>
          ) : (
            <div className="space-y-2">
              {myClaims.map((claim) => {
                const statusInfo = CLAIM_STATUS_CONFIG[claim.status];
                return (
                  <Link
                    key={claim.id}
                    href={`/tuntutan/${claim.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{claim.refNo}</p>
                        <p className="text-xs text-muted-foreground">
                          Bulan {claim.forMonth}/{claim.forYear} · RM {Number(claim.totalClaimedMyr).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={statusInfo.variant}>
                      {statusInfo.label}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
          {myClaims.length > 0 && (
            <div className="mt-3 text-center">
              <Link href="/tuntutan" className="text-sm text-primary hover:underline">
                Lihat semua tuntutan →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
