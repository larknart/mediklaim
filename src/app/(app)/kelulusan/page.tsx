import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isApprover, isYdp } from "@/lib/permissions";
import { ClaimStatus } from "@/generated/prisma";
import { KelulusanList } from "./_components/kelulusan-list";
import type { ClaimRow } from "./_components/kelulusan-list";

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kelulusan</h1>
        <p className="text-gray-500 text-sm mt-1">{claims.length} tuntutan</p>
      </div>
      <KelulusanList claims={rows} />
    </div>
  );
}
