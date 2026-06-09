import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isApprover, isYdp } from "@/lib/permissions";
import { ClaimStatus } from "@/generated/prisma";
import { KelulusanList } from "./_components/kelulusan-list";
import type { ClaimRow } from "./_components/kelulusan-list";
import { PageHeader } from "@/components/page-header";

export default async function KelulusanPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isApprover(session.user) && !isYdp(session.user)) redirect("/dashboard");

  const statuses = isYdp(session.user)
    ? [ClaimStatus.FINANCE_REVIEWED, ClaimStatus.APPROVED]
    : [ClaimStatus.FINANCE_REVIEWED];

  const claims = await prisma.claim.findMany({
    where: { status: { in: statuses } },
    include: { claimant: true, department: true },
    orderBy: { submittedAt: "asc" },
    take: 200,
  });

  const rows: ClaimRow[] = claims.map((c) => ({
    id: c.id,
    refNo: c.refNo,
    claimantName: c.claimant.name,
    departmentName: c.department?.name ?? null,
    totalEligibleMyr: Number(c.totalEligibleMyr ?? c.totalClaimedMyr),
    totalClaimedMyr: Number(c.totalClaimedMyr),
    status: c.status as "FINANCE_REVIEWED" | "APPROVED",
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Kelulusan" subtitle={`${claims.length} tuntutan`} />
      <KelulusanList claims={rows} />
    </div>
  );
}
