import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isApprover, isYdp } from "@/lib/permissions";
import { ClaimStatus } from "@/generated/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { FileText, Shield } from "lucide-react";

export default async function KelulusanPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isApprover(session.user) && !isYdp(session.user)) redirect("/dashboard");

  // YDP can see APPROVED (for override), Approver only FINANCE_REVIEWED
  const statuses = isYdp(session.user)
    ? [ClaimStatus.FINANCE_REVIEWED, ClaimStatus.APPROVED]
    : [ClaimStatus.FINANCE_REVIEWED];

  const claims = await prisma.claim.findMany({
    where: { status: { in: statuses } },
    include: { claimant: true, department: true },
    orderBy: { submittedAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kelulusan</h1>
        <p className="text-gray-500 text-sm mt-1">{claims.length} tuntutan</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {claims.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Tiada tuntutan menunggu kelulusan.</p>
            </div>
          ) : (
            <div className="divide-y">
              {claims.map((claim) => (
                <Link
                  key={claim.id}
                  href={`/tuntutan/${claim.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50"
                >
                  <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-green-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{claim.refNo}</p>
                    <p className="text-xs text-gray-500">
                      {claim.claimant.name} · {claim.department?.name}
                    </p>
                    <p className="text-xs font-medium text-green-700 mt-0.5">
                      Layak: RM {Number(claim.totalEligibleMyr ?? claim.totalClaimedMyr).toFixed(2)}
                    </p>
                  </div>
                  <Badge variant={claim.status === ClaimStatus.APPROVED ? "default" : "outline"}>
                    {claim.status === ClaimStatus.APPROVED ? "Diluluskan (Override?)" : "Menunggu Kelulusan"}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
