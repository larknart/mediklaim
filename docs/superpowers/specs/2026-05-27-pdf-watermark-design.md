# PDF Watermark Design Spec

## Goal

Stamp diagonal watermarks on both PDF outputs:
- **Cover sheet** (`/api/tuntutan/[id]/pdf`): status-based stamp (final states only)
- **Laporan** (`/api/laporan/pdf`): fixed org identity mark on every page

## Architecture

Three files touched. No new npm dependencies. No DB settings. No route changes.

| File | Change |
|---|---|
| `src/lib/pdf/watermark.tsx` | New — two exported helper functions |
| `src/lib/pdf/cover-sheet.tsx` | Modify — insert `claimWatermark(data.status)` inside `<Page>` |
| `src/lib/pdf/laporan.tsx` | Modify — insert `reportWatermark(data.orgName)` inside `<Page>` |

## Watermark Style

**Style:** Single diagonal text, rotated −45°, centred on page.  
**Placement:** `position: 'absolute'`, top ~38% of page, full width, `textAlign: 'center'`.  
**Layer:** Last child inside `<Page>` — PDF painters model means it renders above page content.  
**Pagination:** `<View fixed>` — repeats on every page automatically (covers multi-page laporan).

## Cover Sheet Watermark (`claimWatermark`)

Signature:
```ts
export function claimWatermark(status: string): React.ReactElement | null
```

Returns `null` for non-final statuses (no watermark rendered for in-progress claims).

Status mapping:

| Status | Text | Colour | Opacity |
|---|---|---|---|
| `APPROVED` | DILULUSKAN | `#1c5e2f` (green) | 0.12 |
| `PAID` | DIBAYAR | `#1c5e2f` (green) | 0.12 |
| `REJECTED` | DITOLAK | `#c62828` (red) | 0.12 |
| `WITHDRAWN` | TARIK BALIK | `#888888` (grey) | 0.12 |
| anything else | — | — | no watermark |

Font: `Helvetica-Bold`, size 72, `transform: 'rotate(-45deg)'`.

## Laporan Watermark (`reportWatermark`)

Signature:
```ts
export function reportWatermark(orgName: string): React.ReactElement
```

Always rendered. Two lines stacked:
```
{orgName}
DOKUMEN RASMI
```

Colour: `#888888` (grey), opacity 0.10, font `Helvetica-Bold`, size 60.  
Slightly more subtle than cover sheet — laporan is a report, not a status-stamped document.  
`orgName` is already passed into `generateLaporanPdf(rows, label, orgName)` — no interface change needed.

## Data Flow

Cover sheet: `status` already present in `CoverSheetData.status` — no interface change.  
Laporan: `orgName` already in `LaporanPdfData.orgName`, already passed from route — no interface change.  
No route files touched.

## Testing

Manual verification (no automated test framework):

1. Download cover sheet for `PAID` claim → green `DIBAYAR` diagonal on page
2. Download cover sheet for `REJECTED` claim → red `DITOLAK` diagonal
3. Download cover sheet for `WITHDRAWN` claim → grey `TARIK BALIK` diagonal
4. Download cover sheet for `SUBMITTED` / `HEAD_APPROVED` / `FINANCE_REVIEWED` claim → no watermark
5. Download laporan → every page shows grey org name + `DOKUMEN RASMI` diagonal
