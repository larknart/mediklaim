"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAction, AuditAction } from "@/lib/audit";
import { checkPasswordPolicy } from "@/lib/password-policy-server";
import bcrypt from "bcryptjs";

export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash) throw new Error("NO_PASSWORD");

  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) throw new Error("WRONG_PASSWORD");

  const policyError = await checkPasswordPolicy(newPassword);
  if (policyError) throw new Error(policyError);

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: newHash },
  });

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.PASSWORD_CHANGED,
    entity: "User",
    entityId: session.user.id,
  });

  return { ok: true };
}

export async function updateProfile(data: { phone?: string }) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const phone = data.phone?.trim() || null;

  // Basic phone format validation — allow empty (clear), or digits/spaces/+/-/()
  if (phone && !/^[0-9+\-\s()]{7,20}$/.test(phone)) {
    throw new Error("Format nombor telefon tidak sah.");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { phone },
  });

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.USER_UPDATED,
    entity: "User",
    entityId: session.user.id,
    meta: { fields: ["phone"] },
  });

  return { ok: true };
}
