import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { DeptManager } from "./_components/dept-manager";

export default async function JabatanPage() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) redirect("/dashboard");

  const [departments, users] = await Promise.all([
    prisma.department.findMany({
      include: { members: { select: { id: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const headIds = departments.map((d) => d.headId).filter(Boolean) as string[];
  const heads = headIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: headIds } }, select: { id: true, name: true } })
    : [];
  const headMap = Object.fromEntries(heads.map((h) => [h.id, h.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Jabatan</h1>
        <p className="text-gray-500 text-sm mt-1">{departments.length} jabatan</p>
      </div>
      <DeptManager
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          headId: d.headId,
          headName: d.headId ? headMap[d.headId] ?? null : null,
          memberCount: d.members.length,
        }))}
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
      />
    </div>
  );
}
