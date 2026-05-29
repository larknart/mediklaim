"use server";

import { prisma } from "@/lib/db";
import { logAction, AuditAction } from "@/lib/audit";
import { sendEmail } from "@/lib/notify/channels/email";
import { checkPasswordPolicy } from "@/lib/password-policy-server";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function emailLayout(body: string, link: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;color:#333;background:#f5f5f5;margin:0;padding:20px}
  .card{background:#fff;border-radius:8px;padding:24px;max-width:600px;margin:0 auto}
  .header{background:#0f5132;color:#fff;border-radius:8px 8px 0 0;padding:16px 24px;margin:-24px -24px 24px}
  .btn{display:inline-block;background:#0f5132;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px}
  .footer{color:#999;font-size:12px;margin-top:24px;text-align:center}
  </style></head><body>
  <div class="card">
    <div class="header"><h2 style="margin:0">MediKlaim MDS</h2></div>
    ${body}
    <a href="${link}" class="btn">Set Kata Laluan Baru</a>
    <p style="font-size:12px;color:#888;margin-top:16px">Pautan ini sah selama 1 jam. Abaikan e-mel ini jika anda tidak membuat permintaan ini.</p>
    <div class="footer">Majlis Daerah Setiu &bull; Sistem Tuntutan Perubatan Elektronik</div>
  </div></body></html>`;
}

export async function requestPasswordReset(email: string) {
  // Always return OK — don't reveal whether email exists (anti-enumeration)
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, name: true, isActive: true },
  });

  if (!user || !user.isActive) return { ok: true };

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_EXPIRY_MS);

  // Upsert — one active token per email at a time
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({ data: { identifier: email, token, expires } });

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetLink = `${appUrl}/reset-kata-laluan?token=${token}`;

  await sendEmail({
    to: email,
    subject: "[MediKlaim] Tetapkan Semula Kata Laluan",
    html: emailLayout(
      `<h3>Tetapkan Semula Kata Laluan</h3>
       <p>Salam ${user.name},</p>
       <p>Permintaan untuk menetapkan semula kata laluan akaun MediKlaim anda telah diterima. Klik butang di bawah untuk meneruskan.</p>`,
      resetLink
    ),
  }).catch(() => {
    // Fire-and-forget — don't expose SMTP errors to client
  });

  await logAction({
    action: AuditAction.PASSWORD_CHANGED,
    entity: "User",
    entityId: user.id,
    meta: { type: "reset_requested" },
  });

  return { ok: true };
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const record = await prisma.verificationToken.findUnique({ where: { token } });

  if (!record) throw new Error("TOKEN_INVALID");
  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    throw new Error("TOKEN_EXPIRED");
  }

  const user = await prisma.user.findUnique({
    where: { email: record.identifier },
    select: { id: true, name: true, isActive: true },
  });
  if (!user || !user.isActive) throw new Error("TOKEN_INVALID");

  const policyError = await checkPasswordPolicy(newPassword);
  if (policyError) throw new Error(policyError);

  const newHash = await bcrypt.hash(newPassword, 10);

  await Promise.all([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash, loginFailCount: 0, lockedUntil: null, passwordChangedAt: new Date() } }),
    prisma.verificationToken.delete({ where: { token } }),
  ]);

  await logAction({
    actorId: user.id,
    actorName: user.name,
    action: AuditAction.PASSWORD_CHANGED,
    entity: "User",
    entityId: user.id,
    meta: { type: "reset_completed" },
  });

  return { ok: true };
}
