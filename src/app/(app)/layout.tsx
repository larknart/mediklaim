import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { SessionProvider } from "next-auth/react";
import { LiveNotifications } from "@/components/live-notifications";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/permissions";
import { Role } from "@/generated/prisma";
import { GlobalSearch } from "@/components/global-search";
import { SessionTimeoutModal } from "@/components/session-timeout-modal";

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

  const [unreadCount, warningSetting] = await Promise.all([
    prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
    prisma.settings.findUnique({ where: { key: "session_warning_min" } }),
  ]);
  const warningMinutes = Number(warningSetting?.value ?? 5);

  return (
    <SessionProvider session={session}>
      <SessionTimeoutModal warningMinutes={warningMinutes} />
      <div className="flex min-h-screen bg-gray-50">
        <LiveNotifications initialUnreadCount={unreadCount} />
        <div className="flex-1 ml-64 flex flex-col min-h-screen">
          <header className="h-14 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40 flex items-center px-6">
            <GlobalSearch />
          </header>
          <main className="flex-1">
            <div className="p-6 max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
