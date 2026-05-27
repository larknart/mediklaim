import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const userId = session.user.id;
  // Track the last time we checked for new notifications.
  // Initialised to now so we only send notifications created AFTER connection.
  let lastChecked = new Date();

  const stream = new ReadableStream({
    start(controller) {
      const encode = (data: object) => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Send initial unread count immediately on connect.
      // type "init" — client does NOT show toasts for this event.
      prisma.notification
        .count({ where: { userId, readAt: null } })
        .then((count) => encode({ type: "init", unreadCount: count }))
        .catch(() => {
          // DB error on init — client will still receive updates on next tick
        });

      const interval = setInterval(async () => {
        try {
          const since = lastChecked;

          const [newNotifs, unreadCount] = await Promise.all([
            prisma.notification.findMany({
              where: { userId, createdAt: { gt: since } },
              orderBy: { createdAt: "asc" },
              select: { id: true, title: true, body: true, link: true },
            }),
            prisma.notification.count({ where: { userId, readAt: null } }),
          ]);

          // Always send update so client badge stays in sync even when 0
          lastChecked = new Date();
          encode({ type: "update", unreadCount, newNotifs });
        } catch {
          // DB error — skip this tick, retry in 10s
        }
      }, 10_000);

      // Clean up when client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Required: prevents Nginx (Coolify reverse proxy) from buffering the stream
      "X-Accel-Buffering": "no",
    },
  });
}
