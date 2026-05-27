# Bulk Export Implementation Design

## Goal

Finance (and Admin) can select multiple claims and export them as Excel, PDF summary list, or merged PDF cover sheets — from both the Semakan Kewangan page and the Laporan page.

## Architecture

### New API routes (all POST, body `{ ids: string[] }`)

| Route | Output | Auth |
|---|---|---|
| `POST /api/export/claims/excel` | `.xlsx` summary | Finance or Admin |
| `POST /api/export/claims/pdf/summary` | Summary list PDF | Finance or Admin |
| `POST /api/export/claims/pdf/coversheets` | Merged cover sheets PDF | Finance or Admin |

**Validation (shared across all three routes):**
- `ids` must be a non-empty array of strings → 400 if empty
- `ids.length > 200` → 400 with message "Terlalu banyak tuntutan (maks 200)"
- Claim IDs not found in DB are silently skipped (export what exists)
- DB error → 500

**Filename conventions:**
- Excel: `eksport-tuntutan-YYYY-MM-DD.xlsx`
- PDF summary: `eksport-ringkasan-YYYY-MM-DD.pdf`
- PDF cover sheets: `eksport-coversheet-YYYY-MM-DD.pdf`

Where `YYYY-MM-DD` is the server date at time of export.

### New lib function

**`src/lib/pdf/cover-sheet.tsx`** — add `generateBulkCoverSheets`:

```ts
export async function generateBulkCoverSheets(claims: CoverSheetData[]): Promise<Buffer>
```

Renders a single `<Document>` with one `<Page>` block per claim (same JSX as `generateCoverSheet` internals, repeated N times). One `renderToBuffer` call — no PDF merging library needed. Returns empty-document buffer if `claims` is empty.

### Reused lib functions (no changes needed)

- `generateLaporan(rows, filterLabel, orgName)` → `src/lib/excel/laporan.ts` — Excel
- `generateLaporanPdf(rows, label, orgName)` → `src/lib/pdf/laporan.tsx` — PDF summary
- Both accept `ClaimRow[]` (already defined in `src/lib/excel/laporan.ts`)

**Filter label for bulk exports:** `"Pilihan (N tuntutan)"` where N is `ids.length`.

### New shared component

**`src/components/export-button.tsx`** — `"use client"`:

```tsx
interface ExportButtonProps {
  getIds: () => string[];        // called at click time
  disabled?: boolean;
}
```

Renders a shadcn `DropdownMenu` button labelled "Eksport ▾" with three items:
1. **📊 Excel** → POST `/api/export/claims/excel`
2. **📄 PDF Ringkasan** → POST `/api/export/claims/pdf/summary`
3. **📋 PDF Cover Sheets** → POST `/api/export/claims/pdf/coversheets`

Each item has independent loading state (spinner replaces icon while in-flight). On click:
1. Call `getIds()` — if empty array, show sonner toast "Pilih sekurang-kurangnya satu tuntutan" and abort
2. POST `{ ids }` to route
3. On non-2xx: show sonner toast with error message
4. On success: `response.blob()` → `URL.createObjectURL` → programmatic `<a download>` click → `URL.revokeObjectURL`

### Modified files

#### `src/app/(app)/semakan/_components/bulk-paid-panel.tsx`

Current: checkboxes only on APPROVED queue (Menunggu Pembayaran). 

**Change:** Lift selection state out of `BulkPaidPanel` into a new `SemukanClient` wrapper so it spans both queues. Keep "Tandakan Dibayar" action scoped to APPROVED-only claims in selection.

#### `src/app/(app)/semakan/page.tsx`

Extract both queues into `<SemukanClient reviewClaims={...} approvedClaims={...} />` client component. Server page remains a thin data-fetching shell.

**`SemukanClient` layout:**
- Two card sections (Menunggu Semakan + Menunggu Pembayaran), each with checkboxes
- Shared `selected: Set<string>` state across both
- When `selected.size > 0`: show green summary card (existing pattern) with:
  - Count + total RM
  - `<ExportButton getIds={() => [...selected]} />` (all selected regardless of status)
  - "Tandakan Dibayar (N)" button — N = count of selected that are APPROVED status

#### `src/app/(app)/laporan/_components/laporan-table.tsx` (new)

`"use client"` component. Receives `claims: LaporanClaimItem[]` as props from server page.

- Adds checkbox column to existing table
- Select-all checkbox in header
- `selected: Set<string>` local state
- When `selected.size > 0`: blue inline toolbar appears between filter and table:
  - Text: "N baris dipilih"
  - `<ExportButton getIds={() => [...selected]} />`
  - "Nyahpilih" link to clear selection
- When `selected.size === 0`: toolbar hidden

**`LaporanClaimItem`** — props shape (derived from server query, same fields as current table renders):
```ts
interface LaporanClaimItem {
  id: string;
  refNo: string;
  claimantName: string;
  departmentName: string | null;
  forMonth: number;
  forYear: number;
  status: string;
  totalClaimedMyr: number;
  totalApprovedMyr: number | null;
}
```

#### `src/app/(app)/laporan/page.tsx`

Pass `claims` to `<LaporanTable claims={...} />`. Keep existing "PDF" and "Excel" buttons in page header (full filtered export — unchanged).

## UI Decisions

### /semakan — green summary card (extends existing pattern)

```
[ 3 dipilih · RM 950.00                                         ]
[ [Eksport ▾]    [Tandakan Dibayar (2)]                         ]
```

"Tandakan Dibayar" count shows only APPROVED claims in current selection. Clicking it works as before (calls `markPaidBulk` with APPROVED-only IDs). ExportButton exports all selected IDs regardless of status.

### /laporan — blue inline toolbar

```
┌─────────────────────────────────────────────────────────────┐
│ Filter bar (existing LaporanFilter component — unchanged)    │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐  ← appears only when selected.size > 0
│  3 baris dipilih   [Eksport ▾]   [Nyahpilih]               │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ Claims table (checkboxes added to left column)               │
└─────────────────────────────────────────────────────────────┘
```

Existing PDF/Excel buttons in page header remain for full-filtered export.

## Data fetching in routes

All three routes use the same Prisma query:

```ts
const claims = await prisma.claim.findMany({
  where: { id: { in: ids } },
  include: {
    claimant: true,
    department: true,
    receipts: { include: { items: true }, orderBy: { receiptDate: "asc" } },
    approvals: { include: { actor: { select: { name: true } } }, orderBy: { decidedAt: "asc" } },
  },
  orderBy: { submittedAt: "asc" },
});
```

Excel and PDF summary routes only need summary fields — the full include is fine (slight over-fetch). Cover sheets route needs full include including receipt items and approvals.

`org_name` setting fetched from `prisma.settings` in each route (same as existing single-PDF and laporan routes).

## Error handling

| Condition | Response |
|---|---|
| Not authenticated | 401 JSON |
| Not Finance or Admin | 403 JSON |
| `ids` empty or missing | 400 JSON `"ids array required"` |
| `ids.length > 200` | 400 JSON `"Terlalu banyak tuntutan (maks 200)"` |
| All IDs not found | 200 with empty export (0 rows) |
| DB error | 500 JSON |
| Client non-2xx | sonner toast "Gagal eksport. Cuba lagi." |

## Testing

No automated tests for file output (binary output is hard to unit test in this stack). Manual smoke test:

1. `/semakan` — select claims from both queues, click Eksport → each format downloads correctly
2. `/semakan` — select mix of HEAD_APPROVED + APPROVED, confirm "Tandakan Dibayar" count matches APPROVED-only subset
3. `/laporan` — check rows, toolbar appears; Excel/PDF Ringkasan/Cover Sheets all download
4. `/laporan` — deselect all, toolbar disappears
5. Cover sheets PDF — open, verify each claim gets its own page with correct data and watermark
6. Attempt export with 0 selected — toast appears, no network request made
7. TSC clean after implementation
