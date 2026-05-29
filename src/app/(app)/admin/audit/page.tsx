import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "bg-blue-50 text-blue-700",
  LOGIN_FAILED: "bg-red-50 text-red-700",
  ACCOUNT_LOCKED: "bg-red-100 text-red-800",
  CLAIM_SUBMITTED: "bg-green-50 text-green-700",
  CLAIM_APPROVED: "bg-green-100 text-green-800",
  CLAIM_REJECTED: "bg-red-50 text-red-700",
  CLAIM_PAID: "bg-emerald-50 text-emerald-700",
  RECEIPT_UPLOADED: "bg-gray-50 text-gray-600",
  SETTINGS_UPDATED: "bg-yellow-50 text-yellow-700",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entity?: string; action?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) redirect("/dashboard");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const pageSize = 50;

  const where = {
    ...(sp.entity && { entity: sp.entity }),
    ...(sp.action && { action: sp.action }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Log Audit</h1>
        <p className="text-gray-500 text-sm mt-1">{total.toLocaleString()} rekod</p>
      </div>

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

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Halaman {page} / {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={`?page=${page - 1}`} className="px-3 py-1 border rounded hover:bg-gray-50">
                ← Sebelum
              </a>
            )}
            {page < totalPages && (
              <a href={`?page=${page + 1}`} className="px-3 py-1 border rounded hover:bg-gray-50">
                Seterusnya →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
