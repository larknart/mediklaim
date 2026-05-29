import { prisma } from "@/lib/db";
import { logAction, AuditAction } from "@/lib/audit";
import { getDefaultAnnualLimit } from "@/lib/allocation";

export async function resetAnnualAllocation(year?: number): Promise<{ created: number; year: number }> {
  const targetYear = year ?? new Date().getFullYear();

  const [defaultLimit, proRataSetting] = await Promise.all([
    getDefaultAnnualLimit(),
    prisma.settings.findUnique({ where: { key: "pro_rata_enabled" } }),
  ]);
  const proRataEnabled = proRataSetting?.value !== false;

  const [users, existing] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, joinDate: true },
    }),
    prisma.annualAllocation.findMany({
      where: { year: targetYear },
      select: { userId: true },
    }),
  ]);

  const existingIds = new Set(existing.map((a) => a.userId));

  const toCreate = users
    .filter((u) => !existingIds.has(u.id))
    .map((u) => {
      let limitMyr = defaultLimit;
      if (proRataEnabled && u.joinDate) {
        const jd = new Date(u.joinDate);
        if (jd.getFullYear() === targetYear) {
          // getMonth() is 0-indexed: July=6 → 12-6=6 months remaining (Jul–Dec)
          const monthsRemaining = 12 - jd.getMonth();
          limitMyr = Math.round((monthsRemaining / 12) * defaultLimit * 100) / 100;
        }
      }
      return { userId: u.id, year: targetYear, limitMyr, usedMyr: 0 };
    });

  if (toCreate.length > 0) {
    await prisma.annualAllocation.createMany({ data: toCreate, skipDuplicates: true });
  }

  const created = toCreate.length;

  await logAction({
    action: AuditAction.LIMIT_RESET,
    entity: "AnnualAllocation",
    meta: { year: targetYear, usersProcessed: users.length, created, defaultLimit },
  });

  return { created, year: targetYear };
}
