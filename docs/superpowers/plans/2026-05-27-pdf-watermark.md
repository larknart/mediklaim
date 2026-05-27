# PDF Watermark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add diagonal watermarks to the two PDF outputs — status-based stamp on claim cover sheets, fixed org-identity mark on laporan.

**Architecture:** A new `watermark.tsx` helper exports two pure functions returning react-pdf `<View fixed>` elements. Both existing PDF components insert the result as the last child inside `<Page>`. `fixed` prop ensures the watermark repeats on every page (critical for multi-page laporan). No new npm dependencies, no DB changes, no route changes.

**Tech Stack:** `@react-pdf/renderer` (already installed), TypeScript, Next.js 16 App Router.

---

### Task 1: Create `src/lib/pdf/watermark.tsx`

**Files:**
- Create: `src/lib/pdf/watermark.tsx`

No test framework in project — verification is TypeScript compilation clean.

- [ ] **Step 1: Create the file with the full implementation**

```tsx
import React from "react";
import { View, Text } from "@react-pdf/renderer";

const STATUS_WATERMARK: Record<string, { text: string; color: string }> = {
  APPROVED:  { text: "DILULUSKAN",  color: "#1c5e2f" },
  PAID:      { text: "DIBAYAR",     color: "#1c5e2f" },
  REJECTED:  { text: "DITOLAK",     color: "#c62828" },
  WITHDRAWN: { text: "TARIK BALIK", color: "#888888" },
};

/**
 * Returns a diagonal status watermark for claim cover sheets.
 * Returns null for non-final statuses (SUBMITTED, HEAD_APPROVED, FINANCE_REVIEWED, DRAFT).
 * `fixed` ensures it renders on every PDF page.
 */
export function claimWatermark(status: string): React.ReactElement | null {
  const wm = STATUS_WATERMARK[status];
  if (!wm) return null;
  return (
    <View
      fixed
      style={{
        position: "absolute",
        top: "35%",
        left: 0,
        right: 0,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 72,
          fontFamily: "Helvetica-Bold",
          color: wm.color,
          opacity: 0.12,
          transform: "rotate(-45deg)",
        }}
      >
        {wm.text}
      </Text>
    </View>
  );
}

/**
 * Returns a fixed org-identity watermark for laporan PDFs.
 * Always rendered. Shows org name + "DOKUMEN RASMI" stacked, diagonal, grey.
 * `fixed` ensures it renders on every PDF page.
 */
export function reportWatermark(orgName: string): React.ReactElement {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        top: "35%",
        left: 0,
        right: 0,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 60,
          fontFamily: "Helvetica-Bold",
          color: "#888888",
          opacity: 0.10,
          transform: "rotate(-45deg)",
          textAlign: "center",
        }}
      >
        {orgName}{"\n"}DOKUMEN RASMI
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles clean**

Run from project root:
```bash
npx tsc --noEmit
```
Expected: no errors. If `transform: "rotate(-45deg)"` causes a type error, change to `transform: "rotate(-45deg)" as string` — react-pdf v4 accepts it.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf/watermark.tsx
git commit -m "feat: pdf watermark helpers — claimWatermark + reportWatermark"
```

---

### Task 2: Wire watermark into cover-sheet.tsx

**Files:**
- Modify: `src/lib/pdf/cover-sheet.tsx`

- [ ] **Step 1: Add import at the top of the file**

Find the existing imports block at the top of `src/lib/pdf/cover-sheet.tsx`:
```tsx
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
```

Add one import after that block:
```tsx
import { claimWatermark } from "./watermark";
```

- [ ] **Step 2: Insert watermark call inside `<Page>`**

Find the footer `<View>` near the end of the `CoverSheet` component's `<Page>`. It looks like this:
```tsx
        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{data.orgName} — {data.refNo}</Text>
          <Text style={s.footerText}>Jana: {generatedAt}</Text>
        </View>
      </Page>
```

Add `{claimWatermark(data.status)}` immediately before `</Page>`:
```tsx
        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{data.orgName} — {data.refNo}</Text>
          <Text style={s.footerText}>Jana: {generatedAt}</Text>
        </View>

        {/* Watermark — renders last so it sits above content in PDF layer order */}
        {claimWatermark(data.status)}
      </Page>
```

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: exit 0, no errors.

- [ ] **Step 4: Manual spot-check**

Start the dev server (`npm run dev`) and open a browser. Navigate to a claim that has status `PAID` or `APPROVED`, then download its PDF via `/api/tuntutan/<id>/pdf`. Open the PDF — you should see a green diagonal `DILULUSKAN` or `DIBAYAR` watermark across the page.

Then check a `SUBMITTED` claim — its PDF should have no watermark.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/cover-sheet.tsx
git commit -m "feat: add status watermark to claim cover sheet PDF"
```

---

### Task 3: Wire watermark into laporan.tsx

**Files:**
- Modify: `src/lib/pdf/laporan.tsx`

- [ ] **Step 1: Add import at the top of the file**

Find the existing imports block at the top of `src/lib/pdf/laporan.tsx`:
```tsx
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ClaimRow } from "@/lib/excel/laporan";
```

Add one import after that block:
```tsx
import { reportWatermark } from "./watermark";
```

- [ ] **Step 2: Find the closing of `<Page>` inside `LaporanDocument`**

Inside the `LaporanDocument` component, find the footer `<View>` near the end of `<Page>`. It looks like this:
```tsx
        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{data.orgName} — Laporan Tuntutan Perubatan</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Muka ${pageNumber} / ${totalPages}`} fixed />
        </View>
      </Page>
```

If the footer looks slightly different (the laporan footer text may vary), find `</Page>` and insert just before it.

Add `{reportWatermark(data.orgName)}` immediately before `</Page>`:
```tsx
        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{data.orgName} — Laporan Tuntutan Perubatan</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Muka ${pageNumber} / ${totalPages}`} fixed />
        </View>

        {/* Watermark — org identity, renders on every page via fixed prop */}
        {reportWatermark(data.orgName)}
      </Page>
```

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: exit 0, no errors.

- [ ] **Step 4: Manual spot-check**

Navigate to `/laporan` in the app, export as PDF. Open the downloaded file — every page should show a grey diagonal watermark with the org name and `DOKUMEN RASMI` stacked.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/laporan.tsx
git commit -m "feat: add org-identity watermark to laporan PDF"
```
