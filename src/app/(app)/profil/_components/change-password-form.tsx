"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/server/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";

export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Kata laluan baru tidak sepadan.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Kata laluan baru terlalu pendek.");
      return;
    }

    startTransition(async () => {
      try {
        await changePassword(currentPassword, newPassword);
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Gagal tukar kata laluan.";
        if (msg === "WRONG_PASSWORD") setError("Kata laluan semasa tidak betul.");
        else setError(msg);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label className="text-xs text-gray-500 mb-1.5 block">Kata Laluan Semasa</Label>
        <div className="relative">
          <Input
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-500 mb-1.5 block">Kata Laluan Baru</Label>
        <div className="relative">
          <Input
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-500 mb-1.5 block">Sahkan Kata Laluan Baru</Label>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded p-3 border border-green-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Kata laluan berjaya ditukar.
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-green-700 hover:bg-green-800"
      >
        {isPending ? "Menyimpan..." : "Tukar Kata Laluan"}
      </Button>
    </form>
  );
}
