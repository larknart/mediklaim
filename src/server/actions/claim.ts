"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAction, AuditAction } from "@/lib/audit";
import { dispatch } from "@/lib/notify/dispatcher";
import { generateRefNo } from "@/lib/refno";
import { shouldSkipHeadStep } from "@/lib/permissions";
import { ClaimStatus, ReceiptStatus, Role, ApprovalStep, Decision } from "@/generated/prisma";
import Decimal from "decimal.js";

// ─── Create claim (from staged receipts) ─────────────────────────────────────

export async function createClaim(data: {
  forMonth: number;
  forYear: number;
  receiptIds: string[];
  resubmittedFromId?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  if (data.receiptIds.length === 0) throw new Error("NO_RECEIPTS");
  if (data.forMonth < 1 || data.forMonth > 12) throw new Error("INVALID_MONTH");

  // Verify all receipts belong to user + are UNSORTED
  const receipts = await prisma.receipt.findMany({
    where: {
      id: { in: data.receiptIds },
      ownerId: session.user.id,
      status: ReceiptStatus.UNSORTED,
    },
    include: { items: true },
  });

  if (receipts.length !== data.receiptIds.length) throw new Error("INVALID_RECEIPTS");

  // Calculate total
  const total = receipts.reduce((sum, r) => {
    const t = r.totalMyr ?? r.items.reduce((s, i) => s.plus(i.amountMyr.toString()), new Decimal(0));
    return sum.plus(t.toString());
  }, new Decimal(0));

  // Check annual limit
  const year = data.forYear;
  const allocation = await prisma.annualAllocation.findUnique({
    where: { userId_year: { userId: session.user.id, year } },
  });
  const limit = new Decimal(allocation?.limitMyr?.toString() ?? process.env.DEFAULT_ANNUAL_LIMIT ?? "1200");
  const used = new Decimal(allocation?.usedMyr?.toString() ?? "0");
  const remaining = limit.minus(used);

  const refNo = await generateRefNo();

  const claimant = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });
  if (!claimant) throw new Error("USER_NOT_FOUND");

  const skipHead = shouldSkipHeadStep({
    isAhliMajlis: claimant.isAhliMajlis,
    roles: claimant.roles.map((r) => r.role),
  });

  const claim = await prisma.claim.create({
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
  });

  // Mark receipts as attached
  await prisma.receipt.updateMany({
    where: { id: { in: data.receiptIds } },
    data: { status: ReceiptStatus.ATTACHED, claimId: claim.id },
  });

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

  if (skipHead) {
    // Auto-approve HEAD step
    await prisma.approval.create({
      data: {
        claimId: claim.id,
        step: ApprovalStep.HEAD,
        actorId: session.user.id,
        decision: Decision.SKIPPED,
        comment: "Auto-skip: claimant is Head/Approver/AhliMajlis",
      },
    });
    await prisma.claim.update({
      where: { id: claim.id },
      data: { status: ClaimStatus.HEAD_APPROVED },
    });
    await logAction({
      actorId: session.user.id,
      actorName: session.user.name ?? undefined,
      action: AuditAction.HEAD_SKIPPED_SELF_CLAIM,
      entity: "Claim",
      entityId: claim.id,
    });
    // Notify finance
    await notifyFinanceTeam(claim.id, refNo, session.user.name ?? "", data.forMonth, data.forYear, total.toNumber());
  } else {
    // Notify head of claimant's department
    await notifyHead(
      session.user.departmentId,
      claim.id,
      refNo,
      session.user.name ?? "",
      data.forMonth,
      data.forYear,
      total.toNumber()
    );
    // Notify claimant confirmation
    await dispatch({
      event: "CLAIM_SUBMITTED",
      recipientId: session.user.id,
      claim: { id: claim.id, refNo, claimantName: session.user.name ?? "", forMonth: data.forMonth, forYear: data.forYear, totalMyr: total.toNumber(), status: "SUBMITTED" },
    });
  }

  return { id: claim.id, refNo, total: total.toString(), remaining: remaining.toString() };
}

// ─── Withdraw claim ───────────────────────────────────────────────────────────

export async function withdrawClaim(claimId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const claim = await prisma.claim.findUnique({ where: { id: claimId } });
  if (!claim || claim.claimantId !== session.user.id) throw new Error("NOT_FOUND");
  if (claim.status !== ClaimStatus.SUBMITTED) throw new Error("CANNOT_WITHDRAW");

  const refNo = claim.refNo;

  // Detach receipts back to inbox
  await prisma.receipt.updateMany({
    where: { claimId },
    data: { status: ReceiptStatus.UNSORTED, claimId: null },
  });

  // Delete pending action notifications (claim stays as audit record)
  await prisma.notification.deleteMany({ where: { link: { contains: claimId } } });

  // Soft-delete: keep claim + approvals for audit trail, just mark WITHDRAWN
  await prisma.claim.update({
    where: { id: claimId },
    data: { status: ClaimStatus.WITHDRAWN },
  });

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.CLAIM_WITHDRAWN,
    entity: "Claim",
    entityId: claimId,
    meta: { refNo },
  });

  return { ok: true };
}

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

  const receipts = await prisma.receipt.findMany({
    where: { claimId },
    select: { id: true },
  });
  const receiptIds = receipts.map((r) => r.id);

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

  return { originalClaimId: claimId, receiptIds };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function notifyHead(
  departmentId: string | null,
  claimId: string,
  refNo: string,
  claimantName: string,
  forMonth: number,
  forYear: number,
  totalMyr: number
) {
  if (!departmentId) return;
  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dept?.headId) return;

  await dispatch({
    event: "HEAD_PENDING_REVIEW",
    recipientId: dept.headId,
    claim: { id: claimId, refNo, claimantName, forMonth, forYear, totalMyr, status: "SUBMITTED" },
  });
}

async function notifyFinanceTeam(
  claimId: string,
  refNo: string,
  claimantName: string,
  forMonth: number,
  forYear: number,
  totalMyr: number
) {
  const financeUsers = await prisma.userRole.findMany({
    where: { role: Role.FINANCE },
    select: { userId: true },
  });

  for (const fu of financeUsers) {
    await dispatch({
      event: "FINANCE_PENDING",
      recipientId: fu.userId,
      claim: { id: claimId, refNo, claimantName, forMonth, forYear, totalMyr, status: "HEAD_APPROVED" },
    });
  }
}

export async function notifyApproverTeam(
  claimId: string,
  refNo: string,
  claimantName: string,
  forMonth: number,
  forYear: number,
  totalMyr: number,
  excludeUserId?: string
) {
  const approvers = await prisma.userRole.findMany({
    where: {
      role: { in: [Role.APPROVER, Role.YDP] },
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    select: { userId: true },
  });

  for (const a of approvers) {
    await dispatch({
      event: "APPROVER_PENDING",
      recipientId: a.userId,
      claim: { id: claimId, refNo, claimantName, forMonth, forYear, totalMyr, status: "FINANCE_REVIEWED" },
    });
  }
}
