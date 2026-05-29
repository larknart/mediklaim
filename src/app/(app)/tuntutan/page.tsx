import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ClaimStatus } from "@/generated/prisma";
import { FileText, Plus } from "lucide-react";

const STATUS_LABELS: Record<ClaimStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT:            { label: "Draf",              variant: "secondary" },
  SUBMITTED:        { label: "Menunggu Sokongan", variant: "default" },
  HEAD_APPROVED:    { label: "Menunggu Kewangan", variant: "outline" },
  FINANCE_REVIEWED: { label: "Menunggu Kelulusan", variant: "outline" },
  APPROVED:         { label: "Diluluskan",        variant: "default" },
  REJECTED:         { label: "Ditolak",           variant: "destructive" },
  PAID:             { label: "Dibayar",           variant: "default" },
  WITHDRAWN:        { label: "Tarik Balik",       variant: "secondary" },
};

const MONTHS_BM = ["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ogos","Sep","Okt","Nov","Dis"];

export default async function TuntutanPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const claims = await prisma.claim.findMany({
    where: { claimantId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { receipts: true, approvals: true },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tuntutan Saya</h1>
          <p className="text-gray-500 text-sm mt-1">Semua tuntutan perubatan anda</p>
        </div>
        <Button asChild className="bg-green-700 hover:bg-green-800">
          <Link href="/tuntutan/baru">
            <Plus className="w-4 h-4 mr-2" />
            Buat Tuntutan
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {claims.length === 0 ? (
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
                const s = STATUS_LABELS[claim.status];
                const month = MONTHS_BM[claim.forMonth - 1];
                return (
                  <Link
                    key={claim.id}
                    href={`/tuntutan/${claim.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-green-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{claim.refNo}</p>
                      <p className="text-xs text-gray-500">
                        {month} {claim.forYear} · {claim.receipts.length} resit · RM {Number(claim.totalClaimedMyr).toFixed(2)}
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
    </div>
  );
}
