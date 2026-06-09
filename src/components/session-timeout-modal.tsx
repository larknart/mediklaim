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

  // onOpenChange is a no-op — controlled open state makes this non-dismissible
  return (
    <Dialog open={modalOpen} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
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
            className="text-white"
          >
            Teruskan Sesi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
