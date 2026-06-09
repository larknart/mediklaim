"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNotificationRead } from "@/server/actions/notification";
import { formatDistanceToNow } from "@/lib/format";

interface NotifItem {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export function NotifikasiList({ notifications }: { notifications: NotifItem[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const handleLinkClick = (id: string, rawLink: string) => {
    const href = rawLink.startsWith("http") ? new URL(rawLink).pathname : rawLink;
    startTransition(async () => {
      await markNotificationRead(id);
      router.push(href);
    });
  };

  return (
    <div className="divide-y">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`p-4 flex gap-3 ${!n.readAt ? "bg-blue-50" : ""}`}
        >
          <div
            className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
              !n.readAt ? "bg-blue-500" : "bg-transparent"
            }`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{n.title}</p>
            <p className="text-sm text-gray-600 mt-0.5">{n.body}</p>
            <p className="text-xs text-gray-400 mt-1">
              {formatDistanceToNow(new Date(n.createdAt))}
            </p>
            {n.link && (
              <button
                type="button"
                onClick={() => handleLinkClick(n.id, n.link!)}
                className="text-xs text-primary hover:underline mt-1 inline-block"
              >
                Lihat tuntutan →
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
