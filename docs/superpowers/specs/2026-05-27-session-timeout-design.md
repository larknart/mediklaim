# Session Timeout Warning — Design Spec

**Date:** 2026-05-27
**Feature:** Client-side session timeout warning with idle detection and auto-refresh

---

## Goal

Warn authenticated users before their JWT session expires. Automatically extend the session if the user is active; show a countdown modal if idle. Redirect to `/login` on expiry. Wire the existing `session_timeout_min` admin setting into Next-Auth's `maxAge` so the JWT actually expires at the configured time.

---

## Architecture

Four components, each with a single responsibility:

| Component | File | Responsibility |
|-----------|------|----------------|
| JWT maxAge wiring | `src/lib/auth.ts` | Read `SESSION_TIMEOUT_MIN` env var → `maxAge` |
| Timeout hook | `src/hooks/use-session-timeout.ts` | Timer, idle detection, auto-refresh logic |
| Warning modal | `src/components/session-timeout-modal.tsx` | Countdown UI, extend/logout actions |
| Admin setting | `src/app/(app)/admin/tetapan/_components/security-settings.tsx` | Add `session_warning_min` field |
| Layout wiring | `src/app/(app)/layout.tsx` | Query `session_warning_min`, mount modal |

---

## Section 1: JWT maxAge Wiring

`src/lib/auth.ts` — add `maxAge` to the session config:

```typescript
session: {
  strategy: "jwt",
  maxAge: Number(process.env.SESSION_TIMEOUT_MIN ?? "30") * 60,  // seconds
}
```

`SESSION_TIMEOUT_MIN` is already referenced in the admin UI hint text. When an admin changes `session_timeout_min`:
1. Setting saved to DB (existing behaviour)
2. Admin updates `SESSION_TIMEOUT_MIN` env var in Coolify
3. App restarts — new `maxAge` takes effect for all new JWTs

Existing JWTs issued before the change retain their original expiry. No migration needed.

---

## Section 2: `useSessionTimeout` Hook

**File:** `src/hooks/use-session-timeout.ts`

**Props:** `warningMinutes: number`

**Returns:** `{ modalOpen, secondsLeft, handleExtend, handleLogout }`

### Logic

```
mount effect (once):
  register mousemove, keydown, touchstart, scroll on window
  → each event: lastActivityAt.current = Date.now()
  cleanup: remove listeners on unmount + clear interval

tick effect (every 10 seconds):
  if session.status !== "authenticated": return

  secondsLeft = (new Date(session.expires) - Date.now()) / 1000

  if secondsLeft ≤ 0:
    signOut({ callbackUrl: "/login" })
    return

  if secondsLeft ≤ warningMinutes × 60:
    idleSeconds = (Date.now() - lastActivityAt.current) / 1000
    if idleSeconds < 300:        // active — last input < 5 min ago
      update()                   // silent JWT refresh via next-auth
      setModalOpen(false)
    else:                        // idle
      setModalOpen(true)
      setSecondsLeft(Math.floor(secondsLeft))

  else:
    setModalOpen(false)          // outside warning window
```

### handleExtend
```
update() → setModalOpen(false)
```

### handleLogout
```
signOut({ callbackUrl: "/login" })
```

### Notes
- `session.expires` from `useSession()` is always in sync with the actual JWT `exp` — no separate expiry tracking needed.
- Tick interval cleared and re-created when `session.status` changes to avoid stale closures.
- Tab visibility: timer runs regardless of tab focus. Logout fires even in background tab — correct behaviour for security.
- Multiple tabs: each tab runs its own hook independently. `update()` in one tab does not sync others (v1 acceptable).

---

## Section 3: `SessionTimeoutModal` Component

**File:** `src/components/session-timeout-modal.tsx`

**Props:** `warningMinutes: number`

Client component (`"use client"`). Internally calls `useSessionTimeout(warningMinutes)`.

### UI

shadcn `Dialog` with `onInteractOutside` and `onEscapeKeyDown` both prevented (non-dismissible — user must choose an action).

```
┌─────────────────────────────────────┐
│  ⚠️  Sesi Anda Hampir Tamat         │
│                                     │
│  Sesi anda akan tamat dalam         │
│  4 minit 32 saat.                   │
│                                     │
│  Teruskan untuk kekal log masuk.    │
│                                     │
│  [Teruskan Sesi]  [Log Keluar]      │
└─────────────────────────────────────┘
```

- Countdown format: `X minit Y saat` (if ≥ 60s) or `Y saat` (if < 60s)
- **Teruskan Sesi** — calls `handleExtend()`, closes modal
- **Log Keluar** — calls `handleLogout()`
- If `secondsLeft ≤ 0` while modal open → `handleLogout()` fires automatically

---

## Section 4: Admin Settings Addition

**File:** `src/app/(app)/admin/tetapan/_components/security-settings.tsx`

Add one field alongside `session_timeout_min`:

```
Label: "Amaran tamat tempoh sesi (minit)"
Key:   session_warning_min
Type:  number, min: 2, max: 30, default: 5
```

Saved via existing `updateSetting("session_warning_min", value)` call in the same submit handler.

DB seed: `session_warning_min` will be created with value `5` on first save. No migration needed — `findUnique` returns `null` for missing keys, layout falls back to `5`.

---

## Section 5: Layout Wiring

**File:** `src/app/(app)/layout.tsx`

Server component reads `session_warning_min` from DB:

```typescript
const warningSetting = await prisma.settings.findUnique({
  where: { key: "session_warning_min" }
});
const warningMinutes = Number(warningSetting?.value ?? 5);
```

Mount modal inside `SessionProvider`:

```typescript
<SessionProvider session={session}>
  <SessionTimeoutModal warningMinutes={warningMinutes} />
  {/* existing layout ... */}
</SessionProvider>
```

`SessionTimeoutModal` is a client component — it uses `useSession()` which requires `SessionProvider` in tree.

---

## File Map

| File | Action |
|------|--------|
| `src/lib/auth.ts` | Modify — add `maxAge` from env var |
| `src/hooks/use-session-timeout.ts` | Create — timer + idle + refresh hook |
| `src/components/session-timeout-modal.tsx` | Create — warning dialog |
| `src/app/(app)/admin/tetapan/_components/security-settings.tsx` | Modify — add `session_warning_min` field |
| `src/app/(app)/layout.tsx` | Modify — query setting, mount modal |

---

## Out of Scope (v1)

- Cross-tab session sync (each tab independent)
- "Remember me" extended session
- Activity-based server-side session extension
- Push notification when session expires in background
