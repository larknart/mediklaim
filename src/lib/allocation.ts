import { prisma } from "@/lib/db";

/**
 * Returns the configured default annual allocation limit (MYR).
 * Reads from the `default_annual_limit` Settings row first, falls back to
 * the DEFAULT_ANNUAL_LIMIT env var, then hard-codes 1200 as last resort.
 */
export async function getDefaultAnnualLimit(): Promise<number> {
  const setting = await prisma.settings.findUnique({
    where: { key: "default_annual_limit" },
  });
  return Number(setting?.value ?? process.env.DEFAULT_ANNUAL_LIMIT ?? 1200);
}
