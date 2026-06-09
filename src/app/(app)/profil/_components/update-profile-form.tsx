"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/server/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";

interface UpdateProfileFormProps {
  phone: string | null;
}

export function UpdateProfileForm({ phone: initialPhone }: UpdateProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [phone, setPhone] = useState(initialPhone ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(false);
    startTransition(async () => {
      try {
        await updateProfile({ phone });
        setSuccess(true);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal kemaskini profil.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">No. Telefon</Label>
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="cth: 019-1234567"
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Digunakan untuk notifikasi WhatsApp. Kosongkan untuk nyahaktifkan WA.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <div className="flex items-center gap-2 text-sm text-primary bg-success/5 rounded p-3 border border-primary/20">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Profil berjaya dikemaskini.
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className=""
      >
        {isPending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  );
}
