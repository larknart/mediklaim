import { prisma } from "@/lib/db";
import { sendInApp } from "./channels/inapp";
import { sendEmail } from "./channels/email";
import { enqueueWhatsApp } from "./channels/whatsapp";
type Decimal = { toString(): string };
import {
  emailCLAIM_SUBMITTED,
  emailCLAIM_APPROVED,
  emailCLAIM_REJECTED,
  emailCLAIM_PAID,
  emailACTION_REQUIRED,
  waCLAIM_APPROVED,
  waCLAIM_REJECTED,
  waCLAIM_PAID,
  waACTION_REQUIRED,
} from "./templates";

// ─── Event types ──────────────────────────────────────────────────────────────

export type NotifyEvent =
  | "CLAIM_SUBMITTED"
  | "HEAD_PENDING_REVIEW"
  | "FINANCE_PENDING"
  | "APPROVER_PENDING"
  | "CLAIM_APPROVED"
  | "CLAIM_REJECTED"
  | "CLAIM_PAID"
  | "ACTION_REQUIRED";

// WA-eligible events only (to reduce ban risk)
const WA_EVENTS: NotifyEvent[] = ["CLAIM_APPROVED", "CLAIM_REJECTED", "CLAIM_PAID", "ACTION_REQUIRED"];

// ─── Main dispatcher ──────────────────────────────────────────────────────────

interface DispatchParams {
  event: NotifyEvent;
  recipientId: string;
  claim: {
    id: string;
    refNo: string;
    claimantName: string;
    forMonth: number;
    forYear: number;
    totalMyr: Decimal | number;
    status: string;
  };
  meta?: {
    reason?: string;
    role?: string;
    daysPending?: number;
    voucherNo?: string;
  };
}

export async function dispatch(params: DispatchParams): Promise<void> {
  const { event, recipientId, claim, meta } = params;
  const totalMyr = Number(claim.totalMyr);

  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { email: true, name: true, phone: true },
  });
  if (!recipient) return;

  const claimLink = `/tuntutan/${claim.id}`;

  const ctx = {
    claimantName: claim.claimantName,
    refNo: claim.refNo,
    forMonth: claim.forMonth,
    forYear: claim.forYear,
    totalMyr,
    link: claimLink,
  };

  // ── In-app (always) ──
  const { title, body } = buildInAppMessage(event, claim.refNo, claim.claimantName, meta);
  const notifId = await sendInApp({
    userId: recipientId,
    type: event,
    title,
    body,
    link: claimLink,
  });

  // ── Email ──
  try {
    const emailPayload = buildEmailPayload(event, recipient.name ?? "", ctx, meta);
    if (emailPayload) {
      await sendEmail({ to: recipient.email, ...emailPayload });
      await prisma.notification.update({
        where: { id: notifId },
        data: { channels: { inApp: true, email: "sent" } },
      });
    }
  } catch (e) {
    await prisma.notification.update({
      where: { id: notifId },
      data: { channels: { inApp: true, email: `failed: ${String(e).slice(0, 100)}` } },
    });
  }

  // ── WhatsApp (critical events + WA_ENABLED + user has phone + opted in) ──
  if (
    process.env.WA_ENABLED === "true" &&
    WA_EVENTS.includes(event) &&
    recipient.phone
  ) {
    const waBody = buildWaMessage(event, recipient.name ?? "", ctx, meta);
    if (waBody) {
      await enqueueWhatsApp({ toPhone: recipient.phone, body: waBody, notificationId: notifId });
    }
  }
}

// ─── Message builders ─────────────────────────────────────────────────────────

function buildInAppMessage(
  event: NotifyEvent,
  refNo: string,
  claimantName: string,
  meta?: { reason?: string; role?: string; daysPending?: number; voucherNo?: string }
): { title: string; body: string } {
  switch (event) {
    case "CLAIM_SUBMITTED":
      return { title: "Tuntutan Diterima", body: `Tuntutan ${refNo} telah dihantar untuk semakan.` };
    case "HEAD_PENDING_REVIEW":
      return { title: "Sokongan Diperlukan", body: `Tuntutan ${refNo} daripada ${claimantName} menunggu sokongan anda.` };
    case "FINANCE_PENDING":
      return { title: "Semakan Kewangan Diperlukan", body: `Tuntutan ${refNo} daripada ${claimantName} perlu disemak.` };
    case "APPROVER_PENDING":
      return { title: "Kelulusan Diperlukan", body: `Tuntutan ${refNo} daripada ${claimantName} menunggu kelulusan.` };
    case "CLAIM_APPROVED":
      return { title: "Tuntutan Diluluskan ✓", body: `Tuntutan ${refNo} anda telah diluluskan.` };
    case "CLAIM_REJECTED":
      return { title: "Tuntutan Ditolak", body: `Tuntutan ${refNo} anda telah ditolak.${meta?.reason ? ` Sebab: ${meta.reason}` : ""}` };
    case "CLAIM_PAID":
      return { title: "Bayaran Telah Diproses ✓", body: `Bayaran bagi tuntutan ${refNo} telah diproses.${meta?.voucherNo ? ` No. Baucer: ${meta.voucherNo}` : ""}` };
    case "ACTION_REQUIRED":
      return { title: "Tindakan Diperlukan", body: `Tuntutan ${refNo} (${claimantName}) tertangguh ${meta?.daysPending ?? 0} hari.` };
  }
}

function buildEmailPayload(
  event: NotifyEvent,
  recipientName: string,
  ctx: Parameters<typeof emailCLAIM_SUBMITTED>[0],
  meta?: { reason?: string; role?: string; daysPending?: number; voucherNo?: string }
) {
  switch (event) {
    case "CLAIM_SUBMITTED":
      return emailCLAIM_SUBMITTED(ctx);
    case "HEAD_PENDING_REVIEW":
      return emailACTION_REQUIRED(recipientName, "Ketua Jabatan", ctx);
    case "FINANCE_PENDING":
      return emailACTION_REQUIRED(recipientName, "Pegawai Kewangan", ctx);
    case "APPROVER_PENDING":
      return emailACTION_REQUIRED(recipientName, "Pelulus", ctx);
    case "CLAIM_APPROVED":
      return emailCLAIM_APPROVED(ctx);
    case "CLAIM_REJECTED":
      return emailCLAIM_REJECTED({ ...ctx, reason: meta?.reason });
    case "CLAIM_PAID":
      return emailCLAIM_PAID({ ...ctx, voucherNo: meta?.voucherNo });
    case "ACTION_REQUIRED":
      return emailACTION_REQUIRED(recipientName, meta?.role ?? "Pegawai", ctx);
  }
}

function buildWaMessage(
  event: NotifyEvent,
  recipientName: string,
  ctx: Parameters<typeof waCLAIM_APPROVED>[0],
  meta?: { reason?: string; role?: string; daysPending?: number; voucherNo?: string }
): string | null {
  switch (event) {
    case "CLAIM_APPROVED":
      return waCLAIM_APPROVED(ctx);
    case "CLAIM_REJECTED":
      return waCLAIM_REJECTED({ ...ctx, reason: meta?.reason });
    case "CLAIM_PAID":
      return waCLAIM_PAID({ ...ctx, voucherNo: meta?.voucherNo });
    case "ACTION_REQUIRED":
      return waACTION_REQUIRED(
        recipientName,
        meta?.role ?? "Pegawai",
        ctx.refNo,
        ctx.claimantName,
        meta?.daysPending ?? 0
      );
    default:
      return null;
  }
}
