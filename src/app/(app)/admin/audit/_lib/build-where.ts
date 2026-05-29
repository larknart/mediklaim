export interface AuditFilter {
  action?: string;
  entity?: string;
  actor?: string;
  from?: string;
  to?: string;
}

export function buildAuditWhere(f: AuditFilter) {
  const where: Record<string, unknown> = {};

  if (f.action) where.action = f.action;
  if (f.entity) where.entity = f.entity;
  if (f.actor && f.actor.trim().length >= 2) {
    where.actorName = { contains: f.actor.trim(), mode: "insensitive" };
  }

  const from = f.from ? new Date(f.from) : undefined;
  const to = f.to ? (() => { const d = new Date(f.to!); d.setHours(23, 59, 59, 999); return d; })() : undefined;
  if (from || to) {
    where.createdAt = {
      ...(from && { gte: from }),
      ...(to && { lte: to }),
    };
  }

  return where;
}
