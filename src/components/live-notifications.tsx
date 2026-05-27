"use client";

import { Toaster } from "sonner";
import { AppSidebar } from "@/components/app-sidebar";
import { useNotifications } from "@/hooks/use-notifications";

interface LiveNotificationsProps {
  initialUnreadCount: number;
}

/**
 * Client wrapper that:
 * 1. Calls useNotifications to get live unread count via SSE
 * 2. Passes live count down to AppSidebar (replaces static server-rendered count)
 * 3. Mounts the sonner Toaster (required once at app root level)
 */
export function LiveNotifications({ initialUnreadCount }: LiveNotificationsProps) {
  const { unreadCount } = useNotifications(initialUnreadCount);

  return (
    <>
      <AppSidebar unreadCount={unreadCount} />
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
