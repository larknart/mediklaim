import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { SessionProvider } from "next-auth/react";
import { AppSidebar } from "@/components/app-sidebar";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/permissions";
import { Role } from "@/generated/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const maintenanceSetting = await prisma.settings.findUnique({ where: { key: "maintenance_mode" } });
  if (maintenanceSetting?.value === true && !isAdmin(session.user)) {
    redirect("/maintenance");
  }

  // 2FA enforcement for ADMIN users
  if (session.user.roles.includes(Role.ADMIN)) {
    const [require2faSetting, userRecord, hdrs] = await Promise.all([
      prisma.settings.findUnique({ where: { key: "require_2fa_admin" } }),
      prisma.user.findUnique({ where: { id: session.user.id }, select: { totpEnabled: true } }),
      headers(),
    ]);
    // Falls back to "" if x-pathname is absent — empty string won't match /profil,
    // so the gate stays active (fail-secure default).
    const pathname = hdrs.get("x-pathname") ?? "";
    if (
      require2faSetting?.value === true &&
      userRecord &&
      !userRecord.totpEnabled &&
      pathname !== "/profil" && !pathname.startsWith("/profil/")
    ) {
      redirect("/profil");
    }
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, readAt: null },
  });

  return (
    <SessionProvider session={session}>
      <div className="flex min-h-screen bg-gray-50">
        <AppSidebar unreadCount={unreadCount} />
        <main className="flex-1 ml-64 min-h-screen">
          <div className="p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </SessionProvider>
  );
}
