# Resubmit Rejected Claim — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow claimants to resubmit a REJECTED claim as a new claim (new refNo), with receipts editable before resubmission; the original claim stays as an immutable audit record linked via `resubmittedFromId`.

**Architecture:** Self-referential FK on `Claim` tracks the chain. `initiateResubmit` server action releases receipts to inbox and redirects to `/tuntutan/baru?resubmitFrom=<id>`, where the existing new-claim form is extended with a banner and pre-selected receipts. The original REJECTED claim's detail page shows either a "Hantar Semula" button (if not yet resubmitted) or a banner linking to the new claim.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + `@prisma/adapter-pg`, TypeScript, shadcn/ui (AlertDialog, Button, Alert), Auth.js v5.

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `resubmittedFromId` + self-relation on `Claim` |
| `src/lib/audit.ts` | Add `CLAIM_RESUBMIT_INITIATED` constant |
| `src/server/actions/claim.ts` | Add `initiateResubmit`; extend `createClaim` with optional `resubmittedFromId` |
| `src/app/(app)/tuntutan/[id]/_components/resubmit-button.tsx` | **New** — confirm dialog + action call |
| `src/app/(app)/tuntutan/[id]/page.tsx` | Include `resubmissions`; render button or "already resubmitted" banner |
| `src/app/(app)/tuntutan/baru/page.tsx` | Handle `resubmitFrom` searchParam; load context; pass to form |
| `src/app/(app)/tuntutan/baru/_components/new-claim-form.tsx` | Accept `resubmitContext` prop; amber banner; pre-select receipts |
| `src/app/(app)/laporan/page.tsx` | Include `resubmittedFrom`; show chain in refNo cell |

---

## Task 1: Schema — add resubmittedFromId to Claim

**Files:**
- Modify: `prisma/schema.prisma` (Claim model, ~line 212)

- [ ] **Step 1: Add field + self-relation to Claim model**

In `prisma/schema.prisma`, inside the `Claim` model, add after `updatedAt DateTime @updatedAt`:

```prisma
  resubmittedFromId String?
```

And add after the `comments ClaimComment[]` relation:

```prisma
  resubmittedFrom   Claim?  @relation("ClaimResubmit", fields: [resubmittedFromId], references: [id])
  resubmissions     Claim[] @relation("ClaimResubmit")
```

The full bottom of the `Claim` model should look like:

```prisma
  claimant   User         @relation(fields: [claimantId], references: [id])
  department Department?  @relation("DepartmentClaims", fields: [departmentId], references: [id])
  receipts   Receipt[]
  approvals  Approval[]
  comments   ClaimComment[]
  resubmittedFrom   Claim?  @relation("ClaimResubmit", fields: [resubmittedFromId], references: [id])
  resubmissions     Claim[] @relation("ClaimResubmit")

  @@index([claimantId, status])
  @@index([departmentId, status])
  @@index([forYear, forMonth])
  @@index([status])
}
```

- [ ] **Step 2: Run migration**

```powershell
npx prisma migrate dev --name add-claim-resubmit-link
```

Expected: migration created and applied, no errors.

- [ ] **Step 3: Regenerate Prisma client**

```powershell
npx prisma generate
```

Expected: client regenerated with `resubmittedFromId`, `resubmittedFrom`, `resubmissions` on `Claim`.

- [ ] **Step 4: Verify TypeScript compiles**

```powershell
npx tsc --noEmit 2>&1
```

Expected: no output (clean).

- [ ] **Step 5: Commit**

```powershell
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add resubmittedFromId self-relation to Claim"
```

---

## Task 2: Audit action constant

**Files:**
- Modify: `src/lib/audit.ts` (line ~41, `AuditAction` object)

- [ ] **Step 1: Add CLAIM_RESUBMIT_INITIATED to AuditAction**

In `src/lib/audit.ts`, inside the `AuditAction` object, add after `CLAIM_RESUBMITTED`:

```typescript
  CLAIM_RESUBMIT_INITIATED: "CLAIM_RESUBMIT_INITIATED",
```

The Claims section should now read:

```typescript
  // Claims
  CLAIM_CREATED: "CLAIM_CREATED",
  CLAIM_SUBMITTED: "CLAIM_SUBMITTED",
  CLAIM_WITHDRAWN: "CLAIM_WITHDRAWN",
  CLAIM_RESUBMITTED: "CLAIM_RESUBMITTED",
  CLAIM_RESUBMIT_INITIATED: "CLAIM_RESUBMIT_INITIATED",
  HEAD_APPROVED: "HEAD_APPROVED",
  // ...rest unchanged
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
npx tsc --noEmit 2>&1
```

Expected: no output.

- [ ] **Step 3: Commit**

```powershell
git add src/lib/audit.ts
git commit -m "feat: add CLAIM_RESUBMIT_INITIATED audit action"
```

---

## Task 3: Server actions — initiateResubmit + extend createClaim

**Files:**
- Modify: `src/server/actions/claim.ts`

Context: `claim.ts` currently exports `createClaim` and `withdrawClaim`. It imports `ClaimStatus, ReceiptStatus, Role, ApprovalStep, Decision` from `@/generated/prisma`.

- [ ] **Step 1: Add initiateResubmit after withdrawClaim**

In `src/server/actions/claim.ts`, add this function after the `withdrawClaim` export (around line 177):

```typescript
// ─── Initiate resubmit (release receipts, redirect happens client-side) ───────

export async function initiateResubmit(claimId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: { resubmissions: { select: { id: true } } },
  });

  if (!claim || claim.claimantId !== session.user.id) throw new Error("NOT_FOUND");
  if (claim.status !== ClaimStatus.REJECTED) throw new Error("CANNOT_RESUBMIT");
  if (claim.resubmissions.length > 0) throw new Error("ALREADY_RESUBMITTED");

  await prisma.receipt.updateMany({
    where: { claimId },
    data: { status: ReceiptStatus.UNSORTED, claimId: null },
  });

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.CLAIM_RESUBMIT_INITIATED,
    entity: "Claim",
    entityId: claimId,
    meta: { originalRefNo: claim.refNo },
  });

  return { originalClaimId: claimId };
}
```

- [ ] **Step 2: Extend createClaim signature with optional resubmittedFromId**

Change the `createClaim` data parameter type from:

```typescript
export async function createClaim(data: {
  forMonth: number;
  forYear: number;
  receiptIds: string[];
}) {
```

To:

```typescript
export async function createClaim(data: {
  forMonth: number;
  forYear: number;
  receiptIds: string[];
  resubmittedFromId?: string;
}) {
```

- [ ] **Step 3: Pass resubmittedFromId to prisma.claim.create**

In `createClaim`, the `prisma.claim.create` call currently ends with:

```typescript
    data: {
      refNo,
      claimantId: session.user.id,
      departmentId: session.user.departmentId,
      forMonth: data.forMonth,
      forYear: data.forYear,
      status: ClaimStatus.SUBMITTED,
      totalClaimedMyr: total.toDecimalPlaces(2).toNumber(),
      submittedAt: new Date(),
      receipts: {
        connect: data.receiptIds.map((id) => ({ id })),
      },
    },
```

Change to:

```typescript
    data: {
      refNo,
      claimantId: session.user.id,
      departmentId: session.user.departmentId,
      forMonth: data.forMonth,
      forYear: data.forYear,
      status: ClaimStatus.SUBMITTED,
      totalClaimedMyr: total.toDecimalPlaces(2).toNumber(),
      submittedAt: new Date(),
      receipts: {
        connect: data.receiptIds.map((id) => ({ id })),
      },
      ...(data.resubmittedFromId && { resubmittedFromId: data.resubmittedFromId }),
    },
```

- [ ] **Step 4: Use CLAIM_RESUBMITTED audit action for resubmit path**

In `createClaim`, change the `logAction` call for claim submission from:

```typescript
  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.CLAIM_SUBMITTED,
    entity: "Claim",
    entityId: claim.id,
    meta: { refNo, total: total.toString(), remaining: remaining.toString() },
  });
```

To:

```typescript
  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: data.resubmittedFromId ? AuditAction.CLAIM_RESUBMITTED : AuditAction.CLAIM_SUBMITTED,
    entity: "Claim",
    entityId: claim.id,
    meta: {
      refNo,
      total: total.toString(),
      remaining: remaining.toString(),
      ...(data.resubmittedFromId && { resubmittedFromId: data.resubmittedFromId }),
    },
  });
```

- [ ] **Step 5: Verify TypeScript compiles**

```powershell
npx tsc --noEmit 2>&1
```

Expected: no output.

- [ ] **Step 6: Commit**

```powershell
git add src/server/actions/claim.ts
git commit -m "feat: initiateResubmit action + extend createClaim with resubmittedFromId"
```

---

## Task 4: ResubmitButton client component

**Files:**
- Create: `src/app/(app)/tuntutan/[id]/_components/resubmit-button.tsx`

Context: existing components in this folder — `withdraw-button.tsx`, `head-panel.tsx`, `finance-panel.tsx`, `approver-panel.tsx`. All are `"use client"` components calling server actions. Follow the same pattern.

- [ ] **Step 1: Create the component**

Create `src/app/(app)/tuntutan/[id]/_components/resubmit-button.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { initiateResubmit } from "@/server/actions/claim";
import { Button } from "@/components/ui/button";
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
import { RotateCcw } from "lucide-react";

export function ResubmitButton({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleConfirm() {
    setError("");
    startTransition(async () => {
      try {
        const result = await initiateResubmit(claimId);
        router.push(`/tuntutan/baru?resubmitFrom=${result.originalClaimId}`);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal memulakan resubmit.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="w-full" disabled={isPending}>
            <RotateCcw className="w-4 h-4 mr-2" />
            {isPending ? "Memproses..." : "Hantar Semula"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hantar Semula Tuntutan?</AlertDialogTitle>
            <AlertDialogDescription>
              Resit dalam tuntutan ini akan dikembalikan ke inbox anda. Tuntutan baru akan dibuat dengan nombor rujukan baharu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-green-700 hover:bg-green-800"
            >
              Ya, Hantar Semula
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
npx tsc --noEmit 2>&1
```

Expected: no output.

- [ ] **Step 3: Commit**

```powershell
git add src/app/(app)/tuntutan/[id]/_components/resubmit-button.tsx
git commit -m "feat: ResubmitButton component with confirm dialog"
```

---

## Task 5: Claim detail page — resubmission state

**Files:**
- Modify: `src/app/(app)/tuntutan/[id]/page.tsx`

Context: page currently fetches claim with `include: { claimant, receipts, approvals }`. Has `canWithdraw` flag for SUBMITTED claims. Renders `WithdrawButton` at bottom.

- [ ] **Step 1: Add resubmissions to the claim include**

Change the `prisma.claim.findUnique` include from:

```typescript
    include: {
      claimant: true,
      receipts: {
        include: { items: true },
        orderBy: { receiptDate: "asc" },
      },
      approvals: {
        include: { actor: { select: { name: true, email: true } } },
        orderBy: { decidedAt: "asc" },
      },
    },
```

To:

```typescript
    include: {
      claimant: true,
      receipts: {
        include: { items: true },
        orderBy: { receiptDate: "asc" },
      },
      approvals: {
        include: { actor: { select: { name: true, email: true } } },
        orderBy: { decidedAt: "asc" },
      },
      resubmissions: {
        select: { id: true, refNo: true },
        take: 1,
      },
    },
```

- [ ] **Step 2: Add resubmission flags**

After the existing `const canWithdraw = ...` line, add:

```typescript
  const resubmission = claim.resubmissions[0] ?? null;
  const canResubmit = isOwner && claim.status === ClaimStatus.REJECTED && !resubmission;
```

- [ ] **Step 3: Import ResubmitButton and add RotateCcw to lucide-react import**

Add this import line:

```typescript
import { ResubmitButton } from "./_components/resubmit-button";
```

And update the existing lucide-react import to include `RotateCcw`:

```typescript
import { CheckCircle2, FileText, Calendar, Building2, User, Clock, RotateCcw } from "lucide-react";
```

(`Link` is already imported from `next/link`.)

- [ ] **Step 4: Add resubmit UI at the bottom of the page JSX**

The current JSX ends with:

```tsx
      {/* Withdraw */}
      {canWithdraw && (
        <WithdrawButton claimId={claim.id} />
      )}
    </div>
```

Change to:

```tsx
      {/* Withdraw */}
      {canWithdraw && (
        <WithdrawButton claimId={claim.id} />
      )}

      {/* Resubmit */}
      {canResubmit && (
        <ResubmitButton claimId={claim.id} />
      )}
      {resubmission && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
          <RotateCcw className="w-4 h-4 shrink-0" />
          <span>Sudah dihantar semula →{" "}</span>
          <Link href={`/tuntutan/${resubmission.id}`} className="font-medium underline">
            {resubmission.refNo}
          </Link>
        </div>
      )}
    </div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```powershell
npx tsc --noEmit 2>&1
```

Expected: no output.

- [ ] **Step 6: Manual smoke test**

Start dev server (`npm run dev`). Log in as a claimant who has a REJECTED claim.
- Navigate to that claim's detail page
- Confirm "Hantar Semula" button appears
- Confirm no button on SUBMITTED or APPROVED claims

- [ ] **Step 7: Commit**

```powershell
git add src/app/(app)/tuntutan/[id]/page.tsx
git commit -m "feat: resubmit button + already-resubmitted banner on claim detail page"
```

---

## Task 6: New claim page + form — resubmit context

**Files:**
- Modify: `src/app/(app)/tuntutan/baru/page.tsx`
- Modify: `src/app/(app)/tuntutan/baru/_components/new-claim-form.tsx`

Context: `baru/page.tsx` currently fetches UNSORTED receipts + allocation, renders `NewClaimForm`. The page has no `searchParams` prop yet.

- [ ] **Step 1: Update baru/page.tsx to handle resubmitFrom searchParam**

Replace the entire content of `src/app/(app)/tuntutan/baru/page.tsx` with:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { ReceiptStatus, Decision } from "@/generated/prisma";
import { NewClaimForm } from "./_components/new-claim-form";
import { BackButton } from "@/components/back-button";

type ResubmitContext = {
  claimId: string;
  refNo: string;
  rejectionComment: string | null;
  originalReceiptIds: string[];
};

export default async function BuatTuntutanPage({
  searchParams,
}: {
  searchParams: Promise<{ resubmitFrom?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const currentYear = new Date().getFullYear();

  let resubmitContext: ResubmitContext | null = null;

  if (sp.resubmitFrom) {
    const original = await prisma.claim.findUnique({
      where: { id: sp.resubmitFrom, claimantId: session.user.id },
      include: {
        receipts: { select: { id: true } },
        approvals: {
          where: { decision: Decision.REJECTED },
          orderBy: { decidedAt: "desc" },
          take: 1,
        },
      },
    });
    if (original) {
      resubmitContext = {
        claimId: original.id,
        refNo: original.refNo,
        rejectionComment: original.approvals[0]?.comment ?? null,
        originalReceiptIds: original.receipts.map((r) => r.id),
      };
    }
  }

  const [unsortedReceipts, allocation] = await Promise.all([
    prisma.receipt.findMany({
      where: { ownerId: session.user.id, status: ReceiptStatus.UNSORTED },
      include: { items: true },
      orderBy: { receiptDate: "desc" },
    }),
    prisma.annualAllocation.findUnique({
      where: { userId_year: { userId: session.user.id, year: currentYear } },
    }),
  ]);

  const limit = Number(allocation?.limitMyr ?? 1200);
  const used = Number(allocation?.usedMyr ?? 0);
  const remaining = limit - used;

  return (
    <div className="space-y-6 max-w-2xl">
      <BackButton />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {resubmitContext ? "Hantar Semula Tuntutan" : "Buat Tuntutan Baru"}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {resubmitContext
            ? `Resubmit dari ${resubmitContext.refNo}`
            : "Pilih resit dan hantar tuntutan"}
        </p>
      </div>
      <NewClaimForm
        receipts={unsortedReceipts.map((r) => ({
          ...r,
          totalMyr: r.totalMyr ? Number(r.totalMyr) : null,
          items: r.items.map((i) => ({
            ...i,
            unitMyr: Number(i.unitMyr),
            amountMyr: Number(i.amountMyr),
          })),
        }))}
        remaining={remaining}
        limit={limit}
        resubmitContext={resubmitContext}
      />
    </div>
  );
}
```

- [ ] **Step 2: Extend NewClaimForm props interface**

In `src/app/(app)/tuntutan/baru/_components/new-claim-form.tsx`, add `resubmitContext` to the props interface. Change:

```typescript
interface NewClaimFormProps {
  receipts: Receipt[];
  remaining: number;
  limit: number;
}
```

To:

```typescript
type ResubmitContext = {
  claimId: string;
  refNo: string;
  rejectionComment: string | null;
  originalReceiptIds: string[];
};

interface NewClaimFormProps {
  receipts: Receipt[];
  remaining: number;
  limit: number;
  resubmitContext?: ResubmitContext | null;
}
```

- [ ] **Step 3: Accept resubmitContext in component function signature**

Change:

```typescript
export function NewClaimForm({ receipts, remaining, limit }: NewClaimFormProps) {
```

To:

```typescript
export function NewClaimForm({ receipts, remaining, limit, resubmitContext }: NewClaimFormProps) {
```

- [ ] **Step 4: Pre-select receipts from resubmitContext**

Change:

```typescript
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
```

To:

```typescript
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(resubmitContext?.originalReceiptIds ?? [])
  );
```

- [ ] **Step 5: Add amber banner before the period selection card**

In the JSX `return (...)`, add this block as the first child inside `<div className="space-y-4">`:

```tsx
      {resubmitContext && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 space-y-1">
          <p className="text-sm font-medium text-amber-800">
            Hantar semula dari {resubmitContext.refNo}
          </p>
          {resubmitContext.rejectionComment && (
            <p className="text-xs text-amber-700">
              Sebab penolakan: &ldquo;{resubmitContext.rejectionComment}&rdquo;
            </p>
          )}
        </div>
      )}
```

- [ ] **Step 6: Pass resubmittedFromId in handleSubmit**

In `handleSubmit`, change:

```typescript
        const result = await createClaim({
          forMonth: parseInt(forMonth),
          forYear: parseInt(forYear),
          receiptIds: Array.from(selectedIds),
        });
```

To:

```typescript
        const result = await createClaim({
          forMonth: parseInt(forMonth),
          forYear: parseInt(forYear),
          receiptIds: Array.from(selectedIds),
          ...(resubmitContext && { resubmittedFromId: resubmitContext.claimId }),
        });
```

- [ ] **Step 7: Verify TypeScript compiles**

```powershell
npx tsc --noEmit 2>&1
```

Expected: no output.

- [ ] **Step 8: Manual smoke test**

1. Start dev server
2. Go to a REJECTED claim → click "Hantar Semula" → confirm dialog → confirm
3. Confirm redirect to `/tuntutan/baru?resubmitFrom=<id>`
4. Confirm amber banner shows with original refNo and rejection comment
5. Confirm receipts from original claim are pre-selected
6. Submit new claim → confirm new refNo
7. Return to original REJECTED claim → confirm "Sudah dihantar semula → [new refNo]" banner

- [ ] **Step 9: Commit**

```powershell
git add src/app/(app)/tuntutan/baru/page.tsx src/app/(app)/tuntutan/baru/_components/new-claim-form.tsx
git commit -m "feat: new claim form handles resubmit context with banner and pre-selected receipts"
```

---

## Task 7: Laporan — show resubmitted-from chain

**Files:**
- Modify: `src/app/(app)/laporan/page.tsx`

Context: `laporan/page.tsx` fetches claims with `include: { claimant, department }` and renders them in a table. The refNo cell links to the claim detail page.

- [ ] **Step 1: Add resubmittedFrom to the include**

In the `prisma.claim.findMany` call, change:

```typescript
    include: {
      claimant: true,
      department: true,
    },
```

To:

```typescript
    include: {
      claimant: true,
      department: true,
      resubmittedFrom: { select: { refNo: true } },
    },
```

- [ ] **Step 2: Show chain in the refNo table cell**

The current refNo `<td>` is:

```tsx
                    <td className="p-3">
                      <Link href={`/tuntutan/${claim.id}`} className="text-green-700 hover:underline font-medium">
                        {claim.refNo}
                      </Link>
                    </td>
```

Change to:

```tsx
                    <td className="p-3">
                      <Link href={`/tuntutan/${claim.id}`} className="text-green-700 hover:underline font-medium">
                        {claim.refNo}
                      </Link>
                      {claim.resubmittedFrom && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Rujukan asal: {claim.resubmittedFrom.refNo} (Ditolak)
                        </p>
                      )}
                    </td>
```

- [ ] **Step 3: Verify TypeScript compiles**

```powershell
npx tsc --noEmit 2>&1
```

Expected: no output.

- [ ] **Step 4: Manual smoke test**

Navigate to `/laporan`. Confirm resubmitted claims show "Rujukan asal: MDS-XXXX-YYYY (Ditolak)" below the refNo. Confirm non-resubmitted claims show nothing extra.

- [ ] **Step 5: Commit**

```powershell
git add src/app/(app)/laporan/page.tsx
git commit -m "feat: laporan shows resubmittedFrom chain in refNo cell"
```

---

## Verification Checklist

After all tasks complete, verify these flows manually:

- [ ] REJECTED claim detail → "Hantar Semula" button visible to owner only
- [ ] Click → confirm dialog → confirm → receipts released → redirect to baru page
- [ ] Baru page shows amber banner with original refNo + rejection comment
- [ ] Pre-selected receipts match original claim's receipts (all now in inbox)
- [ ] Can uncheck old receipts and/or add new ones from inbox
- [ ] Submit → new claim created with new refNo + `resubmittedFromId` set
- [ ] Original REJECTED claim detail → "Sudah dihantar semula → [new refNo]" banner
- [ ] "Hantar Semula" button gone on already-resubmitted claim
- [ ] Laporan shows "Rujukan asal: [old refNo] (Ditolak)" on resubmitted claims
- [ ] SUBMITTED/APPROVED/PAID claims → no resubmit button
- [ ] Non-owner viewing REJECTED claim → no resubmit button
