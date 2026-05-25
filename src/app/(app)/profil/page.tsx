import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma";
import { ChangePasswordForm } from "./_components/change-password-form";
import { UpdateProfileForm } from "./_components/update-profile-form";
import { TotpSection } from "./_components/totp-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Lock, Phone, ShieldCheck } from "lucide-react";

export default async function ProfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [user, require2faSetting] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        staffNo: true,
        phone: true,
        roles: { select: { role: true } },
        totpEnabled: true,
      },
    }),
    prisma.settings.findUnique({ where: { key: "require_2fa_admin" } }),
  ]);
  if (!user) redirect("/login");

  const isAdminUser = session.user.roles.includes(Role.ADMIN);
  const require2fa = isAdminUser && require2faSetting?.value === true && !user.totpEnabled;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profil Saya</h1>
        <p className="text-gray-500 text-sm mt-1">Maklumat akaun dan keselamatan</p>
      </div>

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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Pengesahan 2 Faktor (2FA)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TotpSection totpEnabled={user.totpEnabled} required={require2fa} />
        </CardContent>
      </Card>

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
