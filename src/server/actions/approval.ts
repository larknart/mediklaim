"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAction, AuditAction } from "@/lib/audit";
import { dispatch } from "@/lib/notify/dispatcher";
import { notifyApproverTeam } from "./claim";
import { isHead, isFinance, isApprover, isYdp, canApproveAsHead, shouldSkipApproverStep } from "@/lib/permissions";
import { getActiveDelegation } from "@/lib/delegation";
import { getDefaultAnnualLimit } from "@/lib/allocation";
import { ClaimStatus, ApprovalStep, Decision, Role } from "@/generated/prisma";
import Decimal from "decimal.js";

// ─── Head: sokong / tolak ─────────────────────────────────────────────────────

export async function headDecide(
  claimId: string,
  decision: "APPROVED" | "REJECTED",
  comment?: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: { claimant: { include: { roles: true } } },
  });
  if (!claim || claim.status !== ClaimStatus.SUBMITTED) throw new Error("INVALID_STATE");

  const ownApproval = canApproveAsHead(session.user, {
    claimantId: claim.claimantId,
    departmentId: claim.departmentId,
  });
  const delegation = !ownApproval
    ? await getActiveDelegation(session.user.id, Role.HEAD, claim.departmentId)
    : null;
  if (!ownApproval && (!delegation || claim.claimantId === session.user.id)) {
    throw new Error("UNAUTHORIZED");
  }

  const newStatus =
    decision === "APPROVED" ? ClaimStatus.HEAD_APPROVED : ClaimStatus.REJECTED;

  await prisma.approval.create({
    data: {
      claimId,
      step: ApprovalStep.HEAD,
      actorId: session.user.id,
      actorName: session.user.name ?? undefined,
      actorEmail: session.user.email ?? undefined,
      decision: Decision[decision],
      comment,
    },
  });

  await prisma.claim.update({ where: { id: claimId }, data: { status: newStatus } });

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: decision === "APPROVED" ? AuditAction.HEAD_APPROVED : AuditAction.HEAD_REJECTED,
    entity: "Claim",
    entityId: claimId,
    meta: { comment },
  });

  if (decision === "APPROVED") {
    // Notify finance
    await notifyFinanceTeam(claim);
  } else {
    // Notify claimant
    await dispatch({
      event: "CLAIM_REJECTED",
      recipientId: claim.claimantId,
      claim: {
        id: claim.id,
        refNo: claim.refNo,
        claimantName: claim.claimant.name,
        forMonth: claim.forMonth,
        forYear: claim.forYear,
        totalMyr: claim.totalClaimedMyr,
        status: "REJECTED",
      },
      meta: { reason: comment },
    });
  }

  return { ok: true };
}

// ─── Finance: semak + finalize ────────────────────────────────────────────────

export async function financeReview(
  claimId: string,
  items: Array<{ itemId: string; isEligible: boolean; reason?: string }>,
  comment?: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  const financeOk = isFinance(session.user) ||
    !!(await getActiveDelegation(session.user.id, Role.FINANCE));
  if (!financeOk) throw new Error("UNAUTHORIZED");

  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: {
      claimant: { include: { roles: true } },
      receipts: { include: { items: true } },
    },
  });
  if (!claim || claim.status !== ClaimStatus.HEAD_APPROVED) throw new Error("INVALID_STATE");

  // Update item eligibility
  for (const itemUpdate of items) {
    await prisma.receiptItem.update({
      where: { id: itemUpdate.itemId },
      data: {
        isEligible: itemUpdate.isEligible,
        flaggedReason: itemUpdate.reason,
      },
    });
  }

  // Recalculate eligible total
  const allItems = await prisma.receiptItem.findMany({
    where: { receipt: { claimId } },
  });
  const eligibleTotal = allItems
    .filter((i) => i.isEligible)
    .reduce((sum, i) => sum.plus(i.amountMyr.toString()), new Decimal(0));

  await prisma.approval.create({
    data: {
      claimId,
      step: ApprovalStep.FINANCE,
      actorId: session.user.id,
      actorName: session.user.name ?? undefined,
      actorEmail: session.user.email ?? undefined,
      decision: Decision.APPROVED,
      comment,
    },
  });

  await prisma.claim.update({
    where: { id: claimId },
    data: {
      status: ClaimStatus.FINANCE_REVIEWED,
      totalEligibleMyr: eligibleTotal.toDecimalPlaces(2).toNumber(),
    },
  });

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.FINANCE_REVIEWED,
    entity: "Claim",
    entityId: claimId,
    meta: { eligibleTotal: eligibleTotal.toString(), comment },
  });

  // Check if approver step should be skipped (APPROVER self-claim)
  const claimantRoles = claim.claimant.roles.map((r) => r.role);
  const ydpExists = await prisma.userRole.findFirst({ where: { role: Role.YDP }, select: { userId: true } });
  const skipApprover = shouldSkipApproverStep({ roles: claimantRoles }, ydpExists !== null);

  if (skipApprover) {
    const finalMyr = eligibleTotal.toDecimalPlaces(2);
    await prisma.approval.create({
      data: {
        claimId,
        step: ApprovalStep.APPROVER,
        actorId: session.user.id,
        actorName: session.user.name ?? undefined,
        actorEmail: session.user.email ?? undefined,
        decision: Decision.SKIPPED,
        comment: "Auto-skip: pemohon ialah Pelulus, tiada YDP aktif",
      },
    });
    await prisma.claim.update({
      where: { id: claimId },
      data: { status: ClaimStatus.APPROVED, totalApprovedMyr: finalMyr.toNumber() },
    });
    await prisma.annualAllocation.upsert({
      where: { userId_year: { userId: claim.claimantId, year: claim.forYear } },
      create: {
        userId: claim.claimantId,
        year: claim.forYear,
        limitMyr: await getDefaultAnnualLimit(),
        usedMyr: finalMyr.toNumber(),
      },
      update: { usedMyr: { increment: finalMyr.toNumber() } },
    });
    await logAction({
      actorId: session.user.id,
      actorName: session.user.name ?? undefined,
      action: AuditAction.CLAIM_APPROVED,
      entity: "Claim",
      entityId: claimId,
      meta: { approvedMyr: finalMyr.toString(), autoSkipApprover: true },
    });
    await dispatch({
      event: "CLAIM_APPROVED",
      recipientId: claim.claimantId,
      claim: {
        id: claim.id,
        refNo: claim.refNo,
        claimantName: claim.claimant.name,
        forMonth: claim.forMonth,
        forYear: claim.forYear,
        totalMyr: finalMyr.toNumber(),
        status: "APPROVED",
      },
    });
    return { ok: true, eligibleTotal: eligibleTotal.toString() };
  }

  // Normal flow — exclude claimant from notifications if they hold APPROVER role
  const claimantIsApprover = claimantRoles.includes(Role.APPROVER);
  await notifyApproverTeam(
    claimId,
    claim.refNo,
    claim.claimant.name,
    claim.forMonth,
    claim.forYear,
    eligibleTotal.toNumber(),
    claimantIsApprover ? claim.claimantId : undefined
  );

  return { ok: true, eligibleTotal: eligibleTotal.toString() };
}

// ─── Approver (Setiausaha): lulus / tolak ────────────────────────────────────

export async function approverDecide(
  claimId: string,
  decision: "APPROVED" | "REJECTED" | "OVERRIDDEN",
  approvedMyr?: number,
  comment?: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  const [approverDelegation, ydpDelegation] = await Promise.all([
    getActiveDelegation(session.user.id, Role.APPROVER),
    getActiveDelegation(session.user.id, Role.YDP),
  ]);
  const effectiveIsApprover = isApprover(session.user) || !!approverDelegation;
  const effectiveIsYdp = isYdp(session.user) || !!ydpDelegation;
  if (!effectiveIsApprover && !effectiveIsYdp) throw new Error("UNAUTHORIZED");

  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: { claimant: true },
  });

  if (!claim) throw new Error("NOT_FOUND");

  // Setiausaha: must be FINANCE_REVIEWED; YDP: can override APPROVED too
  const validStatuses: ClaimStatus[] = [ClaimStatus.FINANCE_REVIEWED];
  if (effectiveIsYdp) validStatuses.push(ClaimStatus.APPROVED);
  if (!validStatuses.includes(claim.status)) throw new Error("INVALID_STATE");

  const eligibleMyr = new Decimal(claim.totalEligibleMyr?.toString() ?? "0");
  const finalApprovedMyr =
    approvedMyr !== undefined
      ? new Decimal(approvedMyr)
      : eligibleMyr;

  const newStatus =
    decision === "REJECTED" ? ClaimStatus.REJECTED : ClaimStatus.APPROVED;

  await prisma.approval.create({
    data: {
      claimId,
      step: ApprovalStep.APPROVER,
      actorId: session.user.id,
      actorName: session.user.name ?? undefined,
      actorEmail: session.user.email ?? undefined,
      decision: Decision[decision],
      comment,
    },
  });

  await prisma.claim.update({
    where: { id: claimId },
    data: {
      status: newStatus,
      totalApprovedMyr:
        newStatus === ClaimStatus.APPROVED
          ? finalApprovedMyr.toDecimalPlaces(2).toNumber()
          : undefined,
    },
  });

  // Update annual allocation usage if approved
  if (newStatus === ClaimStatus.APPROVED) {
    const year = claim.forYear;
    await prisma.annualAllocation.upsert({
      where: { userId_year: { userId: claim.claimantId, year } },
      create: {
        userId: claim.claimantId,
        year,
        limitMyr: await getDefaultAnnualLimit(),
        usedMyr: finalApprovedMyr.toDecimalPlaces(2).toNumber(),
      },
      update: {
        usedMyr: { increment: finalApprovedMyr.toDecimalPlaces(2).toNumber() },
      },
    });
  }

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action:
      decision === "APPROVED"
        ? AuditAction.CLAIM_APPROVED
        : decision === "OVERRIDDEN"
        ? AuditAction.CLAIM_OVERRIDDEN
        : AuditAction.CLAIM_REJECTED,
    entity: "Claim",
    entityId: claimId,
    meta: { approvedMyr: finalApprovedMyr.toString(), comment },
  });

  // Notify claimant
  await dispatch({
    event: newStatus === ClaimStatus.APPROVED ? "CLAIM_APPROVED" : "CLAIM_REJECTED",
    recipientId: claim.claimantId,
    claim: {
      id: claim.id,
      refNo: claim.refNo,
      claimantName: claim.claimant.name,
      forMonth: claim.forMonth,
      forYear: claim.forYear,
      totalMyr: finalApprovedMyr.toNumber(),
      status: newStatus,
    },
    meta: { reason: comment },
  });

  return { ok: true };
}

// ─── Bulk approve (Approver/YDP only) ────────────────────────────────────────

export async function bulkApprove(claimIds: string[]) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  const bulkApproverOk = isApprover(session.user) || isYdp(session.user) ||
    !!(await getActiveDelegation(session.user.id, Role.APPROVER)) ||
    !!(await getActiveDelegation(session.user.id, Role.YDP));
  if (!bulkApproverOk) throw new Error("UNAUTHORIZED");
  if (claimIds.length === 0) throw new Error("NO_CLAIMS");
  if (claimIds.length > 50) throw new Error("TOO_MANY");

  let approved = 0;
  const failed: string[] = [];

  for (const claimId of claimIds) {
    try {
      const claim = await prisma.claim.findUnique({
        where: { id: claimId },
        include: { claimant: true },
      });
      if (!claim || claim.status !== ClaimStatus.FINANCE_REVIEWED) {
        failed.push(claimId);
        continue;
      }

      const finalMyr = new Decimal(
        claim.totalEligibleMyr?.toString() ?? claim.totalClaimedMyr.toString()
      ).toDecimalPlaces(2);

      await prisma.approval.create({
        data: {
          claimId,
          step: ApprovalStep.APPROVER,
          actorId: session.user.id,
          actorName: session.user.name ?? undefined,
          actorEmail: session.user.email ?? undefined,
          decision: Decision.APPROVED,
          comment: "Lulus pukal",
        },
      });

      await prisma.claim.update({
        where: { id: claimId },
        data: { status: ClaimStatus.APPROVED, totalApprovedMyr: finalMyr.toNumber() },
      });

      await prisma.annualAllocation.upsert({
        where: { userId_year: { userId: claim.claimantId, year: claim.forYear } },
        create: {
          userId: claim.claimantId,
          year: claim.forYear,
          limitMyr: await getDefaultAnnualLimit(),
          usedMyr: finalMyr.toNumber(),
        },
        update: { usedMyr: { increment: finalMyr.toNumber() } },
      });

      await logAction({
        actorId: session.user.id,
        actorName: session.user.name ?? undefined,
        action: AuditAction.CLAIM_APPROVED,
        entity: "Claim",
        entityId: claimId,
        meta: { approvedMyr: finalMyr.toString(), bulk: true },
      });

      await dispatch({
        event: "CLAIM_APPROVED",
        recipientId: claim.claimantId,
        claim: {
          id: claim.id,
          refNo: claim.refNo,
          claimantName: claim.claimant.name,
          forMonth: claim.forMonth,
          forYear: claim.forYear,
          totalMyr: finalMyr.toNumber(),
          status: "APPROVED",
        },
      });

      approved++;
    } catch {
      failed.push(claimId);
    }
  }

  return { approved, failed };
}

// ─── Mark paid ────────────────────────────────────────────────────────────────

export async function markPaid(claimId: string, voucherNo?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  const paidOk = isFinance(session.user) ||
    !!(await getActiveDelegation(session.user.id, Role.FINANCE));
  if (!paidOk) throw new Error("UNAUTHORIZED");

  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: { claimant: { select: { id: true, name: true } } },
  });
  if (!claim || claim.status !== ClaimStatus.APPROVED) throw new Error("INVALID_STATE");

  await prisma.claim.update({
    where: { id: claimId },
    data: { status: ClaimStatus.PAID, paidAt: new Date(), voucherNo: voucherNo || null },
  });

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.CLAIM_PAID,
    entity: "Claim",
    entityId: claimId,
    meta: voucherNo ? { voucherNo } : undefined,
  });

  dispatch({
    event: "CLAIM_PAID",
    recipientId: claim.claimantId,
    claim: {
      id: claim.id,
      refNo: claim.refNo,
      claimantName: claim.claimant.name,
      forMonth: claim.forMonth,
      forYear: claim.forYear,
      totalMyr: claim.totalApprovedMyr ?? claim.totalClaimedMyr,
      status: "PAID",
    },
    meta: voucherNo ? { voucherNo } : undefined,
  }).catch(() => {});

  return { ok: true };
}

export async function markPaidBulk(claimIds: string[], voucherNo?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  const paidOk = isFinance(session.user) ||
    !!(await getActiveDelegation(session.user.id, Role.FINANCE));
  if (!paidOk) throw new Error("UNAUTHORIZED");

  const claims = await prisma.claim.findMany({
    where: { id: { in: claimIds }, status: ClaimStatus.APPROVED },
    include: { claimant: { select: { id: true, name: true } } },
  });

  const now = new Date();
  await prisma.claim.updateMany({
    where: { id: { in: claims.map((c) => c.id) } },
    data: { status: ClaimStatus.PAID, paidAt: now, voucherNo: voucherNo || null },
  });

  await Promise.all(
    claims.map((claim) =>
      logAction({
        actorId: session.user.id,
        actorName: session.user.name ?? undefined,
        action: AuditAction.CLAIM_PAID,
        entity: "Claim",
        entityId: claim.id,
        meta: voucherNo ? { voucherNo, bulk: true } : { bulk: true },
      })
    )
  );

  claims.forEach((claim) => {
    dispatch({
      event: "CLAIM_PAID",
      recipientId: claim.claimantId,
      claim: {
        id: claim.id,
        refNo: claim.refNo,
        claimantName: claim.claimant.name,
        forMonth: claim.forMonth,
        forYear: claim.forYear,
        totalMyr: claim.totalApprovedMyr ?? claim.totalClaimedMyr,
        status: "PAID",
      },
      meta: voucherNo ? { voucherNo } : undefined,
    }).catch(() => {});
  });

  return { ok: true, count: claims.length };
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function notifyFinanceTeam(
  claim: { id: string; refNo: string; claimantId: string; forMonth: number; forYear: number; totalClaimedMyr: { toString(): string } | number; claimant: { name: string } }
) {
  const financeUsers = await prisma.userRole.findMany({
    where: { role: Role.FINANCE },
    select: { userId: true },
  });
  for (const fu of financeUsers) {
    await dispatch({
      event: "FINANCE_PENDING",
      recipientId: fu.userId,
      claim: {
        id: claim.id,
        refNo: claim.refNo,
        claimantName: claim.claimant.name,
        forMonth: claim.forMonth,
        forYear: claim.forYear,
        totalMyr: Number(claim.totalClaimedMyr),
        status: "HEAD_APPROVED",
      },
    });
  }
}

