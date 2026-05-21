import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import { Role } from "@/generated/prisma";
import { UserForm } from "../_components/user-form";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) redirect("/dashboard");

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { roles: true },
  });
  if (!user) notFound();

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Pengguna</h1>
        <p className="text-gray-500 text-sm mt-1">{user.email}</p>
      </div>
      <UserForm
        departments={departments}
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          staffNo: user.staffNo,
          phone: user.phone,
          departmentId: user.departmentId,
          isAhliMajlis: user.isAhliMajlis,
          roles: user.roles.map((r) => r.role as Role),
        }}
      />
    </div>
  );
}
