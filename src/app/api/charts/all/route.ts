import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma, Role } from "@/generated/prisma";
import { NextResponse } from "next/server";

export type MonthlyTrendRow = { month: number; total: number; count: number };
export type ByDeptRow = { name: string; total: number; count: number };
export type ByStatusRow = { status: string; count: number };
export type DeptUtilRow = { name: string; used: number; limit_myr: number };

export type AllChartsData = {
  monthlyTrend: MonthlyTrendRow[];
  byDepartment: ByDeptRow[];
  byStatus: ByStatusRow[];
  deptUtilization: DeptUtilRow[];
};

const MGMT_ROLES: Role[] = [Role.HEAD, Role.FINANCE, Role.APPROVER, Role.YDP, Role.ADMIN];
const SENIOR_ROLES: Role[] = [Role.FINANCE, Role.APPROVER, Role.YDP, Role.ADMIN];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  if (!roles.some((r) => MGMT_ROLES.includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const currentYear = new Date().getFullYear();
  if (isNaN(year) || year < 2020 || year > currentYear + 1) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  const deptParam = searchParams.get("dept") || null;

  // HEAD-only users are locked to their own dept; senior roles can filter freely
  const isHeadOnly = roles.includes(Role.HEAD) && !roles.some((r) => SENIOR_ROLES.includes(r));
  if (isHeadOnly && !session.user.departmentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const deptId = isHeadOnly ? (session.user.departmentId ?? null) : deptParam;

  const claimDeptClause = deptId ? Prisma.sql`AND "departmentId" = ${deptId}` : Prisma.empty;
  const userDeptClause = deptId ? Prisma.sql`AND u."departmentId" = ${deptId}` : Prisma.empty;

  try {
    const [rawMonthly, rawDept, rawStatus, rawUtil] = await Promise.all([
      // Chart D: monthly trend
      prisma.$queryRaw<Array<{ forMonth: number; total: string; count: string }>>`
        SELECT "forMonth", SUM("totalClaimedMyr") AS total, COUNT(*) AS count
        FROM "Claim"
        WHERE "forYear" = ${year}
        ${claimDeptClause}
        GROUP BY "forMonth"
        ORDER BY "forMonth"
      `,
      // Chart C: inner JOIN intentionally excludes claims with null departmentId
      prisma.$queryRaw<Array<{ name: string; total: string; count: string }>>`
        SELECT d.name, SUM(c."totalClaimedMyr") AS total, COUNT(*) AS count
        FROM "Claim" c
        JOIN "Department" d ON c."departmentId" = d.id
        WHERE c."forYear" = ${year}
        ${claimDeptClause}
        GROUP BY d.id, d.name
        ORDER BY total DESC
      `,
      // Chart F: by status
      prisma.$queryRaw<Array<{ status: string; count: string }>>`
        SELECT status, COUNT(*) AS count
        FROM "Claim"
        WHERE "forYear" = ${year}
        ${claimDeptClause}
        GROUP BY status
      `,
      // Chart E: dept budget utilization
      prisma.$queryRaw<Array<{ name: string; used: string; limit_myr: string }>>`
        SELECT d.name,
          SUM(a."usedMyr") AS used,
          SUM(a."limitMyr") AS limit_myr
        FROM "AnnualAllocation" a
        JOIN "User" u ON a."userId" = u.id
        JOIN "Department" d ON u."departmentId" = d.id
        WHERE a.year = ${year}
        ${userDeptClause}
        GROUP BY d.id, d.name
        ORDER BY used DESC
      `,
    ]);

    const monthlyTrend: MonthlyTrendRow[] = Array.from({ length: 12 }, (_, i) => {
      const row = rawMonthly.find((r) => Number(r.forMonth) === i + 1);
      return { month: i + 1, total: row ? Number(row.total) : 0, count: row ? Number(row.count) : 0 };
    });

    const data: AllChartsData = {
      monthlyTrend,
      byDepartment: rawDept.map((r) => ({ name: r.name, total: Number(r.total), count: Number(r.count) })),
      byStatus: rawStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
      deptUtilization: rawUtil.map((r) => ({ name: r.name, used: Number(r.used), limit_myr: Number(r.limit_myr) })),
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error("Charts query failed:", err);
    return NextResponse.json({ error: "Failed to fetch chart data" }, { status: 500 });
  }
}
