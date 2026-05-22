"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { initiateResubmit } from "@/server/actions/claim";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RotateCcw } from "lucide-react";

export function ResubmitButton({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleConfirm() {
    setError("");
    startTransition(async () => {
      try {
        const result = await initiateResubmit(claimId);
        router.push(`/tuntutan/baru?resubmitFrom=${result.originalClaimId}`);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal memulakan resubmit.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="w-full" disabled={isPending}>
            <RotateCcw className="w-4 h-4 mr-2" />
            {isPending ? "Memproses..." : "Hantar Semula"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hantar Semula Tuntutan?</AlertDialogTitle>
            <AlertDialogDescription>
              Resit dalam tuntutan ini akan dikembalikan ke inbox anda. Tuntutan baru akan dibuat dengan nombor rujukan baharu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-green-700 hover:bg-green-800"
            >
              Ya, Hantar Semula
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
    </div>
  );
}
