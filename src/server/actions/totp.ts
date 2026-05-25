"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAction, AuditAction } from "@/lib/audit";
import {
  generateTotpSecret,
  verifyTotpCode,
  generateOtpAuthUrl,
  generateQrDataUrl,
  generateRecoveryCodes,
  hashRecoveryCodes,
} from "@/lib/totp";

export async function initiate2fa() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, totpEnabled: true },
  });
  if (!user) throw new Error("UNAUTHORIZED");
  if (user.totpEnabled) throw new Error("2FA sudah aktif.");

  const secret = generateTotpSecret();
  const otpUrl = generateOtpAuthUrl(user.email, secret);
  const qrDataUrl = await generateQrDataUrl(otpUrl);

  return { secret, qrDataUrl };
}

export async function confirm2fa(code: string, secret: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  if (typeof code !== "string" || code.length > 10) throw new Error("Input tidak sah.");
  if (typeof secret !== "string" || secret.length > 256) throw new Error("Input tidak sah.");

  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true },
  });
  if (!existing) throw new Error("UNAUTHORIZED");
  if (existing.totpEnabled) throw new Error("2FA sudah aktif.");

  // secret is caller-supplied (initiate2fa holds it only in client memory).
  // TOTP verification is the sole proof of possession — the code cannot be
  // forged without controlling the TOTP output for the given secret.
  if (!verifyTotpCode(code, secret)) {
    throw new Error("Kod tidak sah. Cuba semula.");
  }

  const recoveryCodes = generateRecoveryCodes();
  const hashedCodes = await hashRecoveryCodes(recoveryCodes);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: secret, totpEnabled: true, totpRecoveryCodes: hashedCodes },
  });

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.USER_UPDATED,
    entity: "User",
    entityId: session.user.id,
    meta: { action: "2fa_enabled" },
  });

  return { recoveryCodes };
}

export async function disable2fa(code: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  if (typeof code !== "string" || code.length > 10) throw new Error("Input tidak sah.");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user) throw new Error("UNAUTHORIZED");
  if (!user.totpEnabled) throw new Error("2FA tidak aktif.");
  if (!user.totpSecret) throw new Error("Konfigurasi 2FA tidak lengkap. Hubungi pentadbir.");

  if (!verifyTotpCode(code, user.totpSecret)) throw new Error("Kod tidak sah.");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: null, totpEnabled: false, totpRecoveryCodes: null },
  });

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.USER_UPDATED,
    entity: "User",
    entityId: session.user.id,
    meta: { action: "2fa_disabled" },
  });

  return { ok: true };
}
