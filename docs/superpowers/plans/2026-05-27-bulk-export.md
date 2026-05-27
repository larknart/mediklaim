# Bulk Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finance and Admin can select multiple claims and download them as Excel, PDF summary, or merged cover-sheet PDF — from both the Semakan Kewangan and Laporan pages.

**Architecture:** Three new `POST /api/export/claims/[format]` routes accept `{ ids: string[] }`, fetch claim data, generate files using existing lib functions, and stream the result. A shared `ExportButton` client component handles the fetch-to-blob-download pattern with per-format loading state. `/semakan` is refactored into a unified `SemukanClient` with shared checkbox state across both queues; `/laporan` gains a new `LaporanTable` client component with a checkbox column and selection toolbar.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7, `@react-pdf/renderer`, `exceljs`, `sonner` (toasts), shadcn/ui (`DropdownMenu`, `Checkbox`, `Button`).

---

### Task 1: Add `generateBulkCoverSheets` to cover-sheet.tsx

**Files:**
- Modify: `src/lib/pdf/cover-sheet.tsx`

**Context:** `generateCoverSheet` currently wraps everything in `<Document><Page>…</Page></Document>`. For bulk, we need one `<Document>` with N `<Page>` elements — one per claim. The solution is to extract the page content into a `ClaimPage` component, then compose it in both the single and bulk document functions.

- [ ] **Step 1: Refactor `CoverSheet` component into `ClaimPage` + `CoverSheetDoc`**

In `src/lib/pdf/cover-sheet.tsx`, replace the `CoverSheet` function and `generateCoverSheet` with:

```tsx
// Extract page content into ClaimPage (returns <Page>, not <Document>)
function ClaimPage({ data }: { data: CoverSheetData }) {
  const generatedAt = new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" });

  return (
    <Page size="A4" style={s.page}>
      {/* Header */}
      <Text style={s.orgName}>{data.orgName}</Text>
      <Text style={s.title}>Borang Tuntutan Perubatan</Text>
      <View style={s.divider} />

      {/* Claim info */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Maklumat Tuntutan</Text>
        <InfoRow label="No. Rujukan" value={data.refNo} />
        <InfoRow label="Nama Pemohon" value={data.claimantName} />
        {data.staffNo && <InfoRow label="No. Kakitangan" value={data.staffNo} />}
        <InfoRow label="Jabatan" value={data.departmentName ?? "—"} />
        <InfoRow label="Tempoh Tuntutan" value={`${MONTHS_BM[data.forMonth - 1]} ${data.forYear}`} />
        <InfoRow label="Tarikh Hantar" value={data.submittedAt ? new Date(data.submittedAt).toLocaleDateString("ms-MY") : "—"} />
        <InfoRow label="Status" value={STATUS_BM[data.status] ?? data.status} />
      </View>

      {/* Receipts */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Senarai Resit</Text>
        {data.receipts.map((r, ri) => (
          <View key={ri}>
            <View style={s.receiptHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.receiptVendor}>{r.vendor ?? "Vendor tidak diketahui"}</Text>
                <Text style={{ fontSize: 7, color: "#3b82f6" }}>
                  {r.claimFor === "SPOUSE" ? "Isteri / Suami" : r.claimFor === "CHILD" ? `Anak ke-${r.claimForChildNo ?? 1}` : "Diri Sendiri"}
                </Text>
              </View>
              <Text style={s.receiptDate}>
                {r.receiptDate ? new Date(r.receiptDate).toLocaleDateString("ms-MY") : ""}
              </Text>
            </View>
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.th, s.colDesc]}>Perkara</Text>
                <Text style={[s.th, s.colQty]}>Qty</Text>
                <Text style={[s.th, s.colUnit]}>Unit (RM)</Text>
                <Text style={[s.th, s.colAmt]}>Amaun (RM)</Text>
                <Text style={[s.th, s.colStatus]}>Status</Text>
              </View>
              {r.items.map((item, ii) => (
                <View key={ii} style={ii % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <View style={s.colDesc}>
                    <Text style={item.isEligible ? s.td : s.tdStrike}>{item.description}</Text>
                    {item.flaggedReason && (
                      <Text style={{ fontSize: 7, color: "#c62828" }}>{item.flaggedReason}</Text>
                    )}
                  </View>
                  <Text style={[item.isEligible ? s.td : s.tdStrike, s.colQty]}>{item.qty}</Text>
                  <Text style={[item.isEligible ? s.td : s.tdStrike, s.colUnit]}>{item.unitMyr.toFixed(2)}</Text>
                  <Text style={[item.isEligible ? s.td : s.tdStrike, s.colAmt]}>{item.amountMyr.toFixed(2)}</Text>
                  <Text style={[s.td, s.colStatus, { color: item.isEligible ? "#1c5e2f" : "#c62828" }]}>
                    {item.isEligible ? "Layak" : "Tidak Layak"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      {/* Summary */}
      <View style={s.section}>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Jumlah Dituntut (RM)</Text>
          <Text style={s.summaryValue}>{data.totalClaimedMyr.toFixed(2)}</Text>
        </View>
        {data.totalEligibleMyr != null && (
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Jumlah Layak (RM)</Text>
            <Text style={s.summaryValue}>{data.totalEligibleMyr.toFixed(2)}</Text>
          </View>
        )}
        {data.totalApprovedMyr != null && (
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Jumlah Diluluskan (RM)</Text>
            <Text style={s.summaryValueGreen}>{data.totalApprovedMyr.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* Approval trail */}
      {data.approvals.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Rekod Kelulusan</Text>
          {data.approvals.map((apv, i) => {
            const isApproved = apv.decision === "APPROVED" || apv.decision === "SKIPPED";
            const isRejected = apv.decision === "REJECTED";
            const decisionStyle = isApproved ? s.decisionApproved : isRejected ? s.decisionRejected : s.decisionSkip;
            return (
              <View key={i} style={s.approvalRow}>
                <Text style={s.approvalStep}>{STEP_BM[apv.step] ?? apv.step}</Text>
                <View style={s.approvalActor}>
                  <Text>{apv.actorName}</Text>
                  {apv.comment && <Text style={{ fontSize: 7, color: "#666", fontStyle: "italic" }}>"{apv.comment}"</Text>}
                </View>
                <View style={{ width: 100, alignItems: "flex-end" }}>
                  <Text style={decisionStyle}>{DECISION_BM[apv.decision] ?? apv.decision}</Text>
                  <Text style={{ fontSize: 7, color: "#888" }}>{new Date(apv.decidedAt).toLocaleDateString("ms-MY")}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Signature block */}
      <View style={s.signatureBlock}>
        <View style={s.signatureBox}>
          <Text style={s.signatureLabel}>Tandatangan Pemohon</Text>
          <Text style={{ fontSize: 8, marginTop: 12 }}>{data.claimantName}</Text>
        </View>
        <View style={s.signatureBox}>
          <Text style={s.signatureLabel}>Disahkan Oleh</Text>
        </View>
        <View style={s.signatureBox}>
          <Text style={s.signatureLabel}>Cop Rasmi</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={s.footer} fixed>
        <Text style={s.footerText}>{data.orgName} — {data.refNo}</Text>
        <Text style={s.footerText}>Jana: {generatedAt}</Text>
      </View>

      {/* Watermark */}
      {claimWatermark(data.status)}
    </Page>
  );
}

// Single-claim document (used by existing /api/tuntutan/[id]/pdf)
function CoverSheetDoc({ data }: { data: CoverSheetData }) {
  return (
    <Document>
      <ClaimPage data={data} />
    </Document>
  );
}

// Multi-claim document (used by bulk export)
function BulkCoverSheetDoc({ claims }: { claims: CoverSheetData[] }) {
  return (
    <Document>
      {claims.map((data, i) => (
        <ClaimPage key={i} data={data} />
      ))}
    </Document>
  );
}

export async function generateCoverSheet(data: CoverSheetData): Promise<Buffer> {
  const buffer = await renderToBuffer(<CoverSheetDoc data={data} />);
  return Buffer.from(buffer);
}

export async function generateBulkCoverSheets(claims: CoverSheetData[]): Promise<Buffer> {
  const buffer = await renderToBuffer(<BulkCoverSheetDoc claims={claims} />);
  return Buffer.from(buffer);
}
```

The complete file after this change: keep everything above line 116 (`export interface CoverSheetData`) exactly as-is (imports, constants, `StyleSheet`, `InfoRow`). Replace everything from line 125 (`function CoverSheet`) to end-of-file with the code block above.

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf/cover-sheet.tsx
git commit -m "refactor: extract ClaimPage, add generateBulkCoverSheets"
```

---

### Task 2: Excel bulk export route

**Files:**
- Create: `src/app/api/export/claims/excel/route.ts`

**Context:** Reuses `generateLaporan` from `src/lib/excel/laporan.ts` and `ClaimRow` interface. Auth: Finance or Admin only. Body: `{ ids: string[] }`.

- [ ] **Step 1: Create the file**

Create `src/app/api/export/claims/excel/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin, isFinance } from "@/lib/permissions";
import { generateLaporan } from "@/lib/excel/laporan";
import type { ClaimRow } from "@/lib/excel/laporan";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!isFinance(session.user) && !isAdmin(session.user)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
  if (ids.length === 0) return NextResponse.json({ error: "ids array required" }, { status: 400 });
  if (ids.length > 200) return NextResponse.json({ error: "Terlalu banyak tuntutan (maks 200)" }, { status: 400 });

  const claims = await prisma.claim.findMany({
    where: { id: { in: ids } },
    include: {
      claimant: true,
      department: true,
      receipts: { select: { claimFor: true, claimForChildNo: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  const orgSetting = await prisma.settings.findUnique({ where: { key: "org_name" } });
  const orgName = String(orgSetting?.value ?? "Majlis Daerah Setiu");

  function beneficiarySummary(receipts: Array<{ claimFor: string; claimForChildNo: number | null }>): string {
    const labels = new Set(receipts.map((r) => {
      if (r.claimFor === "SPOUSE") return "Pasangan";
      if (r.claimFor === "CHILD") return `Anak ke-${r.claimForChildNo ?? 1}`;
      return "Diri";
    }));
    return [...labels].join(", ") || "Diri";
  }

  const rows: ClaimRow[] = claims.map((c) => ({
    refNo: c.refNo,
    claimantName: c.claimant.name,
    staffNo: c.claimant.staffNo,
    department: c.department?.name ?? null,
    forMonth: c.forMonth,
    forYear: c.forYear,
    claimFor: beneficiarySummary(c.receipts),
    claimForChildNo: null,
    status: c.status,
    totalClaimedMyr: Number(c.totalClaimedMyr),
    totalEligibleMyr: c.totalEligibleMyr ? Number(c.totalEligibleMyr) : null,
    totalApprovedMyr: c.totalApprovedMyr ? Number(c.totalApprovedMyr) : null,
    submittedAt: c.submittedAt,
    paidAt: c.paidAt,
    voucherNo: c.voucherNo,
  }));

  const date = new Date().toISOString().slice(0, 10);
  const buffer = await generateLaporan(rows, `Pilihan (${rows.length} tuntutan)`, orgName);
  const filename = `eksport-excel-${date}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/export/claims/excel/route.ts
git commit -m "feat: POST /api/export/claims/excel — bulk Excel export"
```

---

### Task 3: PDF summary bulk export route

**Files:**
- Create: `src/app/api/export/claims/pdf/summary/route.ts`

**Context:** Same structure as Task 2 but uses `generateLaporanPdf` from `src/lib/pdf/laporan.tsx`. Returns `application/pdf`.

- [ ] **Step 1: Create the file**

Create `src/app/api/export/claims/pdf/summary/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin, isFinance } from "@/lib/permissions";
import { generateLaporanPdf } from "@/lib/pdf/laporan";
import type { ClaimRow } from "@/lib/excel/laporan";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!isFinance(session.user) && !isAdmin(session.user)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
  if (ids.length === 0) return NextResponse.json({ error: "ids array required" }, { status: 400 });
  if (ids.length > 200) return NextResponse.json({ error: "Terlalu banyak tuntutan (maks 200)" }, { status: 400 });

  const claims = await prisma.claim.findMany({
    where: { id: { in: ids } },
    include: {
      claimant: true,
      department: true,
      receipts: { select: { claimFor: true, claimForChildNo: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  const orgSetting = await prisma.settings.findUnique({ where: { key: "org_name" } });
  const orgName = String(orgSetting?.value ?? "Majlis Daerah Setiu");

  function beneficiarySummary(receipts: Array<{ claimFor: string; claimForChildNo: number | null }>): string {
    const labels = new Set(receipts.map((r) => {
      if (r.claimFor === "SPOUSE") return "Pasangan";
      if (r.claimFor === "CHILD") return `Anak ke-${r.claimForChildNo ?? 1}`;
      return "Diri";
    }));
    return [...labels].join(", ") || "Diri";
  }

  const rows: ClaimRow[] = claims.map((c) => ({
    refNo: c.refNo,
    claimantName: c.claimant.name,
    staffNo: c.claimant.staffNo,
    department: c.department?.name ?? null,
    forMonth: c.forMonth,
    forYear: c.forYear,
    claimFor: beneficiarySummary(c.receipts),
    claimForChildNo: null,
    status: c.status,
    totalClaimedMyr: Number(c.totalClaimedMyr),
    totalEligibleMyr: c.totalEligibleMyr ? Number(c.totalEligibleMyr) : null,
    totalApprovedMyr: c.totalApprovedMyr ? Number(c.totalApprovedMyr) : null,
    submittedAt: c.submittedAt,
    paidAt: c.paidAt,
    voucherNo: c.voucherNo,
  }));

  const date = new Date().toISOString().slice(0, 10);
  const buffer = await generateLaporanPdf(rows, `Pilihan (${rows.length} tuntutan)`, orgName);
  const filename = `eksport-ringkasan-${date}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/export/claims/pdf/summary/route.ts
git commit -m "feat: POST /api/export/claims/pdf/summary — bulk PDF summary export"
```

---

### Task 4: PDF cover sheets bulk export route

**Files:**
- Create: `src/app/api/export/claims/pdf/coversheets/route.ts`

**Context:** Uses `generateBulkCoverSheets` from Task 1. Needs full Prisma include (receipts with items, approvals with actor). Returns `application/pdf`.

- [ ] **Step 1: Create the file**

Create `src/app/api/export/claims/pdf/coversheets/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin, isFinance } from "@/lib/permissions";
import { generateBulkCoverSheets } from "@/lib/pdf/cover-sheet";
import type { CoverSheetData } from "@/lib/pdf/cover-sheet";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!isFinance(session.user) && !isAdmin(session.user)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
  if (ids.length === 0) return NextResponse.json({ error: "ids array required" }, { status: 400 });
  if (ids.length > 200) return NextResponse.json({ error: "Terlalu banyak tuntutan (maks 200)" }, { status: 400 });

  const [claims, orgSetting] = await Promise.all([
    prisma.claim.findMany({
      where: { id: { in: ids } },
      include: {
        claimant: true,
        department: true,
        receipts: {
          include: { items: true },
          orderBy: { receiptDate: "asc" },
        },
        approvals: {
          include: { actor: { select: { name: true } } },
          orderBy: { decidedAt: "asc" },
        },
      },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.settings.findUnique({ where: { key: "org_name" } }),
  ]);

  const orgName = String(orgSetting?.value ?? "Majlis Daerah Setiu");

  const coverSheets: CoverSheetData[] = claims.map((claim) => ({
    orgName,
    refNo: claim.refNo,
    claimantName: claim.claimant.name,
    staffNo: claim.claimant.staffNo,
    departmentName: claim.department?.name ?? null,
    forMonth: claim.forMonth,
    forYear: claim.forYear,
    status: claim.status,
    submittedAt: claim.submittedAt,
    totalClaimedMyr: Number(claim.totalClaimedMyr),
    totalEligibleMyr: claim.totalEligibleMyr ? Number(claim.totalEligibleMyr) : null,
    totalApprovedMyr: claim.totalApprovedMyr ? Number(claim.totalApprovedMyr) : null,
    receipts: claim.receipts.map((r) => ({
      vendor: r.vendor,
      receiptDate: r.receiptDate,
      claimFor: r.claimFor,
      claimForChildNo: r.claimForChildNo,
      items: r.items.map((i) => ({
        description: i.description,
        qty: i.qty,
        unitMyr: Number(i.unitMyr),
        amountMyr: Number(i.amountMyr),
        isEligible: i.isEligible,
        flaggedReason: i.flaggedReason,
      })),
    })),
    approvals: claim.approvals.map((a) => ({
      step: a.step,
      actorName: a.actor.name,
      decision: a.decision,
      comment: a.comment,
      decidedAt: a.decidedAt,
    })),
  }));

  const date = new Date().toISOString().slice(0, 10);
  const buffer = await generateBulkCoverSheets(coverSheets);
  const filename = `eksport-coversheet-${date}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/export/claims/pdf/coversheets/route.ts
git commit -m "feat: POST /api/export/claims/pdf/coversheets — bulk cover sheets PDF"
```

---

### Task 5: ExportButton component

**Files:**
- Create: `src/components/export-button.tsx`

**Context:** Shared client component used by both `/semakan` and `/laporan`. Renders a shadcn `DropdownMenu` with three export options. Each option triggers `POST` to the relevant route, receives a blob, and triggers a browser download. Uses `sonner` toast for errors (already installed). Uses `lucide-react` icons (already in project).

- [ ] **Step 1: Create the file**

Create `src/components/export-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText, BookOpen, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type ExportFormat = "excel" | "pdf/summary" | "pdf/coversheets";

interface ExportButtonProps {
  /** Called at click time to get current selection. Return empty array to abort with toast. */
  getIds: () => string[];
  disabled?: boolean;
}

async function triggerDownload(ids: string[], format: ExportFormat): Promise<void> {
  const res = await fetch(`/api/export/claims/${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Gagal eksport. Cuba lagi.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  if (format === "excel") {
    a.download = `eksport-excel-${date}.xlsx`;
  } else if (format === "pdf/summary") {
    a.download = `eksport-ringkasan-${date}.pdf`;
  } else {
    a.download = `eksport-coversheet-${date}.pdf`;
  }
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButton({ getIds, disabled }: ExportButtonProps) {
  const [loading, setLoading] = useState<ExportFormat | null>(null);

  async function handleExport(format: ExportFormat) {
    const ids = getIds();
    if (ids.length === 0) {
      toast.warning("Pilih sekurang-kurangnya satu tuntutan.");
      return;
    }
    setLoading(format);
    try {
      await triggerDownload(ids, format);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal eksport. Cuba lagi.");
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || busy}>
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 mr-1.5" />
          )}
          Eksport
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleExport("excel")}
          disabled={busy}
        >
          {loading === "excel" ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 mr-2" />
          )}
          Excel
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport("pdf/summary")}
          disabled={busy}
        >
          {loading === "pdf/summary" ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-2" />
          )}
          PDF Ringkasan
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport("pdf/coversheets")}
          disabled={busy}
        >
          {loading === "pdf/coversheets" ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <BookOpen className="w-4 h-4 mr-2" />
          )}
          PDF Cover Sheets
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/export-button.tsx
git commit -m "feat: ExportButton — shared dropdown component for bulk claim export"
```

---

### Task 6: Refactor Semakan into SemukanClient with shared selection

**Files:**
- Create: `src/app/(app)/semakan/_components/semakan-client.tsx`
- Modify: `src/app/(app)/semakan/page.tsx`
- Delete: `src/app/(app)/semakan/_components/bulk-paid-panel.tsx` (replaced by SemukanClient)

**Context:** Current `page.tsx` renders queue 1 (HEAD_APPROVED) as plain links and queue 2 (APPROVED) inside `BulkPaidPanel`. We need shared checkbox state across both queues. New `SemukanClient` takes both arrays and manages all selection logic internally. The `markPaidBulk` action is imported from `@/server/actions/approval` — keep that behaviour but scope it to the APPROVED subset of current selection.

- [ ] **Step 1: Create `SemukanClient`**

Create `src/app/(app)/semakan/_components/semakan-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPaidBulk } from "@/server/actions/approval";
import { ExportButton } from "@/components/export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Banknote, Calculator, FileText } from "lucide-react";
import NextLink from "next/link";

export interface SemukanClaimItem {
  id: string;
  refNo: string;
  claimantName: string;
  departmentName: string | null;
  totalApprovedMyr: number | null;
  totalClaimedMyr: number;
  /** "HEAD_APPROVED" | "APPROVED" */
  status: string;
}

interface SemukanClientProps {
  reviewClaims: SemukanClaimItem[];
  approvedClaims: SemukanClaimItem[];
}

export function SemukanClient({ reviewClaims, approvedClaims }: SemukanClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [voucherNo, setVoucherNo] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const allClaims = [...reviewClaims, ...approvedClaims];

  function toggleAll() {
    if (selected.size === allClaims.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allClaims.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Only APPROVED claims in selection can be marked paid
  const selectedApproved = approvedClaims.filter((c) => selected.has(c.id));
  const totalSelected = allClaims
    .filter((c) => selected.has(c.id))
    .reduce((s, c) => s + (c.totalApprovedMyr ?? c.totalClaimedMyr), 0);

  function confirmPaid() {
    setError("");
    setSuccess("");
    startTransition(async () => {
      try {
        const result = await markPaidBulk(
          selectedApproved.map((c) => c.id),
          voucherNo.trim() || undefined
        );
        setSuccess(`${result.count} tuntutan berjaya ditandakan dibayar.`);
        setSelected(new Set());
        setVoucherNo("");
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal proses pembayaran.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Select-all row */}
      {allClaims.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <Checkbox
            checked={selected.size === allClaims.length && allClaims.length > 0}
            onCheckedChange={toggleAll}
          />
          Pilih Semua ({allClaims.length})
        </label>
      )}

      {/* Queue 1: Needs finance review */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Menunggu Semakan ({reviewClaims.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {reviewClaims.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">Tiada tuntutan menunggu semakan.</div>
          ) : (
            <div className="divide-y">
              {reviewClaims.map((claim) => (
                <div key={claim.id} className="flex items-center gap-3 p-4 hover:bg-gray-50">
                  <Checkbox
                    checked={selected.has(claim.id)}
                    onCheckedChange={() => toggleOne(claim.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <NextLink
                      href={`/tuntutan/${claim.id}`}
                      className="font-medium text-sm hover:underline text-green-800"
                    >
                      {claim.refNo}
                    </NextLink>
                    <p className="text-xs text-gray-500">
                      {claim.claimantName} · {claim.departmentName ?? "—"} · RM {claim.totalClaimedMyr.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Queue 2: Ready for payment */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Banknote className="w-4 h-4" />
            Menunggu Pembayaran ({approvedClaims.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {approvedClaims.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">Tiada tuntutan menunggu pembayaran.</div>
          ) : (
            <div className="divide-y">
              {approvedClaims.map((claim) => (
                <div key={claim.id} className="flex items-center gap-3 p-4 hover:bg-gray-50">
                  <Checkbox
                    checked={selected.has(claim.id)}
                    onCheckedChange={() => toggleOne(claim.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <NextLink
                      href={`/tuntutan/${claim.id}`}
                      className="font-medium text-sm hover:underline text-green-800"
                    >
                      {claim.refNo}
                    </NextLink>
                    <p className="text-xs text-gray-500">
                      {claim.claimantName} · {claim.departmentName ?? "—"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-700 shrink-0">
                    RM {(claim.totalApprovedMyr ?? claim.totalClaimedMyr).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selection summary card — appears when ≥1 selected */}
      {selected.size > 0 && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-emerald-800 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {selected.size} tuntutan dipilih · Jumlah: RM {totalSelected.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Voucher input — only show when APPROVED claims are selected */}
            {selectedApproved.length > 0 && (
              <div>
                <Label className="text-xs text-emerald-700 mb-1.5 block">
                  No. Baucer Pembayaran (opsyenal)
                </Label>
                <Input
                  value={voucherNo}
                  onChange={(e) => setVoucherNo(e.target.value)}
                  placeholder="cth: BV-2026-001234"
                  className="bg-white text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  No. baucer yang sama akan direkodkan untuk semua tuntutan yang dipilih.
                </p>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <p className="text-xs text-emerald-700 font-medium">{success}</p>
            )}

            <div className="flex gap-2">
              <ExportButton getIds={() => [...selected]} />
              {selectedApproved.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={isPending}
                      className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
                    >
                      <Banknote className="w-4 h-4 mr-2" />
                      {isPending
                        ? "Memproses..."
                        : `Tandakan ${selectedApproved.length} Dibayar`}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Sahkan Pembayaran Bulk</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tandakan{" "}
                        <strong>{selectedApproved.length} tuntutan</strong> sebagai
                        dibayar (jumlah: RM{" "}
                        {selectedApproved
                          .reduce(
                            (s, c) => s + (c.totalApprovedMyr ?? c.totalClaimedMyr),
                            0
                          )
                          .toFixed(2)}
                        )?
                        {voucherNo.trim() && (
                          <>
                            {" "}No. Baucer:{" "}
                            <strong>{voucherNo.trim()}</strong>.
                          </>
                        )}{" "}
                        Tindakan ini tidak boleh dibatalkan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={confirmPaid}
                        className="bg-emerald-700 hover:bg-emerald-800"
                      >
                        Ya, Tandakan Dibayar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `semakan/page.tsx`**

Overwrite `src/app/(app)/semakan/page.tsx` with:

```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isFinance } from "@/lib/permissions";
import { ClaimStatus } from "@/generated/prisma";
import { SemukanClient } from "./_components/semakan-client";

export default async function SemulaPage() {
  const session = await auth();
  if (!session?.user || !isFinance(session.user)) redirect("/dashboard");

  const [reviewClaims, approvedClaims] = await Promise.all([
    prisma.claim.findMany({
      where: { status: ClaimStatus.HEAD_APPROVED },
      include: { claimant: true, department: true },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.claim.findMany({
      where: { status: ClaimStatus.APPROVED },
      include: { claimant: true, department: true },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Semakan Kewangan</h1>
        <p className="text-gray-500 text-sm mt-1">
          {reviewClaims.length} menunggu semakan · {approvedClaims.length} menunggu pembayaran
        </p>
      </div>
      <SemukanClient
        reviewClaims={reviewClaims.map((c) => ({
          id: c.id,
          refNo: c.refNo,
          claimantName: c.claimant.name,
          departmentName: c.department?.name ?? null,
          totalApprovedMyr: null,
          totalClaimedMyr: Number(c.totalClaimedMyr),
          status: "HEAD_APPROVED",
        }))}
        approvedClaims={approvedClaims.map((c) => ({
          id: c.id,
          refNo: c.refNo,
          claimantName: c.claimant.name,
          departmentName: c.department?.name ?? null,
          totalApprovedMyr: c.totalApprovedMyr ? Number(c.totalApprovedMyr) : null,
          totalClaimedMyr: Number(c.totalClaimedMyr),
          status: "APPROVED",
        }))}
      />
    </div>
  );
}
```

- [ ] **Step 3: Delete the old `BulkPaidPanel` (now unused)**

```bash
rm src/app/\(app\)/semakan/_components/bulk-paid-panel.tsx
```

- [ ] **Step 4: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/semakan/_components/semakan-client.tsx
git add src/app/\(app\)/semakan/page.tsx
git rm src/app/\(app\)/semakan/_components/bulk-paid-panel.tsx
git commit -m "feat: SemukanClient — shared checkbox state + export across both queues"
```

---

### Task 7: LaporanTable client component + laporan page update

**Files:**
- Create: `src/app/(app)/laporan/_components/laporan-table.tsx`
- Modify: `src/app/(app)/laporan/page.tsx`

**Context:** Current `laporan/page.tsx` renders the claims table inline as a server component. We extract it into `LaporanTable` client component that adds checkboxes and a selection toolbar. The server page keeps its existing filter export buttons (Excel/PDF for full filtered export) unchanged and passes a serialisable claims array to `LaporanTable`.

- [ ] **Step 1: Create `LaporanTable`**

Create `src/app/(app)/laporan/_components/laporan-table.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { ExportButton } from "@/components/export-button";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";

const MONTHS_BM = ["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ogos","Sep","Okt","Nov","Dis"];

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draf",
  SUBMITTED: "Menunggu Sokongan",
  HEAD_APPROVED: "Menunggu Kewangan",
  FINANCE_REVIEWED: "Menunggu Kelulusan",
  APPROVED: "Diluluskan",
  REJECTED: "Ditolak",
  PAID: "Dibayar",
  WITHDRAWN: "Tarik Balik",
};

export interface LaporanClaimItem {
  id: string;
  refNo: string;
  claimantName: string;
  departmentName: string | null;
  forMonth: number;
  forYear: number;
  status: string;
  totalClaimedMyr: number;
  totalApprovedMyr: number | null;
  resubmittedFromRefNo: string | null;
}

interface LaporanTableProps {
  claims: LaporanClaimItem[];
}

export function LaporanTable({ claims }: LaporanTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleAll() {
    if (selected.size === claims.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(claims.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {/* Selection toolbar — only shown when ≥1 row checked */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <span className="text-blue-700 font-medium">{selected.size} baris dipilih</span>
          <ExportButton getIds={() => [...selected]} />
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:text-blue-800 h-auto p-0"
            onClick={() => setSelected(new Set())}
          >
            Nyahpilih
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="p-3 w-10">
                <Checkbox
                  checked={claims.length > 0 && selected.size === claims.length}
                  onCheckedChange={toggleAll}
                  aria-label="Pilih semua"
                />
              </th>
              <th className="p-3 text-left">Ref No</th>
              <th className="p-3 text-left">Kakitangan</th>
              <th className="p-3 text-left">Jabatan</th>
              <th className="p-3 text-center">Bulan</th>
              <th className="p-3 text-right">Tuntut</th>
              <th className="p-3 text-right">Lulus</th>
              <th className="p-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {claims.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-400">
                  <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Tiada tuntutan untuk penapisan ini.</p>
                </td>
              </tr>
            ) : (
              claims.map((claim) => (
                <tr
                  key={claim.id}
                  className={`hover:bg-gray-50 ${selected.has(claim.id) ? "bg-blue-50" : ""}`}
                >
                  <td className="p-3">
                    <Checkbox
                      checked={selected.has(claim.id)}
                      onCheckedChange={() => toggleOne(claim.id)}
                    />
                  </td>
                  <td className="p-3">
                    <Link href={`/tuntutan/${claim.id}`} className="text-green-700 hover:underline font-medium">
                      {claim.refNo}
                    </Link>
                    {claim.resubmittedFromRefNo && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Rujukan asal: {claim.resubmittedFromRefNo} (Ditolak)
                      </p>
                    )}
                  </td>
                  <td className="p-3 text-gray-700">{claim.claimantName}</td>
                  <td className="p-3 text-gray-500">{claim.departmentName ?? "—"}</td>
                  <td className="p-3 text-center text-gray-500">
                    {MONTHS_BM[claim.forMonth - 1]} {claim.forYear}
                  </td>
                  <td className="p-3 text-right">RM {claim.totalClaimedMyr.toFixed(2)}</td>
                  <td className="p-3 text-right text-green-700">
                    {claim.totalApprovedMyr != null
                      ? `RM ${claim.totalApprovedMyr.toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        claim.status === "APPROVED" || claim.status === "PAID"
                          ? "bg-green-100 text-green-700"
                          : claim.status === "REJECTED"
                          ? "bg-red-100 text-red-700"
                          : claim.status === "WITHDRAWN"
                          ? "bg-gray-100 text-gray-400 line-through"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {STATUS_LABELS[claim.status] ?? claim.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `laporan/page.tsx`**

In `src/app/(app)/laporan/page.tsx`:

**Add import** (after the existing imports):
```tsx
import { LaporanTable } from "./_components/laporan-table";
import type { LaporanClaimItem } from "./_components/laporan-table";
```

**Replace** the entire `{/* Table */}` card block (the `<Card>` that contains the `<table>`) with:

```tsx
      <Card>
        <CardContent className="pt-4">
          <LaporanTable
            claims={claims.map((claim): LaporanClaimItem => ({
              id: claim.id,
              refNo: claim.refNo,
              claimantName: claim.claimant.name,
              departmentName: claim.department?.name ?? null,
              forMonth: claim.forMonth,
              forYear: claim.forYear,
              status: claim.status,
              totalClaimedMyr: Number(claim.totalClaimedMyr),
              totalApprovedMyr: claim.totalApprovedMyr ? Number(claim.totalApprovedMyr) : null,
              resubmittedFromRefNo: claim.resubmittedFrom?.refNo ?? null,
            }))}
          />
        </CardContent>
      </Card>
```

Also **remove** the inline `STATUS_LABELS` and `MONTHS_BM` constants from `laporan/page.tsx` — they are now only used in `LaporanTable`. Keep the ones referenced in the summary cards (only `claims.filter` by status string — those don't use the constants).

Check: `laporan/page.tsx` uses `STATUS_LABELS` only in the table. The summary cards use `claim.status === "APPROVED" || claim.status === "PAID"` inline — no constant needed. Remove `STATUS_LABELS` and `MONTHS_BM` from the page file.

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 4: Manual smoke test**

Start dev server:
```bash
npm run dev
```

1. Log in as Finance user.
2. Go to `/semakan` — verify both queues show checkboxes. Select one from each queue. "Eksport" dropdown appears in green card. Click Excel — file downloads. Click PDF Ringkasan — PDF downloads. Click PDF Cover Sheets — PDF downloads with one page per claim.
3. Select only APPROVED claims — "Tandakan Dibayar" button appears. Mark paid — works as before.
4. Select only HEAD_APPROVED claims — "Tandakan Dibayar" button absent (correct — no approved claims in selection).
5. Go to `/laporan` — table now has checkbox column. Check 2 rows — blue toolbar appears with "Eksport" dropdown and "Nyahpilih". All three formats download. Click "Nyahpilih" — toolbar disappears.
6. Existing "PDF" and "Excel" buttons in laporan page header still work (full filtered export).
7. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/laporan/_components/laporan-table.tsx
git add src/app/\(app\)/laporan/page.tsx
git commit -m "feat: LaporanTable — checkbox selection + bulk export toolbar"
```
