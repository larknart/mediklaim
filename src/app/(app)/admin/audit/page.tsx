import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { AuditFilter } from "./_components/audit-filter";
import { buildAuditWhere } from "./_lib/build-where";
import { Pagination } from "@/components/ui/pagination";
import { PageHeader } from "@/components/page-header";

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "bg-blue-50 text-blue-700",
  LOGIN_FAILED: "bg-red-50 text-red-700",
  ACCOUNT_LOCKED: "bg-red-100 text-red-800",
  CLAIM_SUBMITTED: "bg-success/5 text-primary",
  CLAIM_APPROVED: "bg-primary/10 text-primary",
  CLAIM_REJECTED: "bg-red-50 text-red-700",
  CLAIM_PAID: "bg-emerald-50 text-emerald-700",
  RECEIPT_UPLOADED: "bg-gray-50 text-gray-600",
  SETTINGS_UPDATED: "bg-yellow-50 text-yellow-700",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entity?: string; action?: string; actor?: string; from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) redirect("/dashboard");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const pageSize = 50;

  const filterAction = sp.action || null;
  const filterEntity = sp.entity || null;
  const filterActor = sp.actor || null;
  const filterFrom = sp.from || null;
  const filterTo = sp.to || null;

  const where = buildAuditWhere({
    action: filterAction ?? undefined,
    entity: filterEntity ?? undefined,
    actor: filterActor ?? undefined,
    from: filterFrom ?? undefined,
    to: filterTo ?? undefined,
  });

  const [logs, total, entityGroups] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["entity"], orderBy: { entity: "asc" } }),
  ]);

  const entities = entityGroups.map((g) => g.entity);
  const totalPages = Math.ceil(total / pageSize);

  const buildHref = (newPage: number) => {
    const params = new URLSearchParams();
    if (filterAction) params.set("action", filterAction);
    if (filterEntity) params.set("entity", filterEntity);
    if (filterActor) params.set("actor", filterActor);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    params.set("page", String(newPage));
    return `?${params}`;
  };

  const exportParams = new URLSearchParams();
  if (filterAction) exportParams.set("action", filterAction);
  if (filterEntity) exportParams.set("entity", filterEntity);
  if (filterActor) exportParams.set("actor", filterActor);
  if (filterFrom) exportParams.set("from", filterFrom);
  if (filterTo) exportParams.set("to", filterTo);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Log Audit"
        subtitle={`${total.toLocaleString()} rekod`}
        actions={
          <Button asChild variant="outline" size="sm">
            <a href={`/api/admin/audit/export?${exportParams}`}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </a>
          </Button>
        }
      />

      <AuditFilter
        filterAction={filterAction}
        filterEntity={filterEntity}
        filterActor={filterActor}
        filterFrom={filterFrom}
        filterTo={filterTo}
        entities={entities}
      />

      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">Tiada rekod audit.</div>
          ) : (
            <div className="divide-y text-sm">
              {logs.map((log) => {
                const colorClass = ACTION_COLORS[log.action] ?? "bg-gray-50 text-gray-600";
                return (
                  <div key={log.id} className="flex items-start gap-3 p-3">
                    <div className="shrink-0 w-32">
                      <p className="text-xs text-gray-400">
                        {new Date(log.createdAt).toLocaleDateString("ms-MY")}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(log.createdAt).toLocaleTimeString("ms-MY", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${colorClass}`}>
                          {log.action}
                        </span>
                        <span className="text-xs text-gray-500">{log.entity}</span>
                        {log.entityId && (
                          <span className="text-xs text-gray-400 font-mono truncate max-w-[120px]">
                            {log.entityId.slice(0, 12)}…
                          </span>
                        )}
                      </div>
                      {log.actorName && (
                        <p className="text-xs text-gray-500 mt-0.5">{log.actorName}</p>
                      )}
                      {log.meta && Object.keys(log.meta as object).length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">
                          {JSON.stringify(log.meta).slice(0, 80)}
                        </p>
                      )}
                    </div>
                    {log.ip && <span className="text-xs text-gray-400 shrink-0">{log.ip}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
