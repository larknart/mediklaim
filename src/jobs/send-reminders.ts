import { prisma } from "@/lib/db";
import { logAction, AuditAction } from "@/lib/audit";
import { dispatch } from "@/lib/notify/dispatcher";
import { ClaimStatus, ApprovalStep, Role } from "@/generated/prisma";

const THRESHOLD_DAYS = 3;
const MS_PER_DAY = 86_400_000;

export async function sendPendingReminders(): Promise<{ sent: number; skipped: number }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - THRESHOLD_DAYS * MS_PER_DAY);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  let sent = 0;
  let skipped = 0;

  async function alreadyRemindedToday(claimId: string, recipientId: string): Promise<boolean> {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: recipientId,
        type: "ACTION_REQUIRED",
        link: { contains: claimId },
        createdAt: { gte: todayStart },
      },
      select: { id: true },
    });
    return existing !== null;
  }

  async function remind(
    claimId: string,
    refNo: string,
    claimantName: string,
    forMonth: number,
    forYear: number,
    totalMyr: number,
    status: string,
    recipientId: string,
    role: string,
    daysPending: number,
    step: string
  ) {
    if (await alreadyRemindedToday(claimId, recipientId)) {
      skipped++;
      return;
    }
    await dispatch({
      event: "ACTION_REQUIRED",
      recipientId,
      claim: { id: claimId, refNo, claimantName, forMonth, forYear, totalMyr, status },
      meta: { role, daysPending },
    });
    await logAction({
      action: AuditAction.REMINDER_SENT,
      entity: "Claim",
      entityId: claimId,
      meta: { recipientId, daysPending, step },
    });
    sent++;
  }

  // ── SUBMITTED → Head ─────────────────────────────────────────────────────────
  const submittedClaims = await prisma.claim.findMany({
    where: { status: ClaimStatus.SUBMITTED, submittedAt: { lte: cutoff } },
    include: {
      department: { select: { headId: true } },
      claimant: { select: { name: true } },
    },
  });

  for (const c of submittedClaims) {
    const headId = c.department?.headId;
    if (!headId) { skipped++; continue; }
    const days = Math.floor((now.getTime() - (c.submittedAt?.getTime() ?? 0)) / MS_PER_DAY);
    await remind(c.id, c.refNo, c.claimant.name, c.forMonth, c.forYear,
      Number(c.totalClaimedMyr), c.status, headId, "Ketua Jabatan", days, "HEAD");
  }

  // ── HEAD_APPROVED → Finance ───────────────────────────────────────────────────
  const headApprovedClaims = await prisma.claim.findMany({
    where: {
      status: ClaimStatus.HEAD_APPROVED,
      approvals: { some: { step: ApprovalStep.HEAD, decidedAt: { lte: cutoff } } },
    },
    include: {
      claimant: { select: { name: true } },
      approvals: { where: { step: ApprovalStep.HEAD }, orderBy: { decidedAt: "desc" }, take: 1 },
    },
  });

  const financeUsers = await prisma.userRole.findMany({
    where: { role: Role.FINANCE },
    select: { userId: true },
  });

  for (const c of headApprovedClaims) {
    const latestApproval = c.approvals[0];
    if (!latestApproval) { skipped++; continue; }
    const days = Math.floor((now.getTime() - latestApproval.decidedAt.getTime()) / MS_PER_DAY);
    for (const fu of financeUsers) {
      await remind(c.id, c.refNo, c.claimant.name, c.forMonth, c.forYear,
        Number(c.totalClaimedMyr), c.status, fu.userId, "Pegawai Kewangan", days, "FINANCE");
    }
  }

  // ── FINANCE_REVIEWED → Approver/YDP ──────────────────────────────────────────
  const financeReviewedClaims = await prisma.claim.findMany({
    where: {
      status: ClaimStatus.FINANCE_REVIEWED,
      approvals: { some: { step: ApprovalStep.FINANCE, decidedAt: { lte: cutoff } } },
    },
    include: {
      claimant: { select: { name: true } },
      approvals: { where: { step: ApprovalStep.FINANCE }, orderBy: { decidedAt: "desc" }, take: 1 },
    },
  });

  const approverUsers = await prisma.userRole.findMany({
    where: { role: { in: [Role.APPROVER, Role.YDP] } },
    select: { userId: true },
  });

  for (const c of financeReviewedClaims) {
    const latestApproval = c.approvals[0];
    if (!latestApproval) { skipped++; continue; }
    const days = Math.floor((now.getTime() - latestApproval.decidedAt.getTime()) / MS_PER_DAY);
    for (const au of approverUsers) {
      await remind(c.id, c.refNo, c.claimant.name, c.forMonth, c.forYear,
        Number(c.totalClaimedMyr), c.status, au.userId, "Pelulus", days, "APPROVER");
    }
  }

  return { sent, skipped };
}
