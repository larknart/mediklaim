import { prisma } from "@/lib/db";
import { validatePasswordPolicy } from "./password-policy";
import type { PasswordPolicy } from "./password-policy";

export type { PasswordPolicy } from "./password-policy";
export { validatePasswordPolicy } from "./password-policy";

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

export async function checkPasswordPolicy(password: string): Promise<string | null> {
  const policy = await getPasswordPolicy();
  return validatePasswordPolicy(password, policy);
}
