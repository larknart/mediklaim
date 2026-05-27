"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell } from "lucide-react";

// Matches the shape sent by /api/notifications/stream
interface StreamEvent {
  type: "init" | "update";
  unreadCount: number;
  newNotifs?: Array<{
    id: string;
    title: string;
    body: string;
    link: string | null;
  }>;
}

/**
 * Subscribes to /api/notifications/stream via EventSource.
 * - On "init": updates badge count, no toast (pre-existing unread items)
 * - On "update": updates badge count, fires toast per new notification
 * EventSource auto-reconnects on error/disconnect.
 */
export function useNotifications(initialUnreadCount: number) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const router = useRouter();

  useEffect(() => {
    const es = new EventSource("/api/notifications/stream");

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const data: StreamEvent = JSON.parse(event.data);
        setUnreadCount(data.unreadCount);

        if (data.type === "update" && data.newNotifs && data.newNotifs.length > 0) {
          data.newNotifs.forEach((n) => {
            toast(n.title, {
              description: n.body,
              icon: <Bell className="w-4 h-4 text-green-700" />,
              action: n.link
                ? { label: "Lihat →", onClick: () => router.push(n.link!) }
                : undefined,
              duration: 5000,
            });
          });
        }
      } catch {
        // Malformed SSE data — ignore
      }
    };

    return () => es.close();
  }, [router]);

  return { unreadCount };
}
