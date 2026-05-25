import { prisma } from "@/lib/db";

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
}

export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  const rows = await prisma.settings.findMany({
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
  });
  const p = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    minLength: typeof p["password_min_length"] === "number" ? p["password_min_length"] : 8,
    requireUppercase: p["password_require_uppercase"] !== false,
    requireNumber: p["password_require_number"] !== false,
    requireSymbol: Boolean(p["password_require_symbol"] ?? false),
  };
}

export function validatePasswordPolicy(password: string, policy: PasswordPolicy): string | null {
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

export async function checkPasswordPolicy(password: string): Promise<string | null> {
  const policy = await getPasswordPolicy();
  return validatePasswordPolicy(password, policy);
}
