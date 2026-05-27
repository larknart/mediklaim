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
        setModalOpen(false);
      }
    };

    const interval = setInterval(tick, 10_000);
    return () => clearInterval(interval);

    // Re-create interval when session.expires changes (after update()) or warningMinutes changes.
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
