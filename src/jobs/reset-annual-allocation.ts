import { prisma } from "@/lib/db";
import { logAction, AuditAction } from "@/lib/audit";

export async function resetAnnualAllocation(year?: number): Promise<{ created: number; year: number }> {
  const targetYear = year ?? new Date().getFullYear();

  const [limitSetting, proRataSetting] = await Promise.all([
    prisma.settings.findUnique({ where: { key: "default_annual_limit" } }),
    prisma.settings.findUnique({ where: { key: "pro_rata_enabled" } }),
  ]);
  const defaultLimit = Number(limitSetting?.value ?? process.env.DEFAULT_ANNUAL_LIMIT ?? 1200);
  const proRataEnabled = proRataSetting?.value !== false;

  const users = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, joinDate: true },
  });

  let created = 0;

  for (const user of users) {
    const existing = await prisma.annualAllocation.findUnique({
      where: { userId_year: { userId: user.id, year: targetYear } },
    });

    if (!existing) {
      let limitMyr = defaultLimit;
      if (proRataEnabled && user.joinDate) {
        const jd = new Date(user.joinDate);
        if (jd.getFullYear() === targetYear) {
          // getMonth() is 0-indexed: July=6 → 12-6=6 months remaining (Jul–Dec)
          const monthsRemaining = 12 - jd.getMonth();
          limitMyr = Math.round((monthsRemaining / 12) * defaultLimit * 100) / 100;
        }
      }
      await prisma.annualAllocation.create({
        data: {
          userId: user.id,
          year: targetYear,
          limitMyr,
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
