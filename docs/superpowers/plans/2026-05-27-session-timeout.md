# Session Timeout Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Warn authenticated users before their JWT session expires, auto-extend if active, show countdown modal if idle, and wire the existing `session_timeout_min` admin setting into Next-Auth's `maxAge`.

**Architecture:** `useSessionTimeout` hook tracks `session.expires`, detects idle via `mousemove`/`keydown` listeners, ticks every 10s — silent `update()` when active, warning modal when idle. `SessionTimeoutModal` client component mounts in the app layout, receives `warningMinutes` from a new `session_warning_min` DB setting. JWT `maxAge` wired from `SESSION_TIMEOUT_MIN` env var in `auth.ts`.

**Tech Stack:** Next.js 16 App Router, Auth.js v5 JWT (`useSession`, `update`, `signOut` from `next-auth/react`), React hooks, shadcn/ui Dialog, Tailwind CSS, Prisma settings table.

---

## Critical Patterns (read before writing code)

- **`useSession()` returns `{ data: session, status, update }`** — `update()` with no args re-issues the JWT (calls `POST /api/auth/session`, triggers `jwt` callback, updates `session.expires`). No extra API route needed.
- **`session.expires` is an ISO date string** — always `new Date(session.expires).getTime()` before arithmetic.
- **No test runner** — testing is manual via browser DevTools console and UI interaction.
- **`src/hooks/` does not exist** — the plan creates it.
- **Layout is a server component** — mount the client modal component inside `SessionProvider` which is already in the layout return.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/auth.ts` | Modify | Add `maxAge` from `SESSION_TIMEOUT_MIN` env var |
| `src/hooks/use-session-timeout.ts` | Create | Timer, idle detection, auto-refresh logic |
| `src/components/session-timeout-modal.tsx` | Create | Countdown dialog UI, extend/logout actions |
| `src/app/(app)/admin/tetapan/_components/security-settings.tsx` | Modify | Add `session_warning_min` prop + field |
| `src/app/(app)/admin/tetapan/page.tsx` | Modify | Pass `sessionWarningMin` prop to `SecuritySettings` |
| `src/app/(app)/layout.tsx` | Modify | Query `session_warning_min`, mount `<SessionTimeoutModal>` |

---

## Task 1: JWT maxAge Wiring

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Add `maxAge` to the session config**

Open `src/lib/auth.ts`. Find the line:
```typescript
  session: { strategy: "jwt" },
```

Replace it with:
```typescript
  session: {
    strategy: "jwt",
    // SESSION_TIMEOUT_MIN is set in Coolify env vars and managed via Admin → Keselamatan.
    // Falls back to 30 minutes if unset.
    maxAge: Number(process.env.SESSION_TIMEOUT_MIN ?? "30") * 60,  // seconds
  },
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: wire SESSION_TIMEOUT_MIN env var into JWT maxAge"
```

---

## Task 2: `useSessionTimeout` Hook

**Files:**
- Create: `src/hooks/use-session-timeout.ts`

- [ ] **Step 1: Create `src/hooks/use-session-timeout.ts`**

```typescript
"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Tracks JWT session expiry. When the session is within `warningMinutes` of
 * expiry:
 *   - If the user is active (last input < 5 min ago): silently calls update()
 *     to refresh the JWT.
 *   - If the user is idle: opens the warning modal.
 *
 * Fires a tick every 10 seconds. Cleans up on unmount.
 */
export function useSessionTimeout(warningMinutes: number) {
  const { data: session, status, update } = useSession();
  const [modalOpen, setModalOpen]     = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Ref updated on every user interaction — no re-render needed
  const lastActivityAt = useRef(Date.now());

  // ── Register activity listeners (once) ───────────────────────────────────
  useEffect(() => {
    const onActivity = () => { lastActivityAt.current = Date.now(); };
    const events = ["mousemove", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onActivity));
  }, []);

  // ── Tick every 10 seconds ────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "authenticated" || !session?.expires) return;

    const tick = async () => {
      const expiresAt  = new Date(session.expires).getTime();
      const now        = Date.now();
      const sLeft      = Math.floor((expiresAt - now) / 1000);

      if (sLeft <= 0) {
        // Session has expired — force logout
        signOut({ callbackUrl: "/login" });
        return;
      }

      if (sLeft <= warningMinutes * 60) {
        const idleSecs = (now - lastActivityAt.current) / 1000;

        if (idleSecs < 300) {
          // Active (< 5 min idle) — silently refresh JWT
          await update();
          setModalOpen(false);
        } else {
          // Idle — show warning modal
          setSecondsLeft(sLeft);
          setModalOpen(true);
        }
      } else {
        // Outside warning window — ensure modal is closed
        // (handles case where user extended and is back to normal)
        setModalOpen(false);
      }
    };

    const interval = setInterval(tick, 10_000);
    return () => clearInterval(interval);

    // Re-create interval when session.expires changes (after update()) or
    // when warningMinutes changes.
  }, [status, session?.expires, warningMinutes, update]);

  const handleExtend = useCallback(async () => {
    await update();
    setModalOpen(false);
  }, [update]);

  const handleLogout = useCallback(() => {
    signOut({ callbackUrl: "/login" });
  }, []);

  return { modalOpen, secondsLeft, handleExtend, handleLogout };
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start dev server (`npm run dev`). Log in. In browser DevTools console:

```javascript
// Verify session.expires exists and is a future date
// (from React DevTools or next-auth debug)
fetch('/api/auth/session').then(r=>r.json()).then(s=>console.log('expires:', s.expires, 'now:', new Date().toISOString()))
```

Expected: `expires` is a date in the future (now + SESSION_TIMEOUT_MIN minutes, default 30 min).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-session-timeout.ts
git commit -m "feat: useSessionTimeout hook — idle detection, auto-refresh, countdown"
```

---

## Task 3: SessionTimeoutModal Component

**Files:**
- Create: `src/components/session-timeout-modal.tsx`

- [ ] **Step 1: Create `src/components/session-timeout-modal.tsx`**

```typescript
"use client";

import { useSessionTimeout } from "@/hooks/use-session-timeout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0 saat";
  if (seconds < 60) return `${seconds} saat`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m} minit ${s} saat` : `${m} minit`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SessionTimeoutModalProps {
  warningMinutes: number;
}

export function SessionTimeoutModal({ warningMinutes }: SessionTimeoutModalProps) {
  const { modalOpen, secondsLeft, handleExtend, handleLogout } =
    useSessionTimeout(warningMinutes);

  return (
    <Dialog open={modalOpen} onOpenChange={() => { /* non-dismissible */ }}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            Sesi Anda Hampir Tamat
          </DialogTitle>
          <DialogDescription>
            Sesi anda akan tamat dalam{" "}
            <span className="font-semibold text-gray-900">
              {formatCountdown(secondsLeft)}
            </span>
            . Teruskan untuk kekal log masuk.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button variant="outline" onClick={handleLogout}>
            Log Keluar
          </Button>
          <Button
            onClick={handleExtend}
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            Teruskan Sesi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/session-timeout-modal.tsx
git commit -m "feat: SessionTimeoutModal — countdown dialog with extend/logout"
```

---

## Task 4: Admin Settings — Add `session_warning_min`

**Files:**
- Modify: `src/app/(app)/admin/tetapan/_components/security-settings.tsx`
- Modify: `src/app/(app)/admin/tetapan/page.tsx`

- [ ] **Step 1: Add `sessionWarningMin` prop to `SecuritySettingsProps` interface**

In `security-settings.tsx`, find the interface:
```typescript
interface SecuritySettingsProps {
  loginMaxAttempts: number;
  loginLockDurationMin: number;
  sessionTimeoutMin: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSymbol: boolean;
  maxUploadSizeMb: number;
  require2faAdmin: boolean;
}
```

Replace with:
```typescript
interface SecuritySettingsProps {
  loginMaxAttempts: number;
  loginLockDurationMin: number;
  sessionTimeoutMin: number;
  sessionWarningMin: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSymbol: boolean;
  maxUploadSizeMb: number;
  require2faAdmin: boolean;
}
```

- [ ] **Step 2: Add state for `sessionWarningMin`**

Find the line:
```typescript
  const [sessionTimeout, setSessionTimeout] = useState(String(props.sessionTimeoutMin));
```

Add the new state immediately after it:
```typescript
  const [sessionTimeout, setSessionTimeout] = useState(String(props.sessionTimeoutMin));
  const [sessionWarning, setSessionWarning] = useState(String(props.sessionWarningMin));
```

- [ ] **Step 3: Add validation in `save()`**

Find in `save()`:
```typescript
    if (isNaN(timeout) || timeout < 15 || timeout > 480) {
      setError("Tamat tempoh sesi: antara 15–480 minit."); return;
    }
```

Add the new parse + validation immediately after it:
```typescript
    if (isNaN(timeout) || timeout < 15 || timeout > 480) {
      setError("Tamat tempoh sesi: antara 15–480 minit."); return;
    }
    const warning = parseInt(sessionWarning, 10);
    if (isNaN(warning) || warning < 2 || warning > 30) {
      setError("Amaran sesi: antara 2–30 minit."); return;
    }
```

- [ ] **Step 4: Add `updateSetting` call for `session_warning_min`**

Find in the `startTransition` block:
```typescript
        await updateSetting("session_timeout_min", timeout);
```

Add the new call immediately after it:
```typescript
        await updateSetting("session_timeout_min", timeout);
        await updateSetting("session_warning_min", warning);
```

- [ ] **Step 5: Add the input field in JSX**

Find the session timeout input block:
```typescript
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Tamat tempoh sesi (minit)</Label>
            <Input type="number" min="15" max="480" value={sessionTimeout} onChange={(e) => setSessionTimeout(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">
              Memerlukan kemas kini env var <code className="bg-gray-100 px-1 rounded">SESSION_TIMEOUT_MIN</code> dan restart app di Coolify.
            </p>
          </div>
```

Replace with:
```typescript
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Tamat tempoh sesi (minit)</Label>
              <Input type="number" min="15" max="480" value={sessionTimeout} onChange={(e) => setSessionTimeout(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">
                Memerlukan kemas kini env var <code className="bg-gray-100 px-1 rounded">SESSION_TIMEOUT_MIN</code> dan restart app di Coolify.
              </p>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Amaran tamat tempoh sesi (minit)</Label>
              <Input type="number" min="2" max="30" value={sessionWarning} onChange={(e) => setSessionWarning(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">
                Tunjuk amaran X minit sebelum sesi tamat.
              </p>
            </div>
          </div>
```

- [ ] **Step 6: Pass `sessionWarningMin` prop in `tetapan/page.tsx`**

In `src/app/(app)/admin/tetapan/page.tsx`, find:
```typescript
          <SecuritySettings
            loginMaxAttempts={Number(s["login_max_attempts"] ?? 5)}
            loginLockDurationMin={Number(s["login_lock_duration_min"] ?? 15)}
            sessionTimeoutMin={Number(s["session_timeout_min"] ?? 30)}
            passwordMinLength={Number(s["password_min_length"] ?? 10)}
            passwordRequireUppercase={s["password_require_uppercase"] !== false}
            passwordRequireNumber={s["password_require_number"] !== false}
            passwordRequireSymbol={Boolean(s["password_require_symbol"] ?? false)}
            maxUploadSizeMb={Number(s["max_upload_size_mb"] ?? 10)}
            require2faAdmin={s["require_2fa_admin"] === true}
          />
```

Replace with:
```typescript
          <SecuritySettings
            loginMaxAttempts={Number(s["login_max_attempts"] ?? 5)}
            loginLockDurationMin={Number(s["login_lock_duration_min"] ?? 15)}
            sessionTimeoutMin={Number(s["session_timeout_min"] ?? 30)}
            sessionWarningMin={Number(s["session_warning_min"] ?? 5)}
            passwordMinLength={Number(s["password_min_length"] ?? 10)}
            passwordRequireUppercase={s["password_require_uppercase"] !== false}
            passwordRequireNumber={s["password_require_number"] !== false}
            passwordRequireSymbol={Boolean(s["password_require_symbol"] ?? false)}
            maxUploadSizeMb={Number(s["max_upload_size_mb"] ?? 10)}
            require2faAdmin={s["require_2fa_admin"] === true}
          />
```

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Manual test — admin settings**

With dev server running, log in as ADMIN, go to `/admin/tetapan` → tab **Keselamatan**. Verify:
1. New "Amaran tamat tempoh sesi (minit)" input appears next to "Tamat tempoh sesi"
2. Change value to `2`, click Simpan → "Tetapan disimpan." appears
3. Refresh page → value still shows `2`

- [ ] **Step 9: Commit**

```bash
git add src/app/(app)/admin/tetapan/_components/security-settings.tsx \
        src/app/(app)/admin/tetapan/page.tsx
git commit -m "feat: admin settings — add session_warning_min field"
```

---

## Task 5: Layout Wiring

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Add import for `SessionTimeoutModal`**

In `src/app/(app)/layout.tsx`, find the import block ending with:
```typescript
import { GlobalSearch } from "@/components/global-search";
```

Add immediately after it:
```typescript
import { SessionTimeoutModal } from "@/components/session-timeout-modal";
```

- [ ] **Step 2: Query `session_warning_min` from DB**

Find the line:
```typescript
  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, readAt: null },
  });
```

Replace with:
```typescript
  const [unreadCount, warningSetting] = await Promise.all([
    prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
    prisma.settings.findUnique({ where: { key: "session_warning_min" } }),
  ]);
  const warningMinutes = Number(warningSetting?.value ?? 5);
```

- [ ] **Step 3: Mount `<SessionTimeoutModal>` inside `SessionProvider`**

Find in the return statement:
```typescript
    <SessionProvider session={session}>
      <div className="flex min-h-screen bg-gray-50">
```

Replace with:
```typescript
    <SessionProvider session={session}>
      <SessionTimeoutModal warningMinutes={warningMinutes} />
      <div className="flex min-h-screen bg-gray-50">
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Full manual test**

With dev server running, log in. To test the modal quickly without waiting 30 minutes, temporarily set `warningMinutes` to `1000` (hard-code in layout) and force idle by not moving mouse for 5 minutes — OR use browser DevTools to simulate:

```javascript
// In browser console — check the session expiry
fetch('/api/auth/session').then(r=>r.json()).then(s=>{
  console.log('Session expires:', s.expires);
  console.log('Minutes left:', Math.floor((new Date(s.expires) - Date.now()) / 60000));
})
```

To force-trigger the modal for testing: in `use-session-timeout.ts` temporarily change the idle threshold from `300` to `1` (1 second), reload page, wait 10 seconds without moving mouse → modal appears.

Verify:
1. Modal appears with correct countdown
2. Modal is non-dismissible (click outside / ESC do nothing)
3. **Teruskan Sesi** closes modal, session continues
4. **Log Keluar** redirects to `/login`
5. Restore idle threshold to `300` after testing

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/layout.tsx
git commit -m "feat: session timeout warning — mount modal in app layout"
```

---

## Self-Review Checklist

After all tasks complete:

- [ ] `auth.ts` reads `SESSION_TIMEOUT_MIN` env var for `maxAge`
- [ ] `useSessionTimeout` registers activity listeners, ticks every 10s, calls `update()` when active, sets `modalOpen` when idle
- [ ] `SessionTimeoutModal` is non-dismissible, shows countdown, has extend + logout buttons
- [ ] Admin settings page shows `session_warning_min` field (min 2, max 30, default 5)
- [ ] Layout queries `session_warning_min` and passes to modal
- [ ] `npx tsc --noEmit` passes with zero errors
