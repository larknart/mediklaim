import { prisma } from "@/lib/db";
import { logAction, AuditAction } from "@/lib/audit";

export async function resetAnnualAllocation(year?: number): Promise<{ created: number; year: number }> {
  const targetYear = year ?? new Date().getFullYear();
  const defaultLimit = parseFloat(process.env.DEFAULT_ANNUAL_LIMIT ?? "1200");

  // Get all active users
  const users = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true },
  });

  let created = 0;

  for (const user of users) {
    const existing = await prisma.annualAllocation.findUnique({
      where: { userId_year: { userId: user.id, year: targetYear } },
    });

    if (!existing) {
      await prisma.annualAllocation.create({
        data: {
          userId: user.id,
          year: targetYear,
          limitMyr: defaultLimit,
          usedMyr: 0,
        },
      });
      created++;
    }
  }

  await logAction({
    action: `${AuditAction.LIMIT_RESET}_${targetYear}`,
    entity: "AnnualAllocation",
    meta: { year: targetYear, usersProcessed: users.length, created, defaultLimit },
  });

  return { created, year: targetYear };
}
