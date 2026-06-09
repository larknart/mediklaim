"use client";

import { useState, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    setOpen(false);
    startTransition(async () => {
      await updateUser(userId, { isActive: !isActive });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button variant="ghost" size="icon" asChild aria-label="Edit pengguna">
        <Link href={`/admin/pengguna/${userId}`}>
          <Pencil className="w-4 h-4" />
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        disabled={isPending}
        aria-label={isActive ? "Nyahaktifkan pengguna" : "Aktifkan semula pengguna"}
      >
        {isActive
          ? <UserX className="w-4 h-4 text-red-500" />
          : <UserCheck className="w-4 h-4 text-success" />}
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
              className={isActive ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {isActive ? "Nyahaktifkan" : "Aktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
