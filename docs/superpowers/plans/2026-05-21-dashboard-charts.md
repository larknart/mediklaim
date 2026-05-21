# Dashboard Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add personal charts to the dashboard for all users (monthly spending trend bar + claim status donut) and a management analytics page at `/analitik` with department-level charts and 60s auto-poll.

**Architecture:** Hybrid server+client. Dashboard mini-charts are server-rendered (data fetched in `dashboard/page.tsx`, passed as serialized arrays to client chart components). `/analitik` is a server shell wrapping a single client component (`AnalitikFilters`) that owns filter state, fetches from `/api/charts/all`, and auto-polls every 60s with tab-visibility pause and `useEffect` cleanup on unmount.

**Tech Stack:** Next.js 16 App Router, shadcn/ui Chart (Recharts), Prisma 7 `$queryRaw` with `Prisma.sql`/`Prisma.empty` for conditional SQL fragments, TypeScript. No test framework installed — TypeScript compile check + browser verification used instead.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/ui/chart.tsx` | Create (via CLI) | shadcn chart component |
| `src/components/app-sidebar.tsx` | Modify | Add `/analitik` nav entry |
| `src/app/api/charts/all/route.ts` | Create | Combined chart data endpoint + exported types |
| `src/app/(app)/dashboard/_components/chart-spending-trend.tsx` | Create | Chart A: personal monthly bar |
| `src/app/(app)/dashboard/_components/chart-claim-status.tsx` | Create | Chart B: personal status donut |
| `src/app/(app)/dashboard/_components/chart-mini-monthly.tsx` | Create | Chart D mini: system monthly bar |
| `src/app/(app)/dashboard/_components/chart-mini-system-status.tsx` | Create | Chart F mini: system status donut |
| `src/app/(app)/dashboard/page.tsx` | Modify | Add chart queries + render chart components |
| `src/app/(app)/analitik/page.tsx` | Create | Server shell: role guard + initial data fetch |
| `src/app/(app)/analitik/_components/analitik-filters.tsx` | Create | Client: filter state + poll loop + chart layout |
| `src/app/(app)/analitik/_components/chart-dept-claims.tsx` | Create | Chart C: dept claims vertical bar |
| `src/app/(app)/analitik/_components/chart-monthly-trend.tsx` | Create | Chart D full: system monthly line |
| `src/app/(app)/analitik/_components/chart-dept-utilization.tsx` | Create | Chart E: dept budget utilization horizontal bar |
| `src/app/(app)/analitik/_components/chart-system-status.tsx` | Create | Chart F full: system status donut |

---

### Task 1: Install shadcn chart + add sidebar nav entry

**Files:**
- Create: `src/components/ui/chart.tsx` (via shadcn CLI)
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Install shadcn chart component**

```bash
npx shadcn add chart
```

Accept all prompts. Creates `src/components/ui/chart.tsx` with `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, and `ChartConfig` type. Also installs `recharts` as a dependency.

- [ ] **Step 2: Add `/analitik` nav entry to `app-sidebar.tsx`**

In `src/components/app-sidebar.tsx`, add `LineChart` to the lucide-react import:

```typescript
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  CheckSquare,
  Calculator,
  Shield,
  BarChart3,
  LineChart,
  Users,
  Settings,
  ScrollText,
  Bell,
  LogOut,
  Building2,
} from "lucide-react";
```

Add the `/analitik` entry to `navItems` after the `/laporan` entry:

```typescript
  {
    href: "/laporan",
    label: "Laporan",
    icon: BarChart3,
    roles: [Role.FINANCE, Role.APPROVER, Role.YDP, Role.ADMIN],
  },
  {
    href: "/analitik",
    label: "Analitik",
    icon: LineChart,
    roles: [Role.HEAD, Role.FINANCE, Role.APPROVER, Role.YDP, Role.ADMIN],
  },
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/chart.tsx src/components/app-sidebar.tsx package.json package-lock.json
git commit -m "feat: install shadcn chart + add analitik sidebar nav"
```

---

### Task 2: API route `/api/charts/all`

**Files:**
- Create: `src/app/api/charts/all/route.ts`

This is the single endpoint for all management chart data. It exports TypeScript types that `/analitik` chart components import. It enforces role-based dept scoping server-side.

- [ ] **Step 1: Create the API route**

Create `src/app/api/charts/all/route.ts`:

```typescript
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

const MGMT_ROLES = [Role.HEAD, Role.FINANCE, Role.APPROVER, Role.YDP, Role.ADMIN];
const SENIOR_ROLES = [Role.FINANCE, Role.APPROVER, Role.YDP, Role.ADMIN];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  if (!roles.some((r) => MGMT_ROLES.includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const deptParam = searchParams.get("dept") || null;

  // HEAD-only users are locked to their own dept; senior roles can filter freely
  const isHeadOnly = roles.includes(Role.HEAD) && !roles.some((r) => SENIOR_ROLES.includes(r));
  const deptId = isHeadOnly ? (session.user.departmentId ?? null) : deptParam;

  const claimDeptClause = deptId ? Prisma.sql`AND "departmentId" = ${deptId}` : Prisma.empty;
  const userDeptClause = deptId ? Prisma.sql`AND u."departmentId" = ${deptId}` : Prisma.empty;

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
    // Chart C: by department
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
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Smoke test**

Start dev server (`npm run dev`). Open `http://localhost:3000/api/charts/all?year=2026` while logged in as ADMIN or FINANCE. Expected: JSON response with keys `monthlyTrend` (12 items), `byDepartment`, `byStatus`, `deptUtilization`. As CLAIMANT: 403.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/charts/all/route.ts"
git commit -m "feat: add /api/charts/all combined chart data endpoint"
```

---

### Task 3: Dashboard personal chart components (A + B)

**Files:**
- Create: `src/app/(app)/dashboard/_components/chart-spending-trend.tsx`
- Create: `src/app/(app)/dashboard/_components/chart-claim-status.tsx`

These are `"use client"` components that receive pre-fetched server data as props.

- [ ] **Step 1: Create Chart A — personal monthly spending bar**

Create `src/app/(app)/dashboard/_components/chart-spending-trend.tsx`:

```typescript
"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MONTHS = ["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ogs","Sep","Okt","Nov","Dis"];

const chartConfig = {
  total: { label: "Jumlah (RM)", color: "#15803d" },
} satisfies ChartConfig;

interface Props {
  data: { month: number; total: number }[];
  year: number;
}

export function ChartSpendingTrend({ data, year }: Props) {
  const chartData = data.map((d) => ({ ...d, monthLabel: MONTHS[d.month - 1] }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Perbelanjaan Bulanan {year}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-48 w-full">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `RM${v}`}
              width={48}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v) => `RM ${Number(v).toFixed(2)}`}
                />
              }
            />
            <Bar dataKey="total" fill="var(--color-total)" radius={[3, 3, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create Chart B — personal claim status donut**

Create `src/app/(app)/dashboard/_components/chart-claim-status.tsx`:

```typescript
"use client";

import { Pie, PieChart, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT:            { label: "Draf",              color: "#94a3b8" },
  SUBMITTED:        { label: "Dihantar",          color: "#3b82f6" },
  HEAD_APPROVED:    { label: "Sokong KJ",         color: "#8b5cf6" },
  FINANCE_REVIEWED: { label: "Semakan Kewangan",  color: "#f59e0b" },
  APPROVED:         { label: "Diluluskan",        color: "#22c55e" },
  REJECTED:         { label: "Ditolak",           color: "#ef4444" },
  PAID:             { label: "Dibayar",           color: "#10b981" },
};

interface Props {
  data: { status: string; count: number }[];
}

export function ChartClaimStatus({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Status Tuntutan Saya</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-gray-400 text-sm">Tiada tuntutan lagi</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: STATUS_META[d.status]?.label ?? d.status,
    fill: STATUS_META[d.status]?.color ?? "#94a3b8",
  }));

  const chartConfig = Object.fromEntries(
    chartData.map((d) => [d.status, { label: d.label, color: d.fill }])
  ) as ChartConfig;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Status Tuntutan Saya</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-40 w-full">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="status"
              innerRadius={36}
              outerRadius={60}
            >
              {chartData.map((entry) => (
                <Cell key={entry.status} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => [
                    `${value} tuntutan`,
                    item.payload?.label ?? item.name,
                  ]}
                />
              }
            />
          </PieChart>
        </ChartContainer>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {chartData.map((d) => (
            <span key={d.status} className="flex items-center gap-1 text-xs text-gray-600">
              <span
                className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                style={{ backgroundColor: d.fill }}
              />
              {d.label} ({d.count})
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/dashboard/_components/chart-spending-trend.tsx" "src/app/(app)/dashboard/_components/chart-claim-status.tsx"
git commit -m "feat: add personal dashboard chart components A+B"
```

---

### Task 4: Integrate personal charts into dashboard page

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add imports to dashboard page**

At the top of `src/app/(app)/dashboard/page.tsx`, add to the existing import block:

```typescript
import { Prisma } from "@/generated/prisma";
import { ChartSpendingTrend } from "./_components/chart-spending-trend";
import { ChartClaimStatus } from "./_components/chart-claim-status";
```

- [ ] **Step 2: Add Chart A + B queries**

After the `myClaims` query block (after `take: 5,` + `});`), add:

```typescript
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
```

- [ ] **Step 3: Render personal charts in JSX**

In the JSX, after `{/* Quick actions */}` block and before `{/* Inbox resit belum dituntut */}`, add:

```tsx
      {/* Personal Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartSpendingTrend data={monthlyData} year={currentYear} />
        <ChartClaimStatus data={statusData} />
      </div>
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Verify in browser**

Open `http://localhost:3000/dashboard`. Confirm:
- Bar chart "Perbelanjaan Bulanan 2026" appears with 12 month columns (zero for months with no claims)
- Donut "Status Tuntutan Saya" appears with legend dots below

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx"
git commit -m "feat: integrate personal charts A+B into dashboard"
```

---

### Task 5: Dashboard management mini-charts (D mini + F mini)

**Files:**
- Create: `src/app/(app)/dashboard/_components/chart-mini-monthly.tsx`
- Create: `src/app/(app)/dashboard/_components/chart-mini-system-status.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create Chart D mini — system monthly bar**

Create `src/app/(app)/dashboard/_components/chart-mini-monthly.tsx`:

```typescript
"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MONTHS = ["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ogs","Sep","Okt","Nov","Dis"];

const chartConfig = {
  total: { label: "Nilai (RM)", color: "#1d4ed8" },
} satisfies ChartConfig;

interface Props {
  data: { month: number; total: number; count: number }[];
  year: number;
}

export function ChartMiniMonthly({ data, year }: Props) {
  const chartData = data.map((d) => ({ ...d, monthLabel: MONTHS[d.month - 1] }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Trend Bulanan Sistem {year}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-40 w-full">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="monthLabel" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `RM${v}`}
              width={44}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v, _n, item) => [
                    `RM ${Number(v).toFixed(2)} · ${item.payload?.count ?? 0} tuntutan`,
                    "Nilai",
                  ]}
                />
              }
            />
            <Bar dataKey="total" fill="var(--color-total)" radius={[2, 2, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create Chart F mini — system status donut**

Create `src/app/(app)/dashboard/_components/chart-mini-system-status.tsx`:

```typescript
"use client";

import { Pie, PieChart, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT:            { label: "Draf",              color: "#94a3b8" },
  SUBMITTED:        { label: "Dihantar",          color: "#3b82f6" },
  HEAD_APPROVED:    { label: "Sokong KJ",         color: "#8b5cf6" },
  FINANCE_REVIEWED: { label: "Semakan Kewangan",  color: "#f59e0b" },
  APPROVED:         { label: "Diluluskan",        color: "#22c55e" },
  REJECTED:         { label: "Ditolak",           color: "#ef4444" },
  PAID:             { label: "Dibayar",           color: "#10b981" },
};

interface Props {
  data: { status: string; count: number }[];
  year: number;
}

export function ChartMiniSystemStatus({ data, year }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Status Sistem {year}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Tiada data</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: STATUS_META[d.status]?.label ?? d.status,
    fill: STATUS_META[d.status]?.color ?? "#94a3b8",
  }));

  const chartConfig = Object.fromEntries(
    chartData.map((d) => [d.status, { label: d.label, color: d.fill }])
  ) as ChartConfig;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Status Sistem {year}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-40 w-full">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="status"
              innerRadius={28}
              outerRadius={52}
            >
              {chartData.map((entry) => (
                <Cell key={entry.status} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => [
                    `${value} tuntutan`,
                    item.payload?.label ?? item.name,
                  ]}
                />
              }
            />
          </PieChart>
        </ChartContainer>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
          {chartData.map((d) => (
            <span key={d.status} className="flex items-center gap-1 text-xs text-gray-600">
              <span
                className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                style={{ backgroundColor: d.fill }}
              />
              {d.label} ({d.count})
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Add mgmt imports to dashboard page**

In `src/app/(app)/dashboard/page.tsx`, add to the import block:

```typescript
import { ChartMiniMonthly } from "./_components/chart-mini-monthly";
import { ChartMiniSystemStatus } from "./_components/chart-mini-system-status";
```

- [ ] **Step 4: Add mgmt queries to dashboard page**

After the `statusData` computation block, add:

```typescript
  // Management mini-charts — HEAD/FINANCE/APPROVER/ADMIN only
  const isMgmt = roles.some((r) =>
    [Role.HEAD, Role.FINANCE, Role.APPROVER, Role.YDP, Role.ADMIN].includes(r)
  );
  const isHeadOnly =
    roles.includes(Role.HEAD) &&
    !roles.some((r) => [Role.FINANCE, Role.APPROVER, Role.YDP, Role.ADMIN].includes(r));
  const mgmtDeptId = isHeadOnly ? (session.user.departmentId ?? null) : null;
  const mgmtDeptClause = mgmtDeptId
    ? Prisma.sql`AND "departmentId" = ${mgmtDeptId}`
    : Prisma.empty;

  let miniMonthlyData: { month: number; total: number; count: number }[] = [];
  let miniStatusData: { status: string; count: number }[] = [];

  if (isMgmt) {
    const [rawMiniMonthly, rawMiniStatus] = await Promise.all([
      prisma.$queryRaw<Array<{ forMonth: number; total: string; count: string }>>`
        SELECT "forMonth", SUM("totalClaimedMyr") AS total, COUNT(*) AS count
        FROM "Claim"
        WHERE "forYear" = ${currentYear}
        ${mgmtDeptClause}
        GROUP BY "forMonth"
        ORDER BY "forMonth"
      `,
      prisma.$queryRaw<Array<{ status: string; count: string }>>`
        SELECT status, COUNT(*) AS count
        FROM "Claim"
        WHERE "forYear" = ${currentYear}
        ${mgmtDeptClause}
        GROUP BY status
      `,
    ]);

    miniMonthlyData = Array.from({ length: 12 }, (_, i) => {
      const row = rawMiniMonthly.find((r) => Number(r.forMonth) === i + 1);
      return { month: i + 1, total: row ? Number(row.total) : 0, count: row ? Number(row.count) : 0 };
    });

    miniStatusData = rawMiniStatus.map((r) => ({ status: r.status, count: Number(r.count) }));
  }
```

- [ ] **Step 5: Render management mini-charts in JSX**

After the personal charts `</div>` and before `{/* Inbox resit belum dituntut */}`, add:

```tsx
      {/* Management mini-charts */}
      {isMgmt && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Gambaran Sistem {currentYear}
            </h2>
            <a href="/analitik" className="text-xs text-green-700 hover:underline">
              Lihat analitik penuh →
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartMiniMonthly data={miniMonthlyData} year={currentYear} />
            <ChartMiniSystemStatus data={miniStatusData} year={currentYear} />
          </div>
        </div>
      )}
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Verify in browser**

Log in as ADMIN/FINANCE → dashboard shows "Gambaran Sistem" section with D mini + F mini charts + "Lihat analitik penuh →" link.

Log in as CLAIMANT → "Gambaran Sistem" section does not appear.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/dashboard/_components/chart-mini-monthly.tsx" "src/app/(app)/dashboard/_components/chart-mini-system-status.tsx" "src/app/(app)/dashboard/page.tsx"
git commit -m "feat: add management mini-charts D+F to dashboard"
```

---

### Task 6: Analitik chart components (C, D full, E, F full)

**Files:**
- Create: `src/app/(app)/analitik/_components/chart-dept-claims.tsx`
- Create: `src/app/(app)/analitik/_components/chart-monthly-trend.tsx`
- Create: `src/app/(app)/analitik/_components/chart-dept-utilization.tsx`
- Create: `src/app/(app)/analitik/_components/chart-system-status.tsx`

All components import types from `@/app/api/charts/all/route`.

- [ ] **Step 1: Create Chart C — dept claims vertical bar**

Create `src/app/(app)/analitik/_components/chart-dept-claims.tsx`:

```typescript
"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ByDeptRow } from "@/app/api/charts/all/route";

const chartConfig = {
  total: { label: "Nilai Tuntutan (RM)", color: "#15803d" },
} satisfies ChartConfig;

export function ChartDeptClaims({ data }: { data: ByDeptRow[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tuntutan Mengikut Jabatan</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-gray-400 text-sm">Tiada data untuk tempoh ini</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tuntutan Mengikut Jabatan</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 36 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `RM${v}`}
              width={56}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v, _n, item) => [
                    `RM ${Number(v).toFixed(2)} · ${item.payload?.count ?? 0} tuntutan`,
                    "Nilai",
                  ]}
                />
              }
            />
            <Bar dataKey="total" fill="var(--color-total)" radius={[3, 3, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create Chart D full — monthly trend line**

Create `src/app/(app)/analitik/_components/chart-monthly-trend.tsx`:

```typescript
"use client";

import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyTrendRow } from "@/app/api/charts/all/route";

const MONTHS = ["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ogs","Sep","Okt","Nov","Dis"];

const chartConfig = {
  total: { label: "Nilai (RM)", color: "#15803d" },
} satisfies ChartConfig;

export function ChartMonthlyTrend({ data }: { data: MonthlyTrendRow[] }) {
  const chartData = data.map((d) => ({ ...d, monthLabel: MONTHS[d.month - 1] }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Trend Nilai Bulanan</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-56 w-full">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `RM${v}`}
              width={56}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v, _n, item) => [
                    `RM ${Number(v).toFixed(2)} · ${item.payload?.count ?? 0} tuntutan`,
                    "Nilai",
                  ]}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="var(--color-total)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create Chart E — dept budget utilization horizontal bar**

Create `src/app/(app)/analitik/_components/chart-dept-utilization.tsx`:

```typescript
"use client";

import { Bar, BarChart, XAxis, YAxis, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DeptUtilRow } from "@/app/api/charts/all/route";

const chartConfig = {
  pct: { label: "% Digunakan", color: "#15803d" },
} satisfies ChartConfig;

export function ChartDeptUtilization({ data }: { data: DeptUtilRow[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Penggunaan Peruntukan Jabatan</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-56">
          <p className="text-gray-400 text-sm">Tiada data untuk tempoh ini</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    name: d.name,
    pct: d.limit_myr > 0 ? Math.min(Math.round((d.used / d.limit_myr) * 100), 100) : 0,
    used: d.used,
    limit: d.limit_myr,
  }));

  const barHeight = 28;
  const chartHeight = Math.max(160, chartData.length * (barHeight + 12) + 32);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Penggunaan Peruntukan Jabatan</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} style={{ height: chartHeight }} className="w-full">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={104}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v, _n, item) => [
                    `${v}% · RM ${Number(item.payload?.used ?? 0).toFixed(2)} / RM ${Number(item.payload?.limit ?? 0).toFixed(2)}`,
                    "Guna pakai",
                  ]}
                />
              }
            />
            <Bar dataKey="pct" radius={[0, 3, 3, 0]} maxBarSize={barHeight}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={
                    entry.pct >= 90 ? "#ef4444" : entry.pct >= 70 ? "#f59e0b" : "#15803d"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create Chart F full — system status donut**

Create `src/app/(app)/analitik/_components/chart-system-status.tsx`:

```typescript
"use client";

import { Pie, PieChart, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ByStatusRow } from "@/app/api/charts/all/route";

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT:            { label: "Draf",              color: "#94a3b8" },
  SUBMITTED:        { label: "Dihantar",          color: "#3b82f6" },
  HEAD_APPROVED:    { label: "Sokong KJ",         color: "#8b5cf6" },
  FINANCE_REVIEWED: { label: "Semakan Kewangan",  color: "#f59e0b" },
  APPROVED:         { label: "Diluluskan",        color: "#22c55e" },
  REJECTED:         { label: "Ditolak",           color: "#ef4444" },
  PAID:             { label: "Dibayar",           color: "#10b981" },
};

export function ChartSystemStatus({ data }: { data: ByStatusRow[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Status Tuntutan Sistem</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-56">
          <p className="text-gray-400 text-sm">Tiada data untuk tempoh ini</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: STATUS_META[d.status]?.label ?? d.status,
    fill: STATUS_META[d.status]?.color ?? "#94a3b8",
  }));

  const chartConfig = Object.fromEntries(
    chartData.map((d) => [d.status, { label: d.label, color: d.fill }])
  ) as ChartConfig;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Status Tuntutan Sistem</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-48 w-full">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="status"
              innerRadius={48}
              outerRadius={80}
            >
              {chartData.map((entry) => (
                <Cell key={entry.status} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => [
                    `${value} tuntutan`,
                    item.payload?.label ?? item.name,
                  ]}
                />
              }
            />
          </PieChart>
        </ChartContainer>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {chartData.map((d) => (
            <span key={d.status} className="flex items-center gap-1 text-xs text-gray-600">
              <span
                className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                style={{ backgroundColor: d.fill }}
              />
              {d.label} ({d.count})
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/analitik/"
git commit -m "feat: add analitik chart components C, D, E, F"
```

---

### Task 7: `/analitik` page + `AnalitikFilters` client component

**Files:**
- Create: `src/app/(app)/analitik/_components/analitik-filters.tsx`
- Create: `src/app/(app)/analitik/page.tsx`

`AnalitikFilters` owns all client-side state: filters, data, and the 60s poll loop with tab-visibility pause.

- [ ] **Step 1: Create `analitik-filters.tsx`**

Create `src/app/(app)/analitik/_components/analitik-filters.tsx`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { Role } from "@/generated/prisma";
import { ChartDeptClaims } from "./chart-dept-claims";
import { ChartMonthlyTrend } from "./chart-monthly-trend";
import { ChartDeptUtilization } from "./chart-dept-utilization";
import { ChartSystemStatus } from "./chart-system-status";
import type { AllChartsData } from "@/app/api/charts/all/route";

interface Department {
  id: string;
  name: string;
}

interface Props {
  initialData: AllChartsData;
  initialYear: number;
  departments: Department[];
  userRoles: Role[];
  userDeptId: string | null;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const SENIOR_ROLES: Role[] = [Role.FINANCE, Role.APPROVER, Role.YDP, Role.ADMIN];

export function AnalitikFilters({
  initialData,
  initialYear,
  departments,
  userRoles,
  userDeptId,
}: Props) {
  const isHeadOnly =
    userRoles.includes(Role.HEAD) && !userRoles.some((r) => SENIOR_ROLES.includes(r));

  const [year, setYear] = useState(initialYear);
  const [dept, setDept] = useState(isHeadOnly ? (userDeptId ?? "") : "");
  const [data, setData] = useState<AllChartsData>(initialData);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({ year: String(year) });
    if (dept) params.set("dept", dept);
    try {
      const res = await fetch(`/api/charts/all?${params}`);
      if (res.ok) setData(await res.json());
    } catch {
      // network error — keep stale data
    }
  }, [year, dept]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      intervalId = setInterval(fetchData, 60_000);
    };
    const stop = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    fetchData();
    start();

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        fetchData();
        start();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchData]); // re-runs whenever year or dept changes (fetchData memoised on them)

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Tahun:</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {!isHeadOnly && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Jabatan:</label>
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="">Semua Jabatan</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Chart C: by dept */}
      <ChartDeptClaims data={data.byDepartment} />

      {/* Chart D + F side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartMonthlyTrend data={data.monthlyTrend} />
        <ChartSystemStatus data={data.byStatus} />
      </div>

      {/* Chart E: utilization */}
      <ChartDeptUtilization data={data.deptUtilization} />
    </div>
  );
}
```

- [ ] **Step 2: Create `/analitik` page**

Create `src/app/(app)/analitik/page.tsx`:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Prisma, Role } from "@/generated/prisma";
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
  const deptId = isHeadOnly ? (session.user.departmentId ?? null) : null;

  const claimDeptClause = deptId ? Prisma.sql`AND "departmentId" = ${deptId}` : Prisma.empty;
  const userDeptClause = deptId ? Prisma.sql`AND u."departmentId" = ${deptId}` : Prisma.empty;

  const [departments, rawMonthly, rawDept, rawStatus, rawUtil] = await Promise.all([
    prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.$queryRaw<Array<{ forMonth: number; total: string; count: string }>>`
      SELECT "forMonth", SUM("totalClaimedMyr") AS total, COUNT(*) AS count
      FROM "Claim"
      WHERE "forYear" = ${currentYear}
      ${claimDeptClause}
      GROUP BY "forMonth"
      ORDER BY "forMonth"
    `,
    prisma.$queryRaw<Array<{ name: string; total: string; count: string }>>`
      SELECT d.name, SUM(c."totalClaimedMyr") AS total, COUNT(*) AS count
      FROM "Claim" c
      JOIN "Department" d ON c."departmentId" = d.id
      WHERE c."forYear" = ${currentYear}
      ${claimDeptClause}
      GROUP BY d.id, d.name
      ORDER BY total DESC
    `,
    prisma.$queryRaw<Array<{ status: string; count: string }>>`
      SELECT status, COUNT(*) AS count
      FROM "Claim"
      WHERE "forYear" = ${currentYear}
      ${claimDeptClause}
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
      ${userDeptClause}
      GROUP BY d.id, d.name
      ORDER BY used DESC
    `,
  ]);

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
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify in browser — happy path**

Start dev server. Log in as ADMIN or FINANCE. Navigate to `http://localhost:3000/analitik`. Confirm:
- Page title "Analitik Tuntutan" with subtitle about 60s refresh
- Tahun filter defaults to current year
- Jabatan filter shows "Semua Jabatan" + all departments
- All 4 charts render with data (or "Tiada data" empty state if no claims exist)
- Change year → charts update
- Change jabatan → charts update

- [ ] **Step 5: Verify in browser — HEAD role**

Log in as HEAD. Navigate to `/analitik`. Confirm:
- Page loads (no redirect)
- Jabatan filter is hidden (HEAD sees only their dept)
- Charts show only their department's data

- [ ] **Step 6: Verify in browser — CLAIMANT role**

Log in as CLAIMANT. Navigate to `http://localhost:3000/analitik`. Expected: redirects to `/dashboard`.

- [ ] **Step 7: Verify auto-poll**

Stay on `/analitik`. Open browser DevTools → Network tab. After 60 seconds, confirm a request to `/api/charts/all` appears. Switch to another tab → no more requests. Switch back → request fires immediately + poll resumes.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/analitik/"
git commit -m "feat: add /analitik page with filters, auto-poll 60s, charts C D E F"
```

---

## Self-Review

**Spec coverage:**
- [x] A — personal monthly bar → Task 3, 4
- [x] B — personal status donut → Task 3, 4
- [x] C — dept claims bar → Task 6, 7
- [x] D mini — system monthly (dashboard) → Task 5
- [x] D full — system monthly (analitik) → Task 6, 7
- [x] E — dept utilization horizontal bar → Task 6, 7
- [x] F mini — system status donut (dashboard) → Task 5
- [x] F full — system status donut (analitik) → Task 6, 7
- [x] Auto-poll 60s → Task 7
- [x] visibilitychange pause → Task 7
- [x] useEffect cleanup on unmount → Task 7
- [x] Single combined API endpoint `/api/charts/all` → Task 2
- [x] Role gating HEAD/FINANCE/APPROVER/ADMIN → Tasks 2, 5, 7
- [x] HEAD dept scoping (server-enforced) → Tasks 2, 5, 7
- [x] Sidebar nav `/analitik` → Task 1
- [x] Zero-fill 12 months → Tasks 2, 4, 5, 7

**No placeholders found.**

**Type consistency:** `AllChartsData`, `MonthlyTrendRow`, `ByDeptRow`, `ByStatusRow`, `DeptUtilRow` defined once in Task 2 (`route.ts`) and imported by Tasks 3, 6, 7. `ChartMiniMonthly` / `ChartMiniSystemStatus` use inline types (not exported from route) — consistent with their dashboard-only scope.
