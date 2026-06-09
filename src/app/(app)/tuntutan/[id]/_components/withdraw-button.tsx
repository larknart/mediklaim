"use client";

import { useState, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    setOpen(false);
    startTransition(async () => {
      await withdrawClaim(claimId);
      router.push("/tuntutan");
    });
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
              className="bg-red-600 hover:bg-red-700"
            >
              Tarik Balik
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
