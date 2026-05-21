import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isHead } from "@/lib/permissions";
import { ClaimStatus } from "@/generated/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { FileText, CheckSquare } from "lucide-react";

export default async function SokonganPage() {
  const session = await auth();
  if (!session?.user || !isHead(session.user)) redirect("/dashboard");

  const claims = await prisma.claim.findMany({
    where: {
      status: ClaimStatus.SUBMITTED,
      departmentId: session.user.departmentId ?? undefined,
      claimantId: { not: session.user.id },
    },
    include: { claimant: true },
    orderBy: { submittedAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sokongan Ketua Jabatan</h1>
        <p className="text-gray-500 text-sm mt-1">{claims.length} tuntutan menunggu sokongan</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {claims.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Tiada tuntutan menunggu sokongan.</p>
            </div>
          ) : (
            <div className="divide-y">
              {claims.map((claim) => {
                const days = Math.floor(
                  (Date.now() - new Date(claim.submittedAt ?? claim.createdAt).getTime()) / 86400000
                );
                return (
                  <Link
                    key={claim.id}
                    href={`/tuntutan/${claim.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50"
                  >
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{claim.refNo}</p>
                      <p className="text-xs text-gray-500">
                        {claim.claimant.name} · Bulan {claim.forMonth}/{claim.forYear} · RM {Number(claim.totalClaimedMyr).toFixed(2)}
                      </p>
                    </div>
                    {days >= 3 && (
                      <Badge variant="destructive">{days}h tertangguh</Badge>
                    )}
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
