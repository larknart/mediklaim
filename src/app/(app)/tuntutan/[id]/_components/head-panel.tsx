"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { headDecide } from "@/server/actions/approval";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, ThumbsUp, ThumbsDown } from "lucide-react";

interface HeadPanelProps {
  claimId: string;
  refNo: string;
}

export function HeadPanel({ claimId, refNo }: HeadPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | null>(null);

  function submit(d: "APPROVED" | "REJECTED") {
    if (d === "REJECTED" && !comment.trim()) {
      setError("Sila nyatakan sebab penolakan.");
      return;
    }
    setDecision(d);
    setError("");
    startTransition(async () => {
      try {
        await headDecide(claimId, d, comment.trim() || undefined);
        router.refresh();
      } catch (e: unknown) {
        setDecision(null);
        setError(e instanceof Error ? e.message : "Tindakan gagal.");
      }
    });
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-blue-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Sokongan Ketua Jabatan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs text-blue-700 mb-1.5 block">
            Komen (wajib jika tolak)
          </Label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Komen atau sebab tindakan..."
            rows={3}
            className="bg-white text-sm"
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          <Button
            onClick={() => submit("APPROVED")}
            disabled={isPending}
            className="flex-1 bg-green-700 hover:bg-green-800"
          >
            <ThumbsUp className="w-4 h-4 mr-2" />
            {isPending && decision === "APPROVED" ? "Memproses..." : "Sokong"}
          </Button>
          <Button
            onClick={() => submit("REJECTED")}
            disabled={isPending}
            variant="destructive"
            className="flex-1"
          >
            <ThumbsDown className="w-4 h-4 mr-2" />
            {isPending && decision === "REJECTED" ? "Memproses..." : "Tolak"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
