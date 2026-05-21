import { prisma } from "@/lib/db";
import {
  sendWhatsAppDirect,
  checkEvolutionConnection,
  MAX_PER_MINUTE,
  MAX_PER_DAY,
  JITTER_MIN_MS,
  JITTER_MAX_MS,
} from "@/lib/notify/channels/whatsapp";
import { WaStatus } from "@/generated/prisma";

let isCircuitBroken = false;
let circuitBrokenUntil: Date | null = null;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter() {
  return JITTER_MIN_MS + Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS);
}

// ─── Health check cron (every 5 min) ─────────────────────────────────────────

export async function checkWhatsAppHealth(): Promise<{ connected: boolean; circuitBroken: boolean }> {
  const { connected } = await checkEvolutionConnection();

  if (!connected) {
    // Circuit break for 30 minutes
    isCircuitBroken = true;
    circuitBrokenUntil = new Date(Date.now() + 30 * 60 * 1000);
    console.error("[WA] Evolution API disconnected. Circuit broken until:", circuitBrokenUntil);
  } else if (isCircuitBroken && circuitBrokenUntil && circuitBrokenUntil < new Date()) {
    isCircuitBroken = false;
    circuitBrokenUntil = null;
    console.log("[WA] Circuit restored.");
  }

  return { connected, circuitBroken: isCircuitBroken };
}

// ─── Queue worker (run on interval or on-demand) ──────────────────────────────

export async function processWhatsAppQueue(): Promise<{ processed: number; failed: number }> {
  if (isCircuitBroken) {
    if (circuitBrokenUntil && circuitBrokenUntil < new Date()) {
      isCircuitBroken = false;
    } else {
      return { processed: 0, failed: 0 };
    }
  }

  // Per-day cap
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sentToday = await prisma.whatsAppOutbox.count({
    where: { status: WaStatus.SENT, sentAt: { gte: todayStart } },
  });

  if (sentToday >= MAX_PER_DAY) {
    console.log(`[WA] Daily cap reached: ${sentToday}/${MAX_PER_DAY}`);
    return { processed: 0, failed: 0 };
  }

  const remaining = MAX_PER_DAY - sentToday;
  const batchLimit = Math.min(MAX_PER_MINUTE, remaining);

  const pending = await prisma.whatsAppOutbox.findMany({
    where: {
      status: WaStatus.PENDING,
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    take: batchLimit,
  });

  let processed = 0;
  let failed = 0;

  for (const msg of pending) {
    // Mark in-flight
    await prisma.whatsAppOutbox.update({
      where: { id: msg.id },
      data: { status: WaStatus.RATE_LIMITED }, // temp status while processing
    });

    const result = await sendWhatsAppDirect(msg.toPhone, msg.body);

    if (result.success) {
      await prisma.whatsAppOutbox.update({
        where: { id: msg.id },
        data: { status: WaStatus.SENT, sentAt: new Date(), attempt: msg.attempt + 1 },
      });
      processed++;
    } else {
      const newAttempt = msg.attempt + 1;
      if (newAttempt >= 3) {
        // Max retries — mark FAILED, trigger email fallback
        await prisma.whatsAppOutbox.update({
          where: { id: msg.id },
          data: { status: WaStatus.FAILED, attempt: newAttempt, lastError: result.error },
        });

        // Consecutive failures: circuit break
        const recentFails = await prisma.whatsAppOutbox.count({
          where: {
            status: WaStatus.FAILED,
            sentAt: null,
            scheduledAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
          },
        });
        if (recentFails >= 3) {
          isCircuitBroken = true;
          circuitBrokenUntil = new Date(Date.now() + 30 * 60 * 1000);
          console.error("[WA] 3+ consecutive failures. Circuit broken.");
          break;
        }
        failed++;
      } else {
        // Re-queue with backoff
        const backoffMs = Math.pow(2, newAttempt) * 60_000;
        await prisma.whatsAppOutbox.update({
          where: { id: msg.id },
          data: {
            status: WaStatus.PENDING,
            attempt: newAttempt,
            lastError: result.error,
            scheduledAt: new Date(Date.now() + backoffMs),
          },
        });
      }
    }

    // Jitter between sends
    if (pending.indexOf(msg) < pending.length - 1) {
      await sleep(jitter());
    }
  }

  return { processed, failed };
}
