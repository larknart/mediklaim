"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateUser } from "@/server/actions/admin";
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
import Link from "next/link";
import { Pencil, UserX, UserCheck } from "lucide-react";

export function UserActions({ userId, isActive }: { userId: string; isActive: boolean }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    setOpen(false);
    setIsPending(true);
    try {
      await updateUser(userId, { isActive: !isActive });
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button variant="ghost" size="icon" asChild aria-label="Edit pengguna">
        <Link href={`/admin/pengguna/${userId}`}>
          <Pencil className="w-4 h-4" />
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className={isActive ? "text-destructive border-destructive/30 hover:bg-destructive/10" : "text-success border-success/30 hover:bg-success/10"}
      >
        {isActive
          ? <><UserX className="w-3.5 h-3.5 mr-1" />Nyahaktif</>
          : <><UserCheck className="w-3.5 h-3.5 mr-1" />Aktifkan</>}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isActive ? "Nyahaktifkan pengguna?" : "Aktifkan semula pengguna?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? "Pengguna tidak akan dapat log masuk selepas ini."
                : "Pengguna akan dapat log masuk semula."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={isActive ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {isActive ? "Nyahaktifkan" : "Aktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
