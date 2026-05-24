import { prisma } from "@/lib/db";

export async function generateRefNo(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `claim_counter_${year}`;

  const [prefixRow, paddingRow] = await Promise.all([
    prisma.settings.findUnique({ where: { key: "ref_no_prefix" } }),
    prisma.settings.findUnique({ where: { key: "ref_no_padding" } }),
  ]);

  const prefix = typeof prefixRow?.value === "string" ? prefixRow.value : "MDS/MK";
  const padding = typeof paddingRow?.value === "number" ? paddingRow.value : 5;

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
  const padded = String(counter).padStart(padding, "0");
  return `${prefix}/${year}/${padded}`;
}

export async function getRefNoPreview(): Promise<{ nextRefNo: string; currentCounter: number }> {
  const year = new Date().getFullYear();
  const key = `claim_counter_${year}`;

  const [prefixRow, paddingRow, counterRow] = await Promise.all([
    prisma.settings.findUnique({ where: { key: "ref_no_prefix" } }),
    prisma.settings.findUnique({ where: { key: "ref_no_padding" } }),
    prisma.settings.findUnique({ where: { key } }),
  ]);

  const prefix = typeof prefixRow?.value === "string" ? prefixRow.value : "MDS/MK";
  const padding = typeof paddingRow?.value === "number" ? paddingRow.value : 5;
  const currentCounter = typeof counterRow?.value === "number" ? counterRow.value : 0;
  const nextCounter = currentCounter + 1;

  return {
    nextRefNo: `${prefix}/${year}/${String(nextCounter).padStart(padding, "0")}`,
    currentCounter,
  };
}
