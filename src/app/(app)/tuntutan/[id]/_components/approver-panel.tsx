"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approverDecide } from "@/server/actions/approval";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, ThumbsDown, Pencil } from "lucide-react";

interface ApproverPanelProps {
  claimId: string;
  refNo: string;
  totalEligibleMyr: number | null;
  currentStatus: string;
  isYdp: boolean;
}

export function ApproverPanel({
  claimId,
  refNo,
  totalEligibleMyr,
  currentStatus,
  isYdp,
}: ApproverPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideAmount, setOverrideAmount] = useState(
    totalEligibleMyr != null ? String(totalEligibleMyr.toFixed(2)) : ""
  );
  const [pendingDecision, setPendingDecision] = useState<string | null>(null);

  const isOverride = currentStatus === "APPROVED" && isYdp;

  function submit(decision: "APPROVED" | "REJECTED" | "OVERRIDDEN") {
    if (decision === "REJECTED" && !comment.trim()) {
      setError("Sila nyatakan sebab penolakan.");
      return;
    }
    if ((decision === "OVERRIDDEN" || overrideMode) && isNaN(parseFloat(overrideAmount))) {
      setError("Amaun override tidak sah.");
      return;
    }
    setError("");
    setPendingDecision(decision);
    const approvedMyr =
      overrideMode || decision === "OVERRIDDEN"
        ? parseFloat(overrideAmount)
        : undefined;

    startTransition(async () => {
      try {
        await approverDecide(claimId, decision, approvedMyr, comment.trim() || undefined);
        router.refresh();
      } catch (e: unknown) {
        setPendingDecision(null);
        setError(e instanceof Error ? e.message : "Kelulusan gagal.");
      }
    });
  }

  return (
    <Card className="border-purple-200 bg-purple-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-purple-800 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          {isOverride ? "Override YDP" : "Kelulusan Akhir"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {totalEligibleMyr != null && (
          <div className="flex items-center justify-between text-sm p-2 bg-white rounded border">
            <span className="text-muted-foreground">Jumlah layak:</span>
            <span className="font-semibold text-primary">RM {totalEligibleMyr.toFixed(2)}</span>
          </div>
        )}

        {(isYdp || overrideMode) && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs text-purple-700">
                {overrideMode ? "Amaun override (RM)" : "Amaun lulus (RM)"}
              </Label>
              {!isOverride && !overrideMode && (
                <button
                  onClick={() => setOverrideMode(true)}
                  className="text-xs text-purple-600 underline flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" />
                  Ubah amaun
                </button>
              )}
            </div>
            {(overrideMode || isOverride) && (
              <Input
                type="number"
                step="0.01"
                min="0"
                value={overrideAmount}
                onChange={(e) => setOverrideAmount(e.target.value)}
                className="bg-white text-sm"
              />
            )}
          </div>
        )}

        {!isYdp && !overrideMode && !isOverride && (
          <button
            onClick={() => setOverrideMode(true)}
            className="text-xs text-purple-600 underline flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" />
            Ubah amaun lulus
          </button>
        )}

        <div>
          <Label className="text-xs text-purple-700 mb-1.5 block">
            Komen {!isOverride ? "(wajib jika tolak)" : "(wajib untuk override)"}
          </Label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Komen atau sebab tindakan..."
            rows={2}
            className="bg-white text-sm"
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          {isOverride ? (
            <Button
              onClick={() => submit("OVERRIDDEN")}
              disabled={isPending}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
            >
              {isPending ? "Memproses..." : "Kemaskini Override"}
            </Button>
          ) : (
            <>
              <Button
                onClick={() => submit("APPROVED")}
                disabled={isPending}
                className="flex-1"
              >
                {isPending && pendingDecision === "APPROVED" ? "Memproses..." : "Lulus"}
              </Button>
              <Button
                onClick={() => submit("REJECTED")}
                disabled={isPending}
                variant="destructive"
                className="flex-1"
              >
                <ThumbsDown className="w-4 h-4 mr-1" />
                {isPending && pendingDecision === "REJECTED" ? "Memproses..." : "Tolak"}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
