import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { AppSidebar } from "@/components/app-sidebar";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const maintenanceSetting = await prisma.settings.findUnique({ where: { key: "maintenance_mode" } });
  if (maintenanceSetting?.value === true && !isAdmin(session.user)) {
    redirect("/maintenance");
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
