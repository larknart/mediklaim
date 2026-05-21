# Dashboard Charts — Design Spec
**Date:** 2026-05-21
**Project:** MediKlaim MDS

## Overview

Add data visualisation charts to the dashboard and a new `/analitik` page. All users see personal charts on the dashboard. Management roles (HEAD/FINANCE/APPROVER/ADMIN) additionally see system-wide mini-charts on the dashboard and a full analytics page at `/analitik`.

## Architecture

### Approach: Hybrid (Server + Client)

- **Dashboard mini-charts** — server-rendered. Data fetched in `dashboard/page.tsx` alongside existing queries. Serialized arrays passed as props to client chart components. No loading states, no API routes, no interactivity needed.
- **`/analitik` full page** — server shell for initial render + client components for filter-driven refetch. Year and jabatan filters trigger fetch to API routes, charts re-render with new data.

### Chart Library

`shadcn/ui Chart` component (built on Recharts). Install via:
```
npx shadcn add chart
```
Consistent with existing shadcn/ui component style.

## Charts

### Personal Charts (all users — dashboard)

| ID | Type | Title | Data |
|----|------|-------|------|
| A | Bar | Perbelanjaan Bulanan `{year}` | `SUM(totalClaimedMyr) GROUP BY forMonth WHERE claimantId=userId AND forYear=currentYear` — 12 months, zero-fill missing |
| B | Donut | Status Tuntutan Saya | `COUNT(*) GROUP BY status WHERE claimantId=userId` |

### Management Charts (HEAD/FINANCE/APPROVER/ADMIN)

| ID | Location | Type | Title | Data |
|----|----------|------|-------|------|
| C | `/analitik` | Bar (vertical) | Tuntutan Mengikut Jabatan | `SUM(totalClaimedMyr) GROUP BY departmentId` filtered by year |
| D | dashboard mini + `/analitik` | Bar/Line | Trend Nilai Bulanan Sistem | `SUM(totalClaimedMyr) GROUP BY forMonth` filtered by year |
| E | `/analitik` | Bar (horizontal) | Penggunaan Peruntukan Jabatan | `SUM(usedMyr)/SUM(limitMyr) per dept` from AnnualAllocation |
| F | dashboard mini + `/analitik` | Donut | Status Tuntutan Sistem | `COUNT(*) GROUP BY status` system-wide |

**HEAD scoping:** HEAD sees only their own `departmentId`. FINANCE/APPROVER/ADMIN see all.

## Data Queries

All aggregation queries use `prisma.$queryRaw` (raw SQL) for efficiency. Prisma ORM GROUP BY aggregates are verbose; raw SQL is cleaner for these read-only chart queries.

### Chart A — Personal Monthly
```sql
SELECT "forMonth", SUM("totalClaimedMyr") AS total
FROM "Claim"
WHERE "claimantId" = $1 AND "forYear" = $2
GROUP BY "forMonth"
ORDER BY "forMonth"
```
Zero-fill months 1–12 in application layer.

### Chart B — Personal Status Donut
```sql
SELECT status, COUNT(*) AS count
FROM "Claim"
WHERE "claimantId" = $1
GROUP BY status
```

### Chart C — Claims by Dept
```sql
SELECT d.name, SUM(c."totalClaimedMyr") AS total, COUNT(*) AS count
FROM "Claim" c
JOIN "Department" d ON c."departmentId" = d.id
WHERE c."forYear" = $1
  AND ($2::text IS NULL OR c."departmentId" = $2)
GROUP BY d.id, d.name
ORDER BY total DESC
```

### Chart D — Monthly System Trend
```sql
SELECT "forMonth", SUM("totalClaimedMyr") AS total, COUNT(*) AS count
FROM "Claim"
WHERE "forYear" = $1
  AND ($2::text IS NULL OR "departmentId" = $2)
GROUP BY "forMonth"
ORDER BY "forMonth"
```

### Chart E — Dept Budget Utilization
```sql
SELECT d.name,
  SUM(a."usedMyr") AS used,
  SUM(a."limitMyr") AS limit_myr
FROM "AnnualAllocation" a
JOIN "User" u ON a."userId" = u.id
JOIN "Department" d ON u."departmentId" = d.id
WHERE a.year = $1
  AND ($2::text IS NULL OR u."departmentId" = $2)
GROUP BY d.id, d.name
ORDER BY used DESC
```

### Chart F — System Status Donut
```sql
SELECT status, COUNT(*) AS count
FROM "Claim"
WHERE "forYear" = $1
  AND ($2::text IS NULL OR "departmentId" = $2)
GROUP BY status
```

## File Structure

```
src/
  app/
    (app)/
      dashboard/
        page.tsx                          ← add chart data queries (existing file)
        _components/
          chart-spending-trend.tsx        ← Chart A: personal bar (new)
          chart-claim-status.tsx          ← Chart B: personal donut (new)
          chart-mini-system-status.tsx    ← Chart F mini: system donut (new)
          chart-mini-monthly.tsx          ← Chart D mini: system bar (new)
      analitik/
        page.tsx                          ← server shell, role guard (new)
        _components/
          analitik-filters.tsx            ← year + jabatan selectors + poll loop, client (new)
          chart-dept-claims.tsx           ← Chart C: bar by dept (new)
          chart-monthly-trend.tsx         ← Chart D: full monthly line/bar (new)
          chart-dept-utilization.tsx      ← Chart E: horizontal bar (new)
          chart-system-status.tsx         ← Chart F: full donut (new)
    api/
      charts/
        all/route.ts                      ← GET ?year&dept, returns all 4 datasets (new)
  components/
    ui/
      chart.tsx                           ← added by shadcn add chart
```

Total new files: 11 (1 API route, 6 analitik components, 4 dashboard chart components, 1 analitik page)
Modified files: 1 (`dashboard/page.tsx`)

## UI Layout

### Dashboard — Personal Section (all users, below quick actions)

```
┌──────────────────────────────┬──────────────────┐
│ A: Bar - Perbelanjaan Bulanan│ B: Donut - Status │
│ (12 months, current year)    │ Tuntutan Saya     │
└──────────────────────────────┴──────────────────┘
```

### Dashboard — Sistem Section (mgmt only, below personal charts)

```
┌──────────────────────────────┬──────────────────┐
│ D mini: Bar - Trend Bulanan  │ F mini: Donut -   │
│ Sistem (current year)        │ Status Sistem     │
└──────────────────────────────┴──────────────────┘
[→ Lihat analitik penuh]
```

### `/analitik` Page

```
Analitik Tuntutan
[Tahun: 2026 ▾]  [Jabatan: Semua ▾]

┌─────────────────────────────────────────────────┐
│ C: Bar - Tuntutan Mengikut Jabatan              │
└─────────────────────────────────────────────────┘

┌──────────────────────────────┬──────────────────┐
│ D: Line - Trend Nilai Bulanan│ F: Donut - Status │
└──────────────────────────────┴──────────────────┘

┌─────────────────────────────────────────────────┐
│ E: Horizontal Bar - Penggunaan Peruntukan       │
└─────────────────────────────────────────────────┘
```

## Role Gating

| Feature | CLAIMANT | HEAD | FINANCE | APPROVER | ADMIN |
|---------|----------|------|---------|----------|-------|
| Charts A, B (personal) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dashboard mgmt section | ✗ | ✓ (dept) | ✓ (all) | ✓ (all) | ✓ (all) |
| `/analitik` page | ✗ | ✓ (dept) | ✓ (all) | ✓ (all) | ✓ (all) |
| Dept filter on `/analitik` | ✗ | ✗ (locked to dept) | ✓ | ✓ | ✓ |

HEAD redirect: no redirect, but queries are scoped by `session.user.departmentId`. Dept filter hidden for HEAD.

## API Routes

Single combined endpoint (reduces 4 requests → 1 per poll):

```
GET /api/charts/all?year=2026&dept=<id>
```

Response shape:
```json
{
  "monthlyTrend": [{ "month": 1, "total": 450.00, "count": 3 }, ...],
  "byDepartment": [{ "name": "Jabatan A", "total": 1200.00, "count": 8 }, ...],
  "byStatus": [{ "status": "APPROVED", "count": 12 }, ...],
  "deptUtilization": [{ "name": "Jabatan A", "used": 800.00, "limit": 1200.00 }, ...]
}
```

HEAD role: API enforces dept scoping server-side (ignores `dept` param, uses `session.user.departmentId`).

## Auto-Poll (`/analitik` only)

`analitik-filters.tsx` owns the poll loop. Three optimizations:

1. **Single endpoint** — 1 fetch per tick returns all 4 datasets (see API Routes above)
2. **`visibilitychange` pause** — poll stops when tab is hidden, resumes on focus. Zero resource use when idle.
3. **`useEffect` cleanup** — interval cleared on unmount (navigate away stops polling)

Poll interval: **60 seconds**. Dashboard personal charts (A, B) are static — no polling, data fetched server-side on page load.

## Nav Integration

Add `/analitik` link to sidebar nav, visible only to HEAD/FINANCE/APPROVER/ADMIN roles.

## Out of Scope

- Date range filters (month-level granularity) — year filter sufficient
- Chart export (PNG/PDF) — laporan page handles exports
- WebSocket / SSE push (auto-poll 60s used instead)
- Claimant seeing other users' data
