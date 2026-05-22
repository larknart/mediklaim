# Resubmit Rejected Claim — Design Spec
**Date:** 2026-05-22
**Project:** MediKlaim MDS

## Overview

Allow claimants to resubmit a REJECTED claim as a new claim (new refNo), with receipts editable (add/remove) before submission. The original rejected claim remains as an immutable audit record. The new claim links back to its origin via `resubmittedFromId`. Reports show the chain so Finance sees no unexplained refNo gaps.

## Decisions

| Decision | Choice |
|----------|--------|
| Receipt editing | Allowed (add/remove from inbox) |
| Original claim after resubmit | Stays REJECTED, immutable |
| RefNo | New refNo for new claim; original preserved in `resubmittedFromId` chain |
| Trigger location | Detail page of the REJECTED claim |
| UI approach | Initiate server action → release receipts → redirect to `/tuntutan/baru?resubmitFrom=<id>` |

## Schema Changes

Self-referential optional FK on `Claim`:

```prisma
model Claim {
  // ... existing fields unchanged ...

  resubmittedFromId String?
  resubmittedFrom   Claim?  @relation("ClaimResubmit", fields: [resubmittedFromId], references: [id])
  resubmissions     Claim[] @relation("ClaimResubmit")
}
```

Migration required. One rejected claim → at most one resubmission (enforced in `initiateResubmit`).

## Server Actions

### `initiateResubmit(claimId: string)`

**Location:** `src/server/actions/claim.ts`

**Steps:**
1. Auth — session required
2. Load claim with `resubmissions` relation
3. Guard: `claim.claimantId !== session.user.id` → throw `NOT_FOUND`
4. Guard: `claim.status !== REJECTED` → throw `CANNOT_RESUBMIT`
5. Guard: `claim.resubmissions.length > 0` → throw `ALREADY_RESUBMITTED` (prevent double)
6. `prisma.receipt.updateMany({ where: { claimId }, data: { status: UNSORTED, claimId: null } })`
7. `logAction(CLAIM_RESUBMIT_INITIATED, { originalRefNo: claim.refNo })`
8. Return `{ originalClaimId: claimId }`

Client on success: `router.push('/tuntutan/baru?resubmitFrom=' + originalClaimId)`

### `createClaim` extension

Accept optional `resubmittedFromId?: string`. When present:
- Verify the referenced claim exists, belongs to this user, and is REJECTED
- Store `resubmittedFromId` on the new claim
- Audit log meta includes `{ resubmittedFrom: originalRefNo }`

No other changes to `createClaim` logic — skipHead, notification, and allocation checks unchanged.

## Audit Log

Add to `AuditAction` enum in `src/lib/audit.ts`:
```typescript
CLAIM_RESUBMIT_INITIATED = "CLAIM_RESUBMIT_INITIATED",
```

## UI Flow

### Detail page `/tuntutan/[id]` — REJECTED claim

Server queries:
```typescript
const resubmission = await prisma.claim.findFirst({
  where: { resubmittedFromId: claim.id },
  select: { id: true, refNo: true },
});
```

Two states rendered below the approval timeline:

**State A — not yet resubmitted** (`!resubmission && isOwner && claim.status === REJECTED`):
```
[Hantar Semula]   ← ResubmitButton client component
```

**State B — already resubmitted** (`resubmission` exists):
```
Amber banner: "Sudah dihantar semula → MDS-2026-0015 [link]"
```

`canWithdraw` (status === SUBMITTED) and `canResubmit` (status === REJECTED, no resubmission) are mutually exclusive — no conflict.

### `ResubmitButton` component

**Location:** `src/app/(app)/tuntutan/[id]/_components/resubmit-button.tsx`

Client component. Renders an outlined button "Hantar Semula". On click:
1. Show confirm dialog: "Resit dalam tuntutan ini akan dikembalikan ke inbox anda. Tuntutan baru akan dibuat dengan refNo baharu."
2. On confirm → call `initiateResubmit(claimId)` → redirect

### `/tuntutan/baru` page with `resubmitFrom` searchParam

**`src/app/(app)/tuntutan/baru/page.tsx`** — if `resubmitFrom` in searchParams:
- Load original claim: `refNo`, last rejection `approval.comment` (most recent `REJECTED` decision)
- Pass `resubmitContext: { refNo, rejectionComment, originalReceiptIds }` to `NewClaimForm`

`originalReceiptIds`: the receipts that were just released — still belong to this user and are now UNSORTED. Passed so the form can pre-select them.

### `NewClaimForm` with resubmit context

**`src/app/(app)/tuntutan/baru/_components/new-claim-form.tsx`** — new optional prop:
```typescript
interface ResubmitContext {
  claimId: string;
  refNo: string;
  rejectionComment: string | null;
  originalReceiptIds: string[];
}
```

When `resubmitContext` is present:
- Amber banner at top of form:
  ```
  Hantar semula dari [refNo]
  Sebab penolakan: "[rejectionComment]"   ← omit line if null
  ```
- `selectedIds` initialised from `originalReceiptIds` instead of empty set
- All other form behaviour identical — user can uncheck old receipts, check new ones
- On submit: `createClaim({ ..., resubmittedFromId: resubmitContext.claimId })`

## Reports (`/laporan`)

When rendering a claim row that has `resubmittedFromId` set, show:
```
Rujukan asal: MDS-2026-0012 (Ditolak)
```
below the refNo. This surfaces the chain so Finance sees no unexplained gaps.

Report query: include `resubmittedFrom: { select: { refNo: true } }` in the Prisma query.

## Notifications

`initiateResubmit` — no notification (internal user action).

`createClaim` (resubmit path) — same notifications as a fresh submission:
- `skipHead` true → notify Finance team
- `skipHead` false → notify Head of claimant's department + confirm to claimant

No special "resubmit" notification event needed. Recipients restart the approval workflow from the beginning and do not need to know it is a resubmission.

## File Summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `resubmittedFromId`, self-relation on `Claim` |
| `src/lib/audit.ts` | Add `CLAIM_RESUBMIT_INITIATED` |
| `src/server/actions/claim.ts` | Add `initiateResubmit`; extend `createClaim` with optional `resubmittedFromId` |
| `src/app/(app)/tuntutan/[id]/page.tsx` | Query `resubmission`; conditionally render `ResubmitButton` or banner |
| `src/app/(app)/tuntutan/[id]/_components/resubmit-button.tsx` | New — confirm dialog + action call |
| `src/app/(app)/tuntutan/baru/page.tsx` | Handle `resubmitFrom` searchParam; pass `resubmitContext` |
| `src/app/(app)/tuntutan/baru/_components/new-claim-form.tsx` | Accept `resubmitContext` prop; banner + pre-select receipts |
| `src/app/(app)/laporan/` | Include `resubmittedFrom` in query; display chain |

## Out of Scope

- Multi-hop chains (resubmit of a resubmission) — one level only; if second rejection, user resubmits the new rejected claim normally
- Admin-initiated resubmit — claimant only
- Email/WhatsApp "resubmitted" notification — standard submit notification is sufficient
