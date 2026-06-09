"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { initiateResubmit } from "@/server/actions/claim";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RotateCcw } from "lucide-react";

export function ResubmitButton({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  function handleConfirm() {
    setError("");
    startTransition(async () => {
      try {
        const result = await initiateResubmit(claimId);
        const ids = result.receiptIds.join(",");
        router.push(
          `/tuntutan/baru?resubmitFrom=${result.originalClaimId}${ids ? `&receiptIds=${ids}` : ""}`
        );
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal memulakan resubmit.");
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        className="w-full"
        disabled={isPending}
        onClick={() => setOpen(true)}
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        {isPending ? "Memproses..." : "Hantar Semula"}
      </Button>
      <AlertDialog open={open} onOpenChange={(v) => !isPending && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hantar Semula Tuntutan?</AlertDialogTitle>
            <AlertDialogDescription>
              Resit dalam tuntutan ini akan dikembalikan ke inbox anda. Tuntutan baru akan dibuat dengan nombor rujukan baharu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
            <Button
              onClick={handleConfirm}
              disabled={isPending}
              className=""
            >
              {isPending ? "Memproses..." : "Ya, Hantar Semula"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
