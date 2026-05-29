import { prisma } from "@/lib/db";
import { logAction, AuditAction } from "@/lib/audit";

export async function purgeAuditLogs(): Promise<{ deleted: number; cutoffDate: string }> {
  const setting = await prisma.settings.findUnique({ where: { key: "log_retention_years" } });
  const retentionYears = typeof setting?.value === "number" ? setting.value : 7;

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - retentionYears);

  const { count } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  if (count > 0) {
    await logAction({
      action: AuditAction.AUDIT_PURGE,
      entity: "AuditLog",
      meta: { deleted: count, retentionYears, cutoffDate: cutoff.toISOString() },
    });
  }

  return { deleted: count, cutoffDate: cutoff.toISOString() };
}
