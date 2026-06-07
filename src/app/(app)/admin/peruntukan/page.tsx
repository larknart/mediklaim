import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import { getDefaultAnnualLimit } from "@/lib/allocation";
import { AllocationTable } from "./_components/allocation-table";

export default async function PeruntukanPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) redirect("/dashboard");

  const sp = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = parseInt(sp.year ?? String(currentYear));

  const [users, allocations, defaultLimit] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      include: { department: true },
      orderBy: { name: "asc" },
    }),
    prisma.annualAllocation.findMany({
      where: { year },
    }),
    getDefaultAnnualLimit(),
  ]);

  const allocMap = Object.fromEntries(allocations.map((a) => [a.userId, a]));

  const rows = users.map((u) => {
    const alloc = allocMap[u.id];
    return {
      userId: u.id,
      name: u.name,
      staffNo: u.staffNo ?? null,
      deptName: u.department?.name ?? null,
      limitMyr: alloc ? Number(alloc.limitMyr) : defaultLimit,
      usedMyr: alloc ? Number(alloc.usedMyr) : 0,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengurusan Peruntukan</h1>
        <p className="text-gray-500 text-sm mt-1">
          Kemaskini had dan jumlah telah guna bagi setiap staf. Berguna untuk rollout
          pertengahan tahun atau pelarasan manual.
        </p>
      </div>

      <AllocationTable
        rows={rows}
        year={year}
        currentYear={currentYear}
        defaultLimit={defaultLimit}
      />
    </div>
  );
}
