import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma";
import { AnalitikFilters } from "./_components/analitik-filters";
import type { AllChartsData, MonthlyTrendRow } from "@/app/api/charts/all/route";

const MGMT_ROLES: Role[] = [Role.HEAD, Role.FINANCE, Role.APPROVER, Role.YDP, Role.ADMIN];
const SENIOR_ROLES: Role[] = [Role.FINANCE, Role.APPROVER, Role.YDP, Role.ADMIN];

export default async function AnalitikPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = session.user.roles ?? [];
  if (!roles.some((r) => MGMT_ROLES.includes(r))) redirect("/dashboard");

  const currentYear = new Date().getFullYear();
  const isHeadOnly = roles.includes(Role.HEAD) && !roles.some((r) => SENIOR_ROLES.includes(r));
  if (isHeadOnly && !session.user.departmentId) redirect("/dashboard");
  const deptId = isHeadOnly ? (session.user.departmentId ?? null) : null;

  let rawMonthly: Array<{ forMonth: number; total: string; count: string }>;
  let rawDept: Array<{ name: string; total: string; count: string }>;
  let rawStatus: Array<{ status: string; count: string }>;
  let rawUtil: Array<{ name: string; used: string; limit_myr: string }>;

  const [departments, ...chartRows] = await Promise.all([
    prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    ...(deptId
      ? [
          prisma.$queryRaw<Array<{ forMonth: number; total: string; count: string }>>`
            SELECT "forMonth", SUM("totalClaimedMyr") AS total, COUNT(*) AS count
            FROM "Claim"
            WHERE "forYear" = ${currentYear} AND "departmentId" = ${deptId}
            GROUP BY "forMonth"
            ORDER BY "forMonth"
          `,
          // Chart C: inner JOIN intentionally excludes claims with null departmentId
          prisma.$queryRaw<Array<{ name: string; total: string; count: string }>>`
            SELECT d.name, SUM(c."totalClaimedMyr") AS total, COUNT(*) AS count
            FROM "Claim" c
            JOIN "Department" d ON c."departmentId" = d.id
            WHERE c."forYear" = ${currentYear} AND c."departmentId" = ${deptId}
            GROUP BY d.id, d.name
            ORDER BY total DESC
          `,
          prisma.$queryRaw<Array<{ status: string; count: string }>>`
            SELECT status, COUNT(*) AS count
            FROM "Claim"
            WHERE "forYear" = ${currentYear} AND "departmentId" = ${deptId}
            GROUP BY status
          `,
          prisma.$queryRaw<Array<{ name: string; used: string; limit_myr: string }>>`
            SELECT d.name,
              SUM(a."usedMyr") AS used,
              SUM(a."limitMyr") AS limit_myr
            FROM "AnnualAllocation" a
            JOIN "User" u ON a."userId" = u.id
            JOIN "Department" d ON u."departmentId" = d.id
            WHERE a.year = ${currentYear} AND u."departmentId" = ${deptId}
            GROUP BY d.id, d.name
            ORDER BY used DESC
          `,
        ]
      : [
          prisma.$queryRaw<Array<{ forMonth: number; total: string; count: string }>>`
            SELECT "forMonth", SUM("totalClaimedMyr") AS total, COUNT(*) AS count
            FROM "Claim"
            WHERE "forYear" = ${currentYear}
            GROUP BY "forMonth"
            ORDER BY "forMonth"
          `,
          // Chart C: inner JOIN intentionally excludes claims with null departmentId
          prisma.$queryRaw<Array<{ name: string; total: string; count: string }>>`
            SELECT d.name, SUM(c."totalClaimedMyr") AS total, COUNT(*) AS count
            FROM "Claim" c
            JOIN "Department" d ON c."departmentId" = d.id
            WHERE c."forYear" = ${currentYear}
            GROUP BY d.id, d.name
            ORDER BY total DESC
          `,
          prisma.$queryRaw<Array<{ status: string; count: string }>>`
            SELECT status, COUNT(*) AS count
            FROM "Claim"
            WHERE "forYear" = ${currentYear}
            GROUP BY status
          `,
          prisma.$queryRaw<Array<{ name: string; used: string; limit_myr: string }>>`
            SELECT d.name,
              SUM(a."usedMyr") AS used,
              SUM(a."limitMyr") AS limit_myr
            FROM "AnnualAllocation" a
            JOIN "User" u ON a."userId" = u.id
            JOIN "Department" d ON u."departmentId" = d.id
            WHERE a.year = ${currentYear}
            GROUP BY d.id, d.name
            ORDER BY used DESC
          `,
        ]),
  ]);

  [rawMonthly, rawDept, rawStatus, rawUtil] = chartRows as [
    typeof rawMonthly,
    typeof rawDept,
    typeof rawStatus,
    typeof rawUtil,
  ];

  const monthlyTrend: MonthlyTrendRow[] = Array.from({ length: 12 }, (_, i) => {
    const row = rawMonthly.find((r) => Number(r.forMonth) === i + 1);
    return { month: i + 1, total: row ? Number(row.total) : 0, count: row ? Number(row.count) : 0 };
  });

  const initialData: AllChartsData = {
    monthlyTrend,
    byDepartment: rawDept.map((r) => ({ name: r.name, total: Number(r.total), count: Number(r.count) })),
    byStatus: rawStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
    deptUtilization: rawUtil.map((r) => ({ name: r.name, used: Number(r.used), limit_myr: Number(r.limit_myr) })),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analitik Tuntutan</h1>
        <p className="text-gray-500 text-sm mt-1">
          Data dikemaskini setiap 60 saat secara automatik
        </p>
      </div>

      <AnalitikFilters
        initialData={initialData}
        initialYear={currentYear}
        departments={departments}
        userRoles={roles}
        userDeptId={session.user.departmentId ?? null}
      />
    </div>
  );
}
