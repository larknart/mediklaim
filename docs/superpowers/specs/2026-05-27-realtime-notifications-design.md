# Real-Time Notifications Design Spec

## Goal

Push live notification updates to authenticated users without page reload: badge count updates in the sidebar and a toast popup appears when a new notification arrives.

## Architecture

Five files touched. One new npm dependency (`sonner`).

| File | Change |
|---|---|
| `src/app/api/notifications/stream/route.ts` | New — SSE endpoint, streams notification events to one client per connection |
| `src/hooks/use-notifications.ts` | New — client hook, subscribes to SSE, manages live unread count, fires toasts |
| `src/components/live-notifications.tsx` | New — client wrapper, renders AppSidebar with live count + Toaster |
| `src/app/(app)/layout.tsx` | Modify — swap static `<AppSidebar>` for `<LiveNotifications>` |
| `package.json` | Add `sonner` (shadcn-standard toast library, ~3KB) |

## SSE Endpoint (`/api/notifications/stream`)

Auth-gated: returns `401` if no session. One persistent HTTP connection per client.

**Response headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

`X-Accel-Buffering: no` is required to prevent Nginx (Coolify's reverse proxy) from buffering the stream.

**On connect:** immediately sends one `init` event with current unread count. No notifications array — no toasts fired for pre-existing unread items.

**Every 10 seconds:** queries DB for:
1. Notifications with `createdAt > lastChecked` and `userId = session.user.id`
2. Total `unreadCount` (readAt: null)

Sends one `update` event. Advances `lastChecked` to `new Date()` after each query.

**On client disconnect:** `req.signal` abort event fires → `clearInterval` → `controller.close()`. No leaks.

**Event shapes** (each sent as `data: <JSON>\n\n`):
```ts
// Sent immediately on connect — no toasts
{ type: "init", unreadCount: number }

// Sent every 10s
{
  type: "update",
  unreadCount: number,
  newNotifs: Array<{
    id: string;
    title: string;
    body: string;
    link: string | null;
  }>
}
```

`newNotifs` is empty array when no new notifications — client still uses `unreadCount` to sync badge.

## Hook (`useNotifications`)

```ts
export function useNotifications(initialUnreadCount: number): { unreadCount: number }
```

- `useState(initialUnreadCount)` — server-rendered value bootstraps badge before SSE connects
- `new EventSource("/api/notifications/stream")` — browser auto-reconnects on error/drop
- `init` event → `setUnreadCount`, skip toasts
- `update` event → `setUnreadCount`, fire `toast()` per item in `newNotifs`
- Cleanup: `es.close()` on unmount

## Toast Appearance

Uses `sonner`. Top-right position, `richColors`.

```ts
toast(n.title, {
  description: n.body,
  icon: <Bell className="w-4 h-4 text-green-700" />,
  action: n.link
    ? { label: "Lihat →", onClick: () => router.push(n.link!) }
    : undefined,
  duration: 5000,
})
```

Stacks automatically if multiple arrive. Auto-dismisses after 5 seconds.

## Client Wrapper (`LiveNotifications`)

```tsx
// "use client"
// Props: { initialUnreadCount: number }
// Renders: <AppSidebar unreadCount={liveCount} /> + <Toaster position="top-right" richColors />
```

Replaces `<AppSidebar>` in layout with a single line change:
```diff
- <AppSidebar unreadCount={unreadCount} />
+ <LiveNotifications initialUnreadCount={unreadCount} />
```

`AppSidebar` is unchanged — still accepts `unreadCount` prop.

## Error Handling

| Scenario | Behaviour |
|---|---|
| Session expired | SSE returns 401 → EventSource errors → auto-reconnects (harmless) |
| DB error in interval | catch + continue, retry on next 10s tick |
| Coolify restart / deploy | EventSource auto-reconnects within seconds |
| Multiple tabs open | Each tab has its own SSE connection + toasts (acceptable at this scale) |
| User visits `/notifikasi` | Server marks all read → next SSE tick sends `unreadCount: 0` → badge clears |

## Testing

Manual verification:
1. Log in, open dashboard — badge shows correct unread count
2. In a second browser session (or admin), trigger a new notification for this user (submit/approve a claim)
3. Within 10 seconds: badge count increments, top-right toast appears with bell icon, title, body, "Lihat →" link
4. Click "Lihat →" — navigates to linked claim
5. Navigate to `/notifikasi` — badge drops to 0 within next 10s tick
6. Kill/restart app server — toast reconnects automatically, badge stays correct
