"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/server/actions/notification";

export function MarkAllReadButton({ unreadCount }: { unreadCount: number }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (unreadCount === 0) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await markAllNotificationsRead();
          router.refresh();
        });
      }}
    >
      {isPending ? "Memproses..." : `Tandakan semua dibaca (${unreadCount})`}
    </Button>
  );
}
