# Real-Time Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push live notification updates to users via SSE — badge count updates in the sidebar and a toast popup appears when new notifications arrive, without page reload.

**Architecture:** A Next.js SSE route streams notification events to each authenticated client. A client hook subscribes via `EventSource`, updates badge count state, and fires sonner toasts. A thin `LiveNotifications` wrapper replaces the static `AppSidebar` mount in the app layout.

**Tech Stack:** Next.js 16 App Router, TypeScript, `sonner` (toast), `@react-pdf/renderer` not involved, Prisma 7, Auth.js v5 JWT.

---

### Task 1: Install sonner

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install sonner**

Run from project root:
```bash
npm install sonner
```
Expected: `sonner` added to `dependencies` in `package.json`.

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add sonner toast library"
```

---

### Task 2: Create SSE endpoint

**Files:**
- Create: `src/app/api/notifications/stream/route.ts`

- [ ] **Step 1: Create the directory and file**

Create `src/app/api/notifications/stream/route.ts` with this full content:

```ts
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
          lastChecked = new Date();

          const [newNotifs, unreadCount] = await Promise.all([
            prisma.notification.findMany({
              where: { userId, createdAt: { gt: since } },
              orderBy: { createdAt: "asc" },
              select: { id: true, title: true, body: true, link: true },
            }),
            prisma.notification.count({ where: { userId, readAt: null } }),
          ]);

          // Always send update so client badge stays in sync even when 0
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
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: exit 0. If you see `stream as unknown as BodyInit` type errors, this cast is intentional — Next.js 16 `NextResponse` body typing differs from the `ReadableStream` generic. Keep the cast.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/notifications/stream/route.ts
git commit -m "feat: SSE endpoint for real-time notification stream"
```

---

### Task 3: Create useNotifications hook

**Files:**
- Create: `src/hooks/use-notifications.ts`

This hook already exists: `src/hooks/use-session-timeout.ts` — follow the same pattern (`"use client"`, imports at top, single exported function).

- [ ] **Step 1: Create the file**

Create `src/hooks/use-notifications.ts` with this full content:

```ts
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import React from "react";

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
              icon: React.createElement(Bell, { className: "w-4 h-4 text-green-700" }),
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
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-notifications.ts
git commit -m "feat: useNotifications hook — SSE subscribe, badge count, toasts"
```

---

### Task 4: Create LiveNotifications component

**Files:**
- Create: `src/components/live-notifications.tsx`

- [ ] **Step 1: Create the file**

Create `src/components/live-notifications.tsx` with this full content:

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/live-notifications.tsx
git commit -m "feat: LiveNotifications — live badge count + sonner Toaster"
```

---

### Task 5: Wire LiveNotifications into app layout

**Files:**
- Modify: `src/app/(app)/layout.tsx`

The current layout is at `src/app/(app)/layout.tsx`. Read it before editing.

- [ ] **Step 1: Add the import**

Find the existing imports block at the top of `src/app/(app)/layout.tsx`. It currently includes:
```tsx
import { AppSidebar } from "@/components/app-sidebar";
```

Add this import on the line after it:
```tsx
import { LiveNotifications } from "@/components/live-notifications";
```

- [ ] **Step 2: Swap AppSidebar for LiveNotifications in the JSX**

Find this line inside the `return` statement:
```tsx
      <AppSidebar unreadCount={unreadCount} />
```

Replace it with:
```tsx
      <LiveNotifications initialUnreadCount={unreadCount} />
```

The `AppSidebar` import is now unused — remove it:
```tsx
// Remove this line:
import { AppSidebar } from "@/components/app-sidebar";
```

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 4: Manual smoke test**

Start the dev server:
```bash
npm run dev
```

Open the app in a browser, log in. Verify:
1. Sidebar badge shows correct unread count (same as before the change)
2. No console errors about SSE or EventSource
3. Navigate to a page — badge still shows, no flash/reset

To test a live toast: in a second browser tab (or using another user account), trigger a new notification for the logged-in user (e.g. submit a new claim or approve one). Within 10 seconds, a toast should appear top-right with bell icon, title, and body.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/layout.tsx
git commit -m "feat: wire LiveNotifications into app layout — live badge + toasts"
```
