"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { withdrawClaim } from "@/server/actions/claim";
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
} from "@/components/ui/alert-dialog";
import { Undo2 } from "lucide-react";

export function WithdrawButton({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    setOpen(false);
    setIsPending(true);
    try {
      await withdrawClaim(claimId);
      router.push("/tuntutan");
    } catch {
      setIsPending(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="w-full border-border text-muted-foreground"
      >
        <Undo2 className="w-4 h-4 mr-2" />
        {isPending ? "Menarik balik..." : "Tarik Balik Tuntutan"}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tarik balik tuntutan?</AlertDialogTitle>
            <AlertDialogDescription>
              Resit akan dikembalikan ke inbox. Tindakan ini tidak boleh dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              Tarik Balik
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
