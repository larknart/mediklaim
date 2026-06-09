import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import { DelegationList } from "./_components/delegation-list";
import type { DelegationRow, UserOption } from "./_components/delegation-list";
import { BackButton } from "@/components/back-button";
import { PageHeader } from "@/components/page-header";

export default async function DelegasiPage() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) redirect("/dashboard");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [delegations, users] = await Promise.all([
    prisma.approvalDelegation.findMany({
      include: {
        delegator: { select: { name: true } },
        delegate: { select: { name: true } },
      },
      orderBy: { fromDate: "desc" },
    }),
    prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true, roles: { select: { role: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows: DelegationRow[] = delegations.map((d) => ({
    id: d.id,
    delegatorName: d.delegator.name,
    delegateName: d.delegate.name,
    role: d.role,
    fromDate: d.fromDate.toISOString().split("T")[0],
    toDate: d.toDate.toISOString().split("T")[0],
    isActive: d.fromDate <= today && d.toDate >= today,
  }));

  const userOptions: UserOption[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    roles: u.roles.map((r) => r.role),
  }));

  return (
    <div className="max-w-lg space-y-6">
      <BackButton />
      <PageHeader title="Delegasi Kelulusan" subtitle="Urus pelantikan penjawab semasa cuti" />
      <DelegationList delegations={rows} users={userOptions} />
    </div>
  );
}
