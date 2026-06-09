import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { CLAIM_STATUS_CONFIG } from "@/lib/claim-status";
import { PageHeader } from "@/components/page-header";

const MONTHS_BM = ["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ogos","Sep","Okt","Nov","Dis"];
const PAGE_SIZE = 20;

export default async function TuntutanPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1"));

  const where = { claimantId: session.user.id };

  const [claims, total] = await Promise.all([
    prisma.claim.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { receipts: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.claim.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tuntutan Saya"
        subtitle={`${total} tuntutan`}
        actions={
          <Button asChild>
            <Link href="/tuntutan/baru">
              <Plus className="w-4 h-4 mr-2" />
              Buat Tuntutan
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {total === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Tiada tuntutan lagi.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/tuntutan/baru">Buat tuntutan pertama</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {claims.map((claim) => {
                const s = CLAIM_STATUS_CONFIG[claim.status];
                const month = MONTHS_BM[claim.forMonth - 1];
                return (
                  <Link
                    key={claim.id}
                    href={`/tuntutan/${claim.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{claim.refNo}</p>
                      <p className="text-xs text-gray-500">
                        {month} {claim.forYear} · {claim._count.receipts} resit · RM {Number(claim.totalClaimedMyr).toFixed(2)}
                      </p>
                    </div>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={(p) => `?page=${p}`}
      />
    </div>
  );
}
