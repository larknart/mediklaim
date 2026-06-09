import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma";
import { getPasswordPolicy } from "@/lib/password-policy-server";
import { ChangePasswordForm } from "./_components/change-password-form";
import { UpdateProfileForm } from "./_components/update-profile-form";
import { TotpSection } from "./_components/totp-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Lock, Phone, ShieldCheck, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export default async function ProfilPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const isExpired = sp.expired === "1";

  const [user, require2faSetting, policy] = await Promise.all([
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
    getPasswordPolicy(),
  ]);
  if (!user) redirect("/login");

  const isAdminUser = session.user.roles.includes(Role.ADMIN);
  const require2fa = isAdminUser && require2faSetting?.value === true && !user.totpEnabled;

  return (
    <div className="space-y-6 max-w-lg">
      <PageHeader title="Profil Saya" subtitle="Maklumat akaun dan keselamatan" />

      {isExpired && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Kata laluan anda telah tamat tempoh. Sila tukar kata laluan sebelum meneruskan.
          </AlertDescription>
        </Alert>
      )}

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
          <ChangePasswordForm policy={policy} />
        </CardContent>
      </Card>
    </div>
  );
}
