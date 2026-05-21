import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import { UserForm } from "../_components/user-form";

export default async function NewUserPage() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) redirect("/dashboard");

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tambah Pengguna</h1>
        <p className="text-gray-500 text-sm mt-1">Cipta akaun kakitangan baru</p>
      </div>
      <UserForm departments={departments} />
    </div>
  );
}
