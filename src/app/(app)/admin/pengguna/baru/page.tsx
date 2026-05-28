import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import { getPasswordPolicy } from "@/lib/password-policy";
import { UserForm } from "../_components/user-form";
import { BackButton } from "@/components/back-button";

export default async function NewUserPage() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) redirect("/dashboard");

  const [departments, policy] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    getPasswordPolicy(),
  ]);

  return (
    <div className="max-w-lg space-y-6">
      <BackButton />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tambah Pengguna</h1>
        <p className="text-gray-500 text-sm mt-1">Cipta akaun kakitangan baru</p>
      </div>
      <UserForm departments={departments} policy={policy} />
    </div>
  );
}
