"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPaid } from "@/server/actions/approval";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Banknote } from "lucide-react";

interface MarkPaidButtonProps {
  claimId: string;
  refNo: string;
  totalApprovedMyr: number | null;
}

export function MarkPaidButton({ claimId, refNo, totalApprovedMyr }: MarkPaidButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [voucherNo, setVoucherNo] = useState("");

  function confirm() {
    setError("");
    startTransition(async () => {
      try {
        await markPaid(claimId, voucherNo.trim() || undefined);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal tandakan dibayar.");
      }
    });
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-emerald-800 flex items-center gap-2">
          <Banknote className="w-4 h-4" />
          Rekod Pembayaran
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-emerald-700">
          Tuntutan ini telah diluluskan. Tandakan sebagai dibayar setelah bayaran diproses.
        </p>
        {totalApprovedMyr != null && (
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border text-sm font-medium">
            <span>Jumlah diluluskan:</span>
            <span className="text-emerald-700">RM {totalApprovedMyr.toFixed(2)}</span>
          </div>
        )}
        <div>
          <Label className="text-xs text-emerald-700 mb-1.5 block">No. Baucer Pembayaran (opsyenal)</Label>
          <Input
            value={voucherNo}
            onChange={(e) => setVoucherNo(e.target.value)}
            placeholder="cth: BV-2026-001234"
            className="bg-white text-sm"
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              disabled={isPending}
              className="w-full"
            >
              <Banknote className="w-4 h-4 mr-2" />
              {isPending ? "Memproses..." : "Tandakan Dibayar"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sahkan Pembayaran</AlertDialogTitle>
              <AlertDialogDescription>
                Tandakan tuntutan <strong>{refNo}</strong> sebagai dibayar?
                {voucherNo.trim() && <> No. Baucer: <strong>{voucherNo.trim()}</strong>.</>}
                {" "}Tindakan ini tidak boleh dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirm}
                className=""
              >
                Ya, Tandakan Dibayar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
