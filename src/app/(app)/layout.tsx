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
import { SidebarProvider } from "@/components/sidebar-context";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { SidebarBackdrop } from "@/components/sidebar-backdrop";

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

  // Password expiry gate (all roles)
  const hdrsForExpiry = await headers();
  const pathnameForExpiry = hdrsForExpiry.get("x-pathname") ?? "";
  if (!pathnameForExpiry.startsWith("/profil")) {
    const [expirySetting, userPw] = await Promise.all([
      prisma.settings.findUnique({ where: { key: "password_expiry_days" } }),
      prisma.user.findUnique({ where: { id: session.user.id }, select: { passwordChangedAt: true } }),
    ]);
    const expiryDays = typeof expirySetting?.value === "number" ? expirySetting.value : 0;
    if (expiryDays > 0 && userPw?.passwordChangedAt) {
      const ageDays = (Date.now() - userPw.passwordChangedAt.getTime()) / 86_400_000;
      if (ageDays > expiryDays) redirect("/profil?expired=1");
    }
  }

  const [unreadCount, warningSetting] = await Promise.all([
    prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
    prisma.settings.findUnique({ where: { key: "session_warning_min" } }),
  ]);
  const warningMinutes = Number(warningSetting?.value ?? 5);

  return (
    <SessionProvider session={session}>
      <SidebarProvider>
        <SessionTimeoutModal warningMinutes={warningMinutes} />
        <div className="flex min-h-screen bg-muted/50">
          <LiveNotifications initialUnreadCount={unreadCount} />
          <SidebarBackdrop />
          <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
            <header className="h-14 bg-white border-b border-border shadow-sm fixed top-0 left-0 right-0 md:left-64 z-40 flex items-center px-4">
              <SidebarToggle />
              <GlobalSearch />
            </header>
            <main className="flex-1 pt-14">
              <div className="p-6 max-w-7xl mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </SessionProvider>
  );
}
