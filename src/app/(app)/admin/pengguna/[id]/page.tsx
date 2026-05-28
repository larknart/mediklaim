import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import { Role } from "@/generated/prisma";
import { getPasswordPolicy } from "@/lib/password-policy-server";
import { UserForm } from "../_components/user-form";
import { BackButton } from "@/components/back-button";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) redirect("/dashboard");

  const { id } = await params;
  const [user, departments, policy] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    getPasswordPolicy(),
  ]);
  if (!user) notFound();

  return (
    <div className="max-w-lg space-y-6">
      <BackButton />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Pengguna</h1>
        <p className="text-gray-500 text-sm mt-1">{user.email}</p>
      </div>
      <UserForm
        departments={departments}
        policy={policy}
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          staffNo: user.staffNo,
          phone: user.phone,
          departmentId: user.departmentId,
          isAhliMajlis: user.isAhliMajlis,
          joinDate: user.joinDate ? user.joinDate.toISOString().split("T")[0] : null,
          roles: user.roles.map((r) => r.role as Role),
        }}
      />
    </div>
  );
}
