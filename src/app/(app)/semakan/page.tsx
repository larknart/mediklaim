import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isFinance } from "@/lib/permissions";
import { ClaimStatus } from "@/generated/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { FileText, Calculator, Banknote } from "lucide-react";
import { BulkPaidPanel } from "./_components/bulk-paid-panel";

export default async function SemulaPage() {
  const session = await auth();
  if (!session?.user || !isFinance(session.user)) redirect("/dashboard");

  const [reviewClaims, approvedClaims] = await Promise.all([
    prisma.claim.findMany({
      where: { status: ClaimStatus.HEAD_APPROVED },
      include: { claimant: true, department: true },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.claim.findMany({
      where: { status: ClaimStatus.APPROVED },
      include: { claimant: true, department: true },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Semakan Kewangan</h1>
        <p className="text-gray-500 text-sm mt-1">
          {reviewClaims.length} menunggu semakan · {approvedClaims.length} menunggu pembayaran
        </p>
      </div>

      {/* Queue 1: Needs finance review */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Menunggu Semakan ({reviewClaims.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {reviewClaims.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">Tiada tuntutan menunggu semakan.</div>
          ) : (
            <div className="divide-y">
              {reviewClaims.map((claim) => (
                <Link
                  key={claim.id}
                  href={`/tuntutan/${claim.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50"
                >
                  <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{claim.refNo}</p>
                    <p className="text-xs text-gray-500">
                      {claim.claimant.name} · {claim.department?.name} · RM {Number(claim.totalClaimedMyr).toFixed(2)}
                    </p>
                  </div>
                  <Badge variant="outline">Menunggu Semakan</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Queue 2: Approved — bulk mark paid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Banknote className="w-4 h-4" />
            Menunggu Pembayaran ({approvedClaims.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <BulkPaidPanel
            claims={approvedClaims.map((c) => ({
              id: c.id,
              refNo: c.refNo,
              claimantName: c.claimant.name,
              departmentName: c.department?.name ?? null,
              totalApprovedMyr: c.totalApprovedMyr ? Number(c.totalApprovedMyr) : null,
              totalClaimedMyr: Number(c.totalClaimedMyr),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
