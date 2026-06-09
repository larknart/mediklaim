import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import { getPasswordPolicy } from "@/lib/password-policy-server";
import { UserForm } from "../_components/user-form";
import { BackButton } from "@/components/back-button";
import { PageHeader } from "@/components/page-header";

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
      <PageHeader title="Tambah Pengguna" subtitle="Cipta akaun kakitangan baru" />
      <UserForm departments={departments} policy={policy} />
    </div>
  );
}
