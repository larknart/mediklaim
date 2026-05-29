import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { buildAuditWhere } from "@/app/(app)/admin/audit/_lib/build-where";

const CAP = 50_000;
const CHUNK = 1_000;
const BOM = "﻿";

function esc(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const where = buildAuditWhere({
    action: sp.get("action") ?? undefined,
    entity: sp.get("entity") ?? undefined,
    actor: sp.get("actor") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });

  const total = await prisma.auditLog.count({ where });
  const truncated = total > CAP;
  const limit = truncated ? CAP : total;

  const rows: string[] = [
    BOM + ["Tarikh", "Tindakan", "Entiti", "EntityID", "Pelaku", "IP", "Meta"]
      .map(esc)
      .join(","),
  ];

  let fetched = 0;
  while (fetched < limit) {
    const batch = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: fetched,
      take: Math.min(CHUNK, limit - fetched),
      select: { createdAt: true, action: true, entity: true, entityId: true, actorName: true, ip: true, meta: true },
    });

    for (const r of batch) {
      rows.push(
        [
          r.createdAt.toISOString(),
          r.action,
          r.entity,
          r.entityId ?? "",
          r.actorName ?? "",
          r.ip ?? "",
          r.meta ? JSON.stringify(r.meta) : "",
        ]
          .map(esc)
          .join(",")
      );
    }

    fetched += batch.length;
    if (batch.length < CHUNK) break;
  }

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const headers: Record<string, string> = {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="audit-${date}.csv"`,
  };
  if (truncated) headers["X-Truncated"] = "true";

  return new NextResponse(rows.join("\r\n"), { headers });
}
