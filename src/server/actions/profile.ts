"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAction, AuditAction } from "@/lib/audit";
import bcrypt from "bcryptjs";

function validatePasswordPolicy(
  password: string,
  policy: {
    minLength: number;
    requireUppercase: boolean;
    requireNumber: boolean;
    requireSymbol: boolean;
  }
): string | null {
  if (password.length < policy.minLength)
    return `Kata laluan perlu sekurang-kurangnya ${policy.minLength} aksara.`;
  if (policy.requireUppercase && !/[A-Z]/.test(password))
    return "Kata laluan perlu mengandungi sekurang-kurangnya satu huruf besar.";
  if (policy.requireNumber && !/[0-9]/.test(password))
    return "Kata laluan perlu mengandungi sekurang-kurangnya satu nombor.";
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password))
    return "Kata laluan perlu mengandungi sekurang-kurangnya satu simbol.";
  return null;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const [user, policyRows] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } }),
    prisma.settings.findMany({
      where: {
        key: {
          in: [
            "password_min_length",
            "password_require_uppercase",
            "password_require_number",
            "password_require_symbol",
          ],
        },
      },
    }),
  ]);

  if (!user?.passwordHash) throw new Error("NO_PASSWORD");

  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) throw new Error("WRONG_PASSWORD");

  const p = Object.fromEntries(policyRows.map((r) => [r.key, r.value]));
  const policy = {
    minLength: typeof p["password_min_length"] === "number" ? p["password_min_length"] : 8,
    requireUppercase: p["password_require_uppercase"] !== false,
    requireNumber: p["password_require_number"] !== false,
    requireSymbol: Boolean(p["password_require_symbol"] ?? false),
  };

  const policyError = validatePasswordPolicy(newPassword, policy);
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
