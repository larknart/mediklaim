import { prisma } from "@/lib/db";
import { logAction, AuditAction } from "@/lib/audit";
import { dispatch } from "@/lib/notify/dispatcher";
import { ClaimStatus, ApprovalStep, Role } from "@/generated/prisma";
import { computeSla } from "@/lib/sla";

export async function sendPendingReminders(): Promise<{ sent: number; skipped: number }> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Load SLA config + holidays
  const [slaSettings, holidays] = await Promise.all([
    prisma.settings.findMany({
      where: { key: { in: ["sla_head_days", "sla_finance_days", "sla_approver_days"] } },
    }),
    prisma.publicHoliday.findMany({
      where: { year: { in: [now.getFullYear(), now.getFullYear() - 1] } },
      select: { date: true },
    }),
  ]);

  const slaMap = Object.fromEntries(slaSettings.map((s) => [s.key, Number(s.value)]));
  const slaHeadDays = slaMap["sla_head_days"] ?? 3;
  const slaFinanceDays = slaMap["sla_finance_days"] ?? 5;
  const slaApproverDays = slaMap["sla_approver_days"] ?? 3;
  const holidaySet = new Set(holidays.map((h) => h.date.toISOString().split("T")[0]));

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
    claimId: string, refNo: string, claimantName: string,
    forMonth: number, forYear: number, totalMyr: number,
    status: string, recipientId: string, role: string,
    workingDaysElapsed: number, step: string
  ) {
    if (await alreadyRemindedToday(claimId, recipientId)) { skipped++; return; }
    await dispatch({
      event: "ACTION_REQUIRED",
      recipientId,
      claim: { id: claimId, refNo, claimantName, forMonth, forYear, totalMyr, status },
      meta: { role, daysPending: workingDaysElapsed },
    });
    await logAction({
      action: AuditAction.REMINDER_SENT, entity: "Claim", entityId: claimId,
      meta: { recipientId, workingDaysElapsed, step },
    });
    sent++;
  }

  // ── SUBMITTED → Head: remind when SLA WARNING or OVERDUE ────────────────────
  const submittedClaims = await prisma.claim.findMany({
    where: { status: ClaimStatus.SUBMITTED, submittedAt: { not: null } },
    include: {
      department: { select: { headId: true } },
      claimant: { select: { name: true } },
    },
  });

  for (const c of submittedClaims) {
    if (!c.submittedAt) continue;
    const sla = computeSla(c.submittedAt, slaHeadDays, holidaySet);
    if (sla.status === "OK") continue;
    const headId = c.department?.headId;
    if (!headId) { skipped++; continue; }
    await remind(c.id, c.refNo, c.claimant.name, c.forMonth, c.forYear,
      Number(c.totalClaimedMyr), c.status, headId, "Ketua Jabatan", sla.elapsed, "HEAD");
  }

  // ── HEAD_APPROVED → Finance ──────────────────────────────────────────────────
  const headApprovedClaims = await prisma.claim.findMany({
    where: { status: ClaimStatus.HEAD_APPROVED },
    include: {
      claimant: { select: { name: true } },
      approvals: { where: { step: ApprovalStep.HEAD }, orderBy: { decidedAt: "desc" }, take: 1 },
    },
  });

  const financeUsers = await prisma.userRole.findMany({
    where: { role: Role.FINANCE }, select: { userId: true },
  });

  for (const c of headApprovedClaims) {
    const latestApproval = c.approvals[0];
    if (!latestApproval) { skipped++; continue; }
    const sla = computeSla(latestApproval.decidedAt, slaFinanceDays, holidaySet);
    if (sla.status === "OK") continue;
    for (const fu of financeUsers) {
      await remind(c.id, c.refNo, c.claimant.name, c.forMonth, c.forYear,
        Number(c.totalClaimedMyr), c.status, fu.userId, "Pegawai Kewangan", sla.elapsed, "FINANCE");
    }
  }

  // ── FINANCE_REVIEWED → Approver/YDP ─────────────────────────────────────────
  const financeReviewedClaims = await prisma.claim.findMany({
    where: { status: ClaimStatus.FINANCE_REVIEWED },
    include: {
      claimant: { select: { name: true } },
      approvals: { where: { step: ApprovalStep.FINANCE }, orderBy: { decidedAt: "desc" }, take: 1 },
    },
  });

  const approverUsers = await prisma.userRole.findMany({
    where: { role: { in: [Role.APPROVER, Role.YDP] } }, select: { userId: true },
  });

  for (const c of financeReviewedClaims) {
    const latestApproval = c.approvals[0];
    if (!latestApproval) { skipped++; continue; }
    const sla = computeSla(latestApproval.decidedAt, slaApproverDays, holidaySet);
    if (sla.status === "OK") continue;
    for (const au of approverUsers) {
      await remind(c.id, c.refNo, c.claimant.name, c.forMonth, c.forYear,
        Number(c.totalClaimedMyr), c.status, au.userId, "Pelulus", sla.elapsed, "APPROVER");
    }
  }

  return { sent, skipped };
}
