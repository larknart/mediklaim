"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { withdrawClaim } from "@/server/actions/claim";
import { Button } from "@/components/ui/button";
import { Undo2 } from "lucide-react";

export function WithdrawButton({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleWithdraw() {
    if (!confirm("Tarik balik tuntutan ini? Resit akan dikembalikan ke inbox.")) return;
    startTransition(async () => {
      await withdrawClaim(claimId);
      router.push("/tuntutan");
    });
  }

  return (
    <Button
      variant="outline"
      onClick={handleWithdraw}
      disabled={isPending}
      className="w-full border-gray-300 text-gray-600"
    >
      <Undo2 className="w-4 h-4 mr-2" />
      {isPending ? "Menarik balik..." : "Tarik Balik Tuntutan"}
    </Button>
  );
}
