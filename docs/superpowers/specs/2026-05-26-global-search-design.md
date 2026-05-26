# Global Search — Design Spec
**Date:** 2026-05-26  
**Status:** Approved

---

## Overview

Full-text global search across Claims, Receipts, Users, and Audit Logs. Triggered from a persistent header bar above all authenticated pages. Results appear in a slide-in panel from the right.

---

## Scope

### What is searchable

| Entity | Fields searched | Role access |
|--------|----------------|-------------|
| Claim | refNo, voucherNo, claimant name | Role-scoped (see below) |
| Receipt | vendor name | Role-scoped (see below) |
| User | name, email, staffNo | ADMIN only |
| AuditLog | actorName, action, entity, entityId | ADMIN only |

### Role scoping

| Role | Claims | Receipts | Users | Audit |
|------|--------|----------|-------|-------|
| CLAIMANT | Own only | Own only | ✗ | ✗ |
| HEAD | Own + jabatan | Own + jabatan | ✗ | ✗ |
| FINANCE | All | All | ✗ | ✗ |
| APPROVER | All | All | ✗ | ✗ |
| YDP | All | All | ✗ | ✗ |
| ADMIN | All | All | ✓ | ✓ |

HEAD jabatan scope: claims/receipts where `departmentId = user.departmentId`. If HEAD has no `departmentId` set, falls back to own claims/receipts only (same as CLAIMANT).

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `src/components/global-search.tsx` | Client Component — header search input + slide-in panel |
| `src/app/api/search/route.ts` | Route Handler — `GET /api/search?q=` |
| `prisma/migrations/20260526000000_add_search_gin_indexes/migration.sql` | Expression GIN indexes — no schema column changes |

### Modified files

| File | Change |
|------|--------|
| `src/app/(app)/layout.tsx` | Add header bar `h-14`, render `<GlobalSearch />` |

### No changes to

- `prisma/schema.prisma` — no new columns
- `src/components/app-sidebar.tsx` — sidebar unchanged

---

## Database

Expression GIN indexes using `'simple'` dictionary (no stemming — correct for Malay names and ref numbers):

```sql
CREATE INDEX claim_fts_idx ON "Claim" USING GIN (
  to_tsvector('simple',
    coalesce("refNo", '') || ' ' ||
    coalesce("voucherNo", '')
  )
);

CREATE INDEX receipt_fts_idx ON "Receipt" USING GIN (
  to_tsvector('simple', coalesce(vendor, ''))
);

CREATE INDEX user_fts_idx ON "User" USING GIN (
  to_tsvector('simple',
    coalesce(name, '') || ' ' ||
    coalesce(email, '') || ' ' ||
    coalesce("staffNo", '')
  )
);

CREATE INDEX auditlog_fts_idx ON "AuditLog" USING GIN (
  to_tsvector('simple',
    coalesce("actorName", '') || ' ' ||
    coalesce(action, '') || ' ' ||
    coalesce(entity, '') || ' ' ||
    coalesce("entityId", '')
  )
);
```

**Why `'simple'`:** Tokenises and lowercases only. No English stemming applied to Malay words or alphanumeric ref numbers.

**Cross-table name search (claimant name in claim results):** JOIN `User` in query, `u.name ILIKE '%q%'` as OR fallback. GIN index covers refNo/voucherNo; ILIKE covers name. Sequential scan acceptable at MDS scale (< 1000 claims).

---

## API Route — `src/app/api/search/route.ts`

```
GET /api/search?q=<query>
```

**Validation:**
- No session → 401
- `q` length < 3 → return `{ claims: [], receipts: [], users: [], audit: [] }`
- Max 5 results per entity type

**Query pattern (Claim):**
```sql
SELECT c.id, c."refNo", c.status, c."totalClaimedMyr",
       c."forMonth", c."forYear", u.name AS "claimantName",
       ts_rank(
         to_tsvector('simple', coalesce(c."refNo",'') || ' ' || coalesce(c."voucherNo",'')),
         plainto_tsquery('simple', $1)
       ) AS rank
FROM "Claim" c
JOIN "User" u ON u.id = c."claimantId"
WHERE (
  to_tsvector('simple', coalesce(c."refNo",'') || ' ' || coalesce(c."voucherNo",''))
    @@ plainto_tsquery('simple', $1)
  OR u.name ILIKE '%' || $1 || '%'
)
-- role_filter examples (applied per role in route.ts):
-- CLAIMANT:  AND c."claimantId" = '<userId>'
-- HEAD:      AND (c."claimantId" = '<userId>' OR c."departmentId" = '<deptId>')
--            (if no deptId: AND c."claimantId" = '<userId>')
-- FINANCE / APPROVER / YDP / ADMIN: (no filter — all claims)
ORDER BY rank DESC NULLS LAST
LIMIT 5
```

**Response shape:**
```typescript
type SearchResult = {
  id: string
  type: "claim" | "receipt" | "user" | "audit"
  label: string       // Primary display: "TUN-2026-0042"
  sublabel: string    // Secondary: "Ahmad Razali · RM 340.00"
  status?: string     // "APPROVED", "SUBMITTED", etc.
  link: string        // Navigation target: "/tuntutan/<id>"
}

type SearchResponse = {
  claims: SearchResult[]
  receipts: SearchResult[]
  users: SearchResult[]   // empty array for non-ADMIN
  audit: SearchResult[]   // empty array for non-ADMIN
}
```

All four parallel queries run via `Promise.all`. Only ADMIN queries include Users and AuditLog.

---

## UI — `src/components/global-search.tsx`

**Client Component.** Owns all search state: query string, results, panel open/closed, loading state.

### Header search bar

- Width: `max-w-[500px] flex-1`, centered in header
- Placeholder: `"Cari tuntutan, resit, pengguna..."`
- Trailing keyboard hint badge: `Ctrl+K`
- Border highlights green (`border-green-700`) when focused
- Loading spinner replaces search icon while fetching

### Slide-in panel

- `position: fixed`, right-0, `w-[320px]`, `top-14` (56px — below header), `bottom-0`
- `z-30` — below header (`z-40`), above page content
- Shadow: `shadow-xl border-l border-gray-200`
- Opens when: query ≥ 3 chars + results fetched, OR Ctrl+K pressed
- Closes when: ESC pressed, query cleared to < 3 chars, result clicked
- No backdrop — page content remains fully visible and interactive behind panel

### Result item

- Status badge (coloured by status — reuse existing badge colour logic)
- Label (bold, green for Claim/Receipt, gray for User/Audit)
- Sublabel (muted, single line truncated)
- Full row clickable → `router.push(link)` → panel closes

### Panel sections

Show only non-empty sections. Each section header shows entity name + count:  
`TUNTUTAN (2)` / `RESIT (3)` / `PENGGUNA (1)` / `AUDIT (1)`

ADMIN-only sections (Pengguna, Audit) show `ADMIN` pill next to heading.

### Empty state

If all arrays empty: `"Tiada keputusan untuk '<query>'"` centered in panel.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+K` | Focus search input, open panel |
| `ESC` | Close panel, clear input, blur |
| `↑` / `↓` | (v2 — not in this sprint) keyboard nav through results |

---

## Layout change — `src/app/(app)/layout.tsx`

Current structure:
```
<div class="flex min-h-screen bg-gray-50">
  <AppSidebar />
  <main class="flex-1 ml-64 min-h-screen">
    <div class="p-6 max-w-7xl mx-auto">{children}</div>
  </main>
</div>
```

New structure:
```
<div class="flex min-h-screen bg-gray-50">
  <AppSidebar />
  <div class="flex-1 ml-64 flex flex-col min-h-screen">
    <header class="h-14 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40 flex items-center px-6">
      <GlobalSearch />
    </header>
    <main class="flex-1">
      <div class="p-6 max-w-7xl mx-auto">{children}</div>
    </main>
  </div>
</div>
```

Header is `sticky top-0` — stays visible on scroll.

---

## Search behaviour

| Trigger | Behaviour |
|---------|-----------|
| Type ≥ 3 chars | Debounce 300ms → fetch → open panel |
| Type < 3 chars | Panel closes immediately, no fetch |
| `Ctrl+K` | Focus input, open panel (fetch if query already ≥ 3 chars) |
| `ESC` | Close panel, clear input |
| Click result | `router.push(link)`, close panel |
| Click outside panel | Close panel, preserve input value |

---

## Error handling

- Fetch error (network / 500): show `"Ralat semasa mencari. Cuba lagi."` in panel
- 401: should not occur (layout already guards auth), but if it does → silent empty state
- Empty results: `"Tiada keputusan untuk '<query>'"` message

---

## Out of scope (this sprint)

- Keyboard navigation (`↑`/`↓`) through results
- Search history / recent searches
- Filter by entity type (chips above results)
- Saved searches
