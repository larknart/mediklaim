# Global Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full-text global search (Claims, Receipts, Users, AuditLogs) via a persistent header bar and slide-in panel.

**Architecture:** PostgreSQL expression GIN indexes on 4 tables; Route Handler `GET /api/search?q=` returns grouped results; Client Component `GlobalSearch` in a new sticky header above all authenticated pages. Role-scoped results mirror existing page-level access.

**Tech Stack:** Next.js 16 App Router, Prisma 7 `$queryRaw` (PostgreSQL FTS), `plainto_tsquery('simple', …)`, React hooks (debounce, keyboard shortcuts), Tailwind CSS, shadcn/ui primitives.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/migrations/20260526000000_add_search_gin_indexes/migration.sql` | Create | Expression GIN indexes on Claim, Receipt, User, AuditLog |
| `src/app/api/search/route.ts` | Create | Route Handler — auth, role scoping, FTS queries, JSON response |
| `src/components/global-search.tsx` | Create | Client Component — search input, debounce, slide-in panel, keyboard shortcuts |
| `src/app/(app)/layout.tsx` | Modify | Add sticky header bar containing `<GlobalSearch />` |
| `.gitignore` | Modify | Add `.superpowers/` entry |

---

## Critical Patterns (read before writing code)

- **No `Prisma.sql` conditional fragments** — composition is broken with `@prisma/adapter-pg`. Use branched `$queryRaw` calls per role variant (each call is a complete SQL string).
- **`$queryRaw` Decimal → string** — PostgreSQL Decimal/Numeric comes back as a `string`. Always wrap in `Number()` before returning to client.
- **Session already has `departmentId` and `roles`** — no extra DB lookup needed. `session.user.departmentId: string | null`, `session.user.roles: Role[]`.
- **`"use server"` files** — no re-exports. Route Handler is not a server action file so this doesn't apply here.
- **Next.js 16 `headers()` is async** — not needed in this feature.

---

## Task 1: GIN Indexes Migration

**Files:**
- Create: `prisma/migrations/20260526000000_add_search_gin_indexes/migration.sql`
- Modify: `.gitignore`

- [ ] **Step 1: Add `.superpowers/` to `.gitignore`**

Open `.gitignore`, add this line at the end:

```
.superpowers/
```

- [ ] **Step 2: Create the migration directory and SQL file**

Create `prisma/migrations/20260526000000_add_search_gin_indexes/migration.sql`:

```sql
-- Expression GIN indexes for global search (full-text, 'simple' dictionary)
-- 'simple': lowercase + tokenise only — no English stemming on Malay words/ref numbers

CREATE INDEX IF NOT EXISTS claim_fts_idx ON "Claim" USING GIN (
  to_tsvector('simple',
    coalesce("refNo", '') || ' ' ||
    coalesce("voucherNo", '')
  )
);

CREATE INDEX IF NOT EXISTS receipt_fts_idx ON "Receipt" USING GIN (
  to_tsvector('simple', coalesce(vendor, ''))
);

CREATE INDEX IF NOT EXISTS user_fts_idx ON "User" USING GIN (
  to_tsvector('simple',
    coalesce(name, '') || ' ' ||
    coalesce(email, '') || ' ' ||
    coalesce("staffNo", '')
  )
);

CREATE INDEX IF NOT EXISTS auditlog_fts_idx ON "AuditLog" USING GIN (
  to_tsvector('simple',
    coalesce("actorName", '') || ' ' ||
    coalesce(action, '') || ' ' ||
    coalesce(entity, '') || ' ' ||
    coalesce("entityId", '')
  )
);
```

- [ ] **Step 3: Apply migration**

```bash
npx prisma migrate deploy
```

Expected output: `1 migration applied.` (or "already applied" if re-run)

- [ ] **Step 4: Verify indexes exist**

```bash
npx prisma db execute --stdin <<'SQL'
SELECT indexname, tablename
FROM pg_indexes
WHERE indexname IN ('claim_fts_idx','receipt_fts_idx','user_fts_idx','auditlog_fts_idx');
SQL
```

Expected: 4 rows, one per index name.

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations/20260526000000_add_search_gin_indexes/migration.sql .gitignore
git commit -m "feat: add FTS GIN indexes for global search"
```

---

## Task 2: API Route — Scaffold + Types

**Files:**
- Create: `src/app/api/search/route.ts`

- [ ] **Step 1: Create the route file with auth guard, validation, and exported types**

Create `src/app/api/search/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Role } from "@/generated/prisma";

// ─── Shared types (imported by GlobalSearch component) ────────────────────────

export type SearchResult = {
  id: string;
  type: "claim" | "receipt" | "user" | "audit";
  label: string;     // Primary line: "TUN-2026-0042"
  sublabel: string;  // Secondary line: "Ahmad Razali · RM 340.00"
  status?: string;   // Badge: "APPROVED", "SUBMITTED", etc.
  link: string;      // Navigation: "/tuntutan/<id>"
};

export type SearchResponse = {
  claims: SearchResult[];
  receipts: SearchResult[];
  users: SearchResult[];   // empty for non-ADMIN
  audit: SearchResult[];   // empty for non-ADMIN
};

const EMPTY: SearchResponse = { claims: [], receipts: [], users: [], audit: [] };

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 3) {
    return NextResponse.json(EMPTY);
  }

  const trimmed = q.trim();
  const { id: userId, roles, departmentId } = session.user;
  const deptId = departmentId ?? null;

  const isAdmin     = roles.includes(Role.ADMIN);
  const isHead      = roles.includes(Role.HEAD);
  const isSupervisor =
    isAdmin ||
    roles.includes(Role.FINANCE) ||
    roles.includes(Role.APPROVER) ||
    roles.includes(Role.YDP);

  const [claims, receipts, users, audit] = await Promise.all([
    searchClaims(trimmed, userId, deptId, isHead, isSupervisor),
    searchReceipts(trimmed, userId, deptId, isHead, isSupervisor),
    isAdmin ? searchUsers(trimmed)  : Promise.resolve([]),
    isAdmin ? searchAudit(trimmed)  : Promise.resolve([]),
  ]);

  return NextResponse.json({ claims, receipts, users, audit } satisfies SearchResponse);
}

// ─── Stub functions (replaced in Task 3 & 4) ─────────────────────────────────

async function searchClaims(
  _q: string, _userId: string, _deptId: string | null,
  _isHead: boolean, _isSupervisor: boolean
): Promise<SearchResult[]> { return []; }

async function searchReceipts(
  _q: string, _userId: string, _deptId: string | null,
  _isHead: boolean, _isSupervisor: boolean
): Promise<SearchResult[]> { return []; }

async function searchUsers(_q: string): Promise<SearchResult[]> { return []; }

async function searchAudit(_q: string): Promise<SearchResult[]> { return []; }
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and test scaffold via browser DevTools**

```bash
npm run dev
```

Log in at `http://localhost:3000/login`. Open any authenticated page. In browser DevTools console:

```javascript
// q < 3 chars → early return
fetch('/api/search?q=tu').then(r=>r.json()).then(console.log)
// Expected: {"claims":[],"receipts":[],"users":[],"audit":[]}

// q >= 3 chars → stubs return empty (not yet implemented)
fetch('/api/search?q=tun').then(r=>r.json()).then(console.log)
// Expected: {"claims":[],"receipts":[],"users":[],"audit":[]}
```

---

## Task 3: API Route — Claim + Receipt Queries

**Files:**
- Modify: `src/app/api/search/route.ts`

- [ ] **Step 1: Replace `searchClaims` stub with full implementation**

Replace the `searchClaims` stub function (lines from `async function searchClaims` to its closing `}`) with:

```typescript
// Raw row type — $queryRaw returns Decimal as string, cast::text in SQL
type RawClaim = {
  id: string;
  refNo: string;
  status: string;
  totalClaimedMyr: string;  // Decimal → string via ::text cast
  forMonth: number;
  forYear: number;
  claimantName: string;
};

async function searchClaims(
  q: string,
  userId: string,
  deptId: string | null,
  isHead: boolean,
  isSupervisor: boolean
): Promise<SearchResult[]> {
  let rows: RawClaim[];

  if (isSupervisor) {
    // FINANCE / APPROVER / YDP / ADMIN — no scope filter
    rows = await prisma.$queryRaw<RawClaim[]>`
      SELECT c.id, c."refNo", c.status::text, c."totalClaimedMyr"::text,
             c."forMonth", c."forYear", u.name AS "claimantName"
      FROM "Claim" c
      JOIN "User" u ON u.id = c."claimantId"
      WHERE (
        to_tsvector('simple', coalesce(c."refNo",'') || ' ' || coalesce(c."voucherNo",''))
          @@ plainto_tsquery('simple', ${q})
        OR u.name ILIKE ${'%' + q + '%'}
      )
      ORDER BY ts_rank(
        to_tsvector('simple', coalesce(c."refNo",'') || ' ' || coalesce(c."voucherNo",'')),
        plainto_tsquery('simple', ${q})
      ) DESC NULLS LAST
      LIMIT 5
    `;
  } else if (isHead && deptId) {
    // HEAD with a department — own claims + jabatan claims
    rows = await prisma.$queryRaw<RawClaim[]>`
      SELECT c.id, c."refNo", c.status::text, c."totalClaimedMyr"::text,
             c."forMonth", c."forYear", u.name AS "claimantName"
      FROM "Claim" c
      JOIN "User" u ON u.id = c."claimantId"
      WHERE (
        to_tsvector('simple', coalesce(c."refNo",'') || ' ' || coalesce(c."voucherNo",''))
          @@ plainto_tsquery('simple', ${q})
        OR u.name ILIKE ${'%' + q + '%'}
      )
      AND (c."claimantId" = ${userId} OR c."departmentId" = ${deptId})
      ORDER BY ts_rank(
        to_tsvector('simple', coalesce(c."refNo",'') || ' ' || coalesce(c."voucherNo",'')),
        plainto_tsquery('simple', ${q})
      ) DESC NULLS LAST
      LIMIT 5
    `;
  } else {
    // CLAIMANT or HEAD without departmentId — own claims only
    rows = await prisma.$queryRaw<RawClaim[]>`
      SELECT c.id, c."refNo", c.status::text, c."totalClaimedMyr"::text,
             c."forMonth", c."forYear", u.name AS "claimantName"
      FROM "Claim" c
      JOIN "User" u ON u.id = c."claimantId"
      WHERE (
        to_tsvector('simple', coalesce(c."refNo",'') || ' ' || coalesce(c."voucherNo",''))
          @@ plainto_tsquery('simple', ${q})
        OR u.name ILIKE ${'%' + q + '%'}
      )
      AND c."claimantId" = ${userId}
      ORDER BY ts_rank(
        to_tsvector('simple', coalesce(c."refNo",'') || ' ' || coalesce(c."voucherNo",'')),
        plainto_tsquery('simple', ${q})
      ) DESC NULLS LAST
      LIMIT 5
    `;
  }

  return rows.map((r) => ({
    id: r.id,
    type: "claim" as const,
    label: r.refNo,
    sublabel: `${r.claimantName} · RM ${Number(r.totalClaimedMyr).toFixed(2)}`,
    status: r.status,
    link: `/tuntutan/${r.id}`,
  }));
}
```

- [ ] **Step 2: Replace `searchReceipts` stub with full implementation**

Replace the `searchReceipts` stub with:

```typescript
type RawReceipt = {
  id: string;
  vendor: string | null;
  status: string;
  totalMyr: string | null;  // Decimal → string via ::text cast
  ownerName: string;
};

async function searchReceipts(
  q: string,
  userId: string,
  deptId: string | null,
  isHead: boolean,
  isSupervisor: boolean
): Promise<SearchResult[]> {
  let rows: RawReceipt[];

  if (isSupervisor) {
    rows = await prisma.$queryRaw<RawReceipt[]>`
      SELECT r.id, r.vendor, r.status::text, r."totalMyr"::text, u.name AS "ownerName"
      FROM "Receipt" r
      JOIN "User" u ON u.id = r."ownerId"
      WHERE to_tsvector('simple', coalesce(r.vendor,''))
        @@ plainto_tsquery('simple', ${q})
      ORDER BY r."createdAt" DESC
      LIMIT 5
    `;
  } else if (isHead && deptId) {
    // HEAD — own receipts + receipts attached to jabatan claims
    rows = await prisma.$queryRaw<RawReceipt[]>`
      SELECT r.id, r.vendor, r.status::text, r."totalMyr"::text, u.name AS "ownerName"
      FROM "Receipt" r
      JOIN "User" u ON u.id = r."ownerId"
      LEFT JOIN "Claim" c ON c.id = r."claimId"
      WHERE to_tsvector('simple', coalesce(r.vendor,''))
        @@ plainto_tsquery('simple', ${q})
      AND (r."ownerId" = ${userId} OR c."departmentId" = ${deptId})
      ORDER BY r."createdAt" DESC
      LIMIT 5
    `;
  } else {
    rows = await prisma.$queryRaw<RawReceipt[]>`
      SELECT r.id, r.vendor, r.status::text, r."totalMyr"::text, u.name AS "ownerName"
      FROM "Receipt" r
      JOIN "User" u ON u.id = r."ownerId"
      WHERE to_tsvector('simple', coalesce(r.vendor,''))
        @@ plainto_tsquery('simple', ${q})
      AND r."ownerId" = ${userId}
      ORDER BY r."createdAt" DESC
      LIMIT 5
    `;
  }

  return rows.map((r) => ({
    id: r.id,
    type: "receipt" as const,
    label: r.vendor ?? "(Tiada nama)",
    sublabel: `${r.ownerName} · RM ${r.totalMyr ? Number(r.totalMyr).toFixed(2) : "?"}`,
    status: r.status,
    link: `/resit/${r.id}`,
  }));
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual test — claims + receipts search**

With dev server running, log in as a CLAIMANT user who has at least one claim and receipt. In browser DevTools console:

```javascript
fetch('/api/search?q=TUN').then(r=>r.json()).then(console.log)
```

Expected: `claims` array non-empty with `refNo`, `status`, `sublabel` fields populated. `receipts` may be non-empty if vendor matches. `users` and `audit` still empty (stubs, removed in Task 4).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/search/route.ts
git commit -m "feat: search route — claim and receipt FTS queries"
```

---

## Task 4: API Route — User + AuditLog Queries + Final Commit

**Files:**
- Modify: `src/app/api/search/route.ts`

- [ ] **Step 1: Replace `searchUsers` stub**

Replace the `searchUsers` stub with:

```typescript
type RawUser = {
  id: string;
  name: string;
  email: string;
  staffNo: string | null;
  rolesArr: string | null;  // string_agg result, null if no roles
};

async function searchUsers(q: string): Promise<SearchResult[]> {
  const rows = await prisma.$queryRaw<RawUser[]>`
    SELECT u.id, u.name, u.email, u."staffNo",
           string_agg(ur.role::text, ', ' ORDER BY ur.role::text) AS "rolesArr"
    FROM "User" u
    LEFT JOIN "UserRole" ur ON ur."userId" = u.id
    WHERE to_tsvector('simple',
        coalesce(u.name,'') || ' ' ||
        coalesce(u.email,'') || ' ' ||
        coalesce(u."staffNo",'')
      ) @@ plainto_tsquery('simple', ${q})
    AND u."deletedAt" IS NULL
    GROUP BY u.id
    ORDER BY u.name
    LIMIT 5
  `;

  return rows.map((r) => ({
    id: r.id,
    type: "user" as const,
    label: r.name,
    sublabel: `${r.email}${r.rolesArr ? ` · ${r.rolesArr}` : ""}`,
    link: `/admin/pengguna/${r.id}`,
  }));
}
```

- [ ] **Step 2: Replace `searchAudit` stub**

Replace the `searchAudit` stub with:

```typescript
type RawAudit = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorName: string | null;
};

async function searchAudit(q: string): Promise<SearchResult[]> {
  const rows = await prisma.$queryRaw<RawAudit[]>`
    SELECT id, action, entity, "entityId", "actorName"
    FROM "AuditLog"
    WHERE to_tsvector('simple',
        coalesce("actorName",'') || ' ' ||
        coalesce(action,'') || ' ' ||
        coalesce(entity,'') || ' ' ||
        coalesce("entityId",'')
      ) @@ plainto_tsquery('simple', ${q})
    ORDER BY "createdAt" DESC
    LIMIT 5
  `;

  return rows.map((r) => ({
    id: r.id,
    type: "audit" as const,
    label: `${r.action} · ${r.entity}`,
    sublabel: r.actorName ?? "System",
    link: `/admin/audit`,
  }));
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual test — ADMIN full search**

Log in as ADMIN. Open browser DevTools → Network. Navigate to any page. Run in console:

```javascript
fetch('/api/search?q=Ahmad').then(r=>r.json()).then(console.log)
```

Expected: all 4 arrays (`claims`, `receipts`, `users`, `audit`) may be non-empty depending on seed data. No errors in response.

Test with a query < 3 chars:

```javascript
fetch('/api/search?q=ah').then(r=>r.json()).then(console.log)
```

Expected: `{"claims":[],"receipts":[],"users":[],"audit":[]}` (early return).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/search/route.ts
git commit -m "feat: global search API route — FTS queries for claims, receipts, users, audit"
```

---

## Task 5: Layout Header + GlobalSearch Component

**Files:**
- Create: `src/components/global-search.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Create `src/components/global-search.tsx`**

```typescript
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchResponse, SearchResult } from "@/app/api/search/route";

// ─── Status badge colour map ──────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  APPROVED:         "bg-green-100 text-green-700",
  PAID:             "bg-green-100 text-green-700",
  ARCHIVED:         "bg-green-100 text-green-700",
  SUBMITTED:        "bg-yellow-100 text-yellow-700",
  HEAD_APPROVED:    "bg-yellow-100 text-yellow-700",
  FINANCE_REVIEWED: "bg-blue-100 text-blue-700",
  REJECTED:         "bg-red-100 text-red-700",
  WITHDRAWN:        "bg-gray-100 text-gray-500",
  DRAFT:            "bg-gray-100 text-gray-500",
  UNSORTED:         "bg-gray-100 text-gray-500",
  ATTACHED:         "bg-gray-100 text-gray-500",
};

// ─── Result section ───────────────────────────────────────────────────────────

function ResultSection({
  title,
  items,
  onSelect,
  adminOnly = false,
}: {
  title: string;
  items: SearchResult[];
  onSelect: (link: string) => void;
  adminOnly?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="px-4 py-1.5 flex items-center gap-2">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
          {title} ({items.length})
        </span>
        {adminOnly && (
          <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">
            ADMIN
          </span>
        )}
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.link)}
          className="w-full text-left px-4 py-2.5 hover:bg-green-50 border-b border-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 mb-0.5">
            {item.status && (
              <span
                className={cn(
                  "text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0",
                  STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-500"
                )}
              >
                {item.status}
              </span>
            )}
            <span className="text-xs font-semibold text-gray-800 truncate">
              {item.label}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 truncate">{item.sublabel}</p>
        </button>
      ))}
    </div>
  );
}

// ─── GlobalSearch ─────────────────────────────────────────────────────────────

export function GlobalSearch() {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<SearchResponse | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router      = useRouter();

  // Ctrl+K → focus + open; ESC → clear + close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        if (query.length >= 3 && results) setPanelOpen(true);
      }
      if (e.key === "Escape") {
        setPanelOpen(false);
        setQuery("");
        setResults(null);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [query, results]);

  // Debounced search — fires 300 ms after last keystroke when query ≥ 3 chars
  const handleChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 3) {
      setPanelOpen(false);
      setResults(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`);
        if (!res.ok) throw new Error("fetch failed");
        const data: SearchResponse = await res.json();
        setResults(data);
        setPanelOpen(true);
      } catch {
        setError("Ralat semasa mencari. Cuba lagi.");
        setPanelOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleResultClick = (link: string) => {
    router.push(link);
    setPanelOpen(false);
    setQuery("");
    setResults(null);
  };

  const clearSearch = () => {
    setQuery("");
    setResults(null);
    setPanelOpen(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  const hasResults =
    results &&
    (results.claims.length > 0 ||
      results.receipts.length > 0 ||
      results.users.length > 0 ||
      results.audit.length > 0);

  return (
    <>
      {/* ── Search input bar (lives inside header) ── */}
      <div className="relative flex-1 max-w-[500px]">
        <div
          className={cn(
            "flex items-center gap-2 bg-gray-50 border rounded-lg h-9 px-3 transition-colors",
            panelOpen ? "border-green-700" : "border-gray-200 focus-within:border-green-700"
          )}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Cari tuntutan, resit, pengguna..."
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
          />
          {query ? (
            <button onClick={clearSearch} className="flex-shrink-0 p-0.5">
              <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          ) : (
            <kbd className="flex-shrink-0 text-xs text-gray-400 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 font-sans">
              Ctrl+K
            </kbd>
          )}
        </div>
      </div>

      {/* ── Slide-in results panel ── */}
      {panelOpen && (
        <div className="fixed right-0 top-14 bottom-0 w-[320px] z-30 bg-white border-l border-gray-200 shadow-xl flex flex-col">
          {/* Panel header */}
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 truncate">
              Keputusan: &quot;{query}&quot;
            </span>
            <button
              onClick={clearSearch}
              className="text-xs text-gray-400 hover:text-gray-600 bg-gray-100 rounded px-1.5 py-0.5 flex-shrink-0"
            >
              ESC ✕
            </button>
          </div>

          {/* Results area */}
          <div className="flex-1 overflow-y-auto">
            {error && (
              <p className="text-sm text-red-500 text-center py-8 px-4">{error}</p>
            )}
            {!error && results && !hasResults && (
              <p className="text-sm text-gray-400 text-center py-8 px-4">
                Tiada keputusan untuk &quot;{query}&quot;
              </p>
            )}
            {!error && results && hasResults && (
              <>
                <ResultSection
                  title="Tuntutan"
                  items={results.claims}
                  onSelect={handleResultClick}
                />
                <ResultSection
                  title="Resit"
                  items={results.receipts}
                  onSelect={handleResultClick}
                />
                <ResultSection
                  title="Pengguna"
                  items={results.users}
                  onSelect={handleResultClick}
                  adminOnly
                />
                <ResultSection
                  title="Audit"
                  items={results.audit}
                  onSelect={handleResultClick}
                  adminOnly
                />
              </>
            )}
          </div>

          {/* Panel footer */}
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400 text-center">
              Klik result untuk navigate · ESC untuk tutup
            </p>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Modify `src/app/(app)/layout.tsx`**

Add the import after the existing imports block:

```typescript
import { GlobalSearch } from "@/components/global-search";
```

Replace the `return` statement:

```typescript
  return (
    <SessionProvider session={session}>
      <div className="flex min-h-screen bg-gray-50">
        <AppSidebar unreadCount={unreadCount} />
        <div className="flex-1 ml-64 flex flex-col min-h-screen">
          <header className="h-14 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40 flex items-center px-6">
            <GlobalSearch />
          </header>
          <main className="flex-1">
            <div className="p-6 max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Visual verification**

With dev server running, log in and navigate to `/dashboard`. Verify:

1. Header bar visible below sidebar logo, above page content
2. Search input shows placeholder "Cari tuntutan, resit, pengguna..."
3. `Ctrl+K` badge visible on right of input
4. Type ≥ 3 chars → loading spinner appears → results panel slides in from right
5. Results grouped by section with status badges
6. Click a result → navigates to that page, panel closes
7. Press `ESC` → panel closes, input clears
8. Type < 3 chars → panel closes
9. Log in as ADMIN → search → Pengguna + Audit sections appear with ADMIN pill

- [ ] **Step 5: Commit**

```bash
git add src/components/global-search.tsx src/app/(app)/layout.tsx
git commit -m "feat: global search UI — header bar + slide-in panel"
```

---

## Self-Review Checklist

After all tasks:

- [ ] All 4 GIN indexes deployed (`prisma migrate deploy` output confirms)
- [ ] `GET /api/search?q=<2chars>` returns `EMPTY` (no query)
- [ ] `GET /api/search?q=<3chars>` returns grouped results
- [ ] CLAIMANT sees only own claims/receipts
- [ ] HEAD with dept sees own + jabatan
- [ ] ADMIN sees all 4 entity types
- [ ] `Ctrl+K` focuses input from any page
- [ ] `ESC` closes panel and clears input
- [ ] Click result navigates and closes panel
- [ ] `npx tsc --noEmit` passes with zero errors
