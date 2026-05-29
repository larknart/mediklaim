import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isFinance } from "@/lib/permissions";
import { ClaimStatus } from "@/generated/prisma";
import { SemukanClient } from "./_components/semakan-client";

export default async function SemulaPage() {
  const session = await auth();
  if (!session?.user || !isFinance(session.user)) redirect("/dashboard");

  const [reviewClaims, approvedClaims] = await Promise.all([
    prisma.claim.findMany({
      where: { status: ClaimStatus.HEAD_APPROVED },
      include: { claimant: true, department: true },
      orderBy: { submittedAt: "asc" },
      take: 200,
    }),
    prisma.claim.findMany({
      where: { status: ClaimStatus.APPROVED },
      include: { claimant: true, department: true },
      orderBy: { updatedAt: "asc" },
      take: 200,
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
      <SemukanClient
        reviewClaims={reviewClaims.map((c) => ({
          id: c.id,
          refNo: c.refNo,
          claimantName: c.claimant.name,
          departmentName: c.department?.name ?? null,
          totalApprovedMyr: null,
          totalClaimedMyr: Number(c.totalClaimedMyr),
        }))}
        approvedClaims={approvedClaims.map((c) => ({
          id: c.id,
          refNo: c.refNo,
          claimantName: c.claimant.name,
          departmentName: c.department?.name ?? null,
          totalApprovedMyr: c.totalApprovedMyr ? Number(c.totalApprovedMyr) : null,
          totalClaimedMyr: Number(c.totalClaimedMyr),
        }))}
      />
    </div>
  );
}
