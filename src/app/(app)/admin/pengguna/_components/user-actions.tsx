"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUser } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Pencil, UserX, UserCheck } from "lucide-react";

export function UserActions({ userId, isActive }: { userId: string; isActive: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggleActive() {
    if (!confirm(isActive ? "Nyahaktifkan pengguna ini?" : "Aktifkan semula pengguna ini?")) return;
    startTransition(async () => {
      await updateUser(userId, { isActive: !isActive });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button variant="ghost" size="icon" asChild>
        <Link href={`/admin/pengguna/${userId}`}>
          <Pencil className="w-4 h-4" />
        </Link>
      </Button>
      <Button variant="ghost" size="icon" onClick={toggleActive} disabled={isPending}>
        {isActive ? <UserX className="w-4 h-4 text-red-500" /> : <UserCheck className="w-4 h-4 text-green-600" />}
      </Button>
    </div>
  );
}
