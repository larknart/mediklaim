import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "./_components/change-password-form";
import { UpdateProfileForm } from "./_components/update-profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Lock, Phone } from "lucide-react";

export default async function ProfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      staffNo: true,
      phone: true,
      roles: { select: { role: true } },
    },
  });
  if (!user) redirect("/login");

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profil Saya</h1>
        <p className="text-gray-500 text-sm mt-1">Maklumat akaun dan keselamatan</p>
      </div>

      {/* Account info — read-only */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            Maklumat Akaun
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 text-sm">
          <div className="flex justify-between py-2.5 border-b">
            <span className="text-gray-500">Nama</span>
            <span className="font-medium">{user.name}</span>
          </div>
          <div className="flex justify-between py-2.5 border-b">
            <span className="text-gray-500">E-mel</span>
            <span className="font-medium">{user.email}</span>
          </div>
          {user.staffNo && (
            <div className="flex justify-between py-2.5 border-b">
              <span className="text-gray-500">No. Staf</span>
              <span className="font-medium">{user.staffNo}</span>
            </div>
          )}
          <div className="flex justify-between py-2.5">
            <span className="text-gray-500">Peranan</span>
            <span className="font-medium">{user.roles.map((r) => r.role).join(", ") || "—"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Phone — editable */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="w-4 h-4" />
            No. Telefon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UpdateProfileForm phone={user.phone} />
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Tukar Kata Laluan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
