import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MarkAllReadButton } from "./_components/mark-read-button";
import { NotifikasiList } from "./_components/notifikasi-list";

export default async function NotifikasiPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Notifikasi"
        actions={<MarkAllReadButton unreadCount={unreadCount} />}
      />

      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Tiada notifikasi.</p>
            </div>
          ) : (
            <NotifikasiList notifications={notifications} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
