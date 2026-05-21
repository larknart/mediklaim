import { prisma } from "@/lib/db";

// Generate ref no: MDS/MK/2026/00001
// Counter resets each year using Settings.claim_counter_{year}
export async function generateRefNo(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `claim_counter_${year}`;

  // Atomic increment via raw SQL to avoid race conditions
  await prisma.$executeRaw`
    INSERT INTO "Settings" (key, value, "updatedAt")
    VALUES (${key}, '0'::jsonb, NOW())
    ON CONFLICT (key) DO NOTHING
  `;

  const result = await prisma.$queryRaw<{ value: number }[]>`
    UPDATE "Settings"
    SET value = (value::int + 1)::text::jsonb, "updatedAt" = NOW()
    WHERE key = ${key}
    RETURNING value::int as value
  `;

  const counter = result[0]?.value ?? 1;
  const padded = String(counter).padStart(5, "0");
  return `MDS/MK/${year}/${padded}`;
}
