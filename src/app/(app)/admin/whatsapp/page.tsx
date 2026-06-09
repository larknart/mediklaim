import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WaStatus } from "@/generated/prisma";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  SENT:    "bg-success/5 text-primary border-primary/20",
  FAILED:  "bg-red-50 text-red-700 border-red-200",
};

export default async function WhatsAppOutboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) redirect("/dashboard");

  const sp = await searchParams;
  const filterStatus = (sp.status as WaStatus | undefined) ?? undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const pageSize = 50;

  const where = filterStatus ? { status: filterStatus } : {};

  const [rows, total] = await Promise.all([
    prisma.whatsAppOutbox.findMany({
      where,
      orderBy: { scheduledAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.whatsAppOutbox.count({ where }),
  ]);

  const [totalPending, totalSent, totalFailed] = await Promise.all([
    prisma.whatsAppOutbox.count({ where: { status: WaStatus.PENDING } }),
    prisma.whatsAppOutbox.count({ where: { status: WaStatus.SENT } }),
    prisma.whatsAppOutbox.count({ where: { status: WaStatus.FAILED } }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const buildHref = (s?: string, p = 1) =>
    `?${new URLSearchParams({ ...(s && { status: s }), page: String(p) })}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outbox WhatsApp"
        subtitle={`${total} mesej ${filterStatus ? filterStatus.toLowerCase() : "keseluruhan"}`}
      />

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: "Semua", value: undefined, count: totalPending + totalSent + totalFailed },
          { label: "Tertunggak", value: "PENDING", count: totalPending },
          { label: "Terhantar", value: "SENT", count: totalSent },
          { label: "Gagal", value: "FAILED", count: totalFailed },
        ].map(({ label, value, count }) => {
          const active = filterStatus === value;
          return (
            <a
              key={label}
              href={buildHref(value)}
              className={`px-3 py-1.5 rounded-full text-sm border flex items-center gap-1.5 transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground border-border hover:bg-accent"
              }`}
            >
              {label}
              <span className={`text-xs font-mono ${active ? "opacity-80" : "text-muted-foreground"}`}>
                {count}
              </span>
            </a>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Tiada rekod.</div>
          ) : (
            <div className="divide-y text-sm">
              {rows.map((row) => (
                <div key={row.id} className="p-4 space-y-1">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{row.toPhone}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded border font-medium ${STATUS_STYLES[row.status] ?? "bg-muted/50 text-muted-foreground"}`}
                      >
                        {row.status}
                      </span>
                      {row.attempt > 0 && (
                        <span className="text-xs text-muted-foreground">{row.attempt}x cuba</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(row.scheduledAt).toLocaleString("ms-MY")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{row.body}</p>
                  {row.lastError && (
                    <p className="text-xs text-red-500 font-mono truncate">{row.lastError}</p>
                  )}
                  {row.sentAt && (
                    <p className="text-xs text-muted-foreground">
                      Terhantar: {new Date(row.sentAt).toLocaleString("ms-MY")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Halaman {page} / {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={buildHref(filterStatus, page - 1)} className="px-3 py-1 border rounded hover:bg-accent">
                ← Sebelum
              </a>
            )}
            {page < totalPages && (
              <a href={buildHref(filterStatus, page + 1)} className="px-3 py-1 border rounded hover:bg-accent">
                Seterusnya →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
