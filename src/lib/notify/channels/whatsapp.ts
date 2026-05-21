import { prisma } from "@/lib/db";
import crypto from "crypto";
import { WaStatus } from "@/generated/prisma";

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = () => process.env.EVOLUTION_BASE_URL ?? "";
const INSTANCE = () => process.env.EVOLUTION_INSTANCE ?? "mediklaim";
const API_KEY = () => process.env.EVOLUTION_API_KEY ?? "";

// Rate limits (overridable via Settings later)
const MAX_PER_MINUTE = 20;
const MAX_PER_DAY = 500;
const JITTER_MIN_MS = 5_000;
const JITTER_MAX_MS = 15_000;
const PER_RECIPIENT_HOUR_CAP = 3;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Quiet hours: 10pm – 7am MYT (UTC+8 = 14:00–23:00 UTC)
const QUIET_HOURS = { startUtc: 14, endUtc: 23 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  return phone.replace(/^\+/, "").replace(/\s+/g, "");
}

function messageHash(toPhone: string, body: string): string {
  return crypto
    .createHash("sha256")
    .update(`${toPhone}::${body}`)
    .digest("hex");
}

function isQuietHour(): boolean {
  const hour = new Date().getUTCHours();
  return hour >= QUIET_HOURS.startUtc || hour < QUIET_HOURS.endUtc;
}

function nextNonQuietTime(): Date {
  const now = new Date();
  const d = new Date(now);
  // Advance to 7am MYT = 23:00 UTC previous day
  d.setUTCHours(QUIET_HOURS.endUtc, 0, 0, 0);
  if (d <= now) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

// ─── Queue enqueue ────────────────────────────────────────────────────────────

export interface WaQueuePayload {
  toPhone: string;
  body: string;
  notificationId?: string;
}

export async function enqueueWhatsApp(payload: WaQueuePayload): Promise<void> {
  const phone = normalizePhone(payload.toPhone);
  const hash = messageHash(phone, payload.body);

  // Dedupe: same hash within 10 min → skip
  const existing = await prisma.whatsAppOutbox.findFirst({
    where: {
      hash,
      status: { in: [WaStatus.PENDING, WaStatus.SENT] },
      scheduledAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
    },
  });
  if (existing) return;

  // Per-recipient hourly cap check
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.whatsAppOutbox.count({
    where: {
      toPhone: phone,
      status: WaStatus.SENT,
      sentAt: { gte: hourAgo },
    },
  });

  const scheduledAt = isQuietHour() ? nextNonQuietTime() : new Date();

  await prisma.whatsAppOutbox.create({
    data: {
      toPhone: phone,
      body: payload.body,
      notificationId: payload.notificationId,
      hash,
      scheduledAt,
      // Rate-limit: will be handled by queue worker
      status:
        recentCount >= PER_RECIPIENT_HOUR_CAP
          ? WaStatus.RATE_LIMITED
          : WaStatus.PENDING,
    },
  });
}

// ─── Worker: send one message ─────────────────────────────────────────────────

export async function sendWhatsAppDirect(
  toPhone: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const url = `${BASE_URL()}/message/sendText/${INSTANCE()}`;

  try {
    // Evolution API: typing presence first
    await fetch(`${BASE_URL()}/chat/sendPresence/${INSTANCE()}`, {
      method: "POST",
      headers: { apikey: API_KEY(), "Content-Type": "application/json" },
      body: JSON.stringify({
        number: toPhone,
        options: { presence: "composing", delay: 2000 },
      }),
    }).catch(() => {}); // non-fatal

    // Small wait for composing presence
    await new Promise((r) =>
      setTimeout(r, 2000 + Math.random() * 2000)
    );

    const res = await fetch(url, {
      method: "POST",
      headers: { apikey: API_KEY(), "Content-Type": "application/json" },
      body: JSON.stringify({ number: toPhone, text: body }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${err}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── Evolution connection check ───────────────────────────────────────────────

export async function checkEvolutionConnection(): Promise<{
  connected: boolean;
  state?: string;
}> {
  try {
    const res = await fetch(
      `${BASE_URL()}/instance/connectionState/${INSTANCE()}`,
      { headers: { apikey: API_KEY() }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { connected: false };
    const data = await res.json();
    const state = data?.instance?.state ?? data?.state ?? "unknown";
    return { connected: state === "open", state };
  } catch {
    return { connected: false };
  }
}

export {
  normalizePhone,
  MAX_PER_MINUTE,
  MAX_PER_DAY,
  JITTER_MIN_MS,
  JITTER_MAX_MS,
};
