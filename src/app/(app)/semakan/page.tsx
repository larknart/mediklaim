import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isFinance } from "@/lib/permissions";
import { ClaimStatus } from "@/generated/prisma";
import { SemukanClient } from "./_components/semakan-client";
import { PageHeader } from "@/components/page-header";

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
      <PageHeader
        title="Semakan Kewangan"
        subtitle={`${reviewClaims.length} menunggu semakan · ${approvedClaims.length} menunggu pembayaran`}
      />
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
