"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { financeReview } from "@/server/actions/approval";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BadgeCheck, AlertTriangle, ExternalLink, FileText } from "lucide-react";

interface ReceiptItem {
  id: string;
  description: string;
  qty: number;
  unitMyr: number;
  amountMyr: number;
  isEligible: boolean;
  flaggedReason: string | null;
}

interface Receipt {
  id: string;
  vendor: string | null;
  receiptDate: Date | null;
  totalMyr: number | null;
  fileUrl: string;
  fileMime: string;
  items: ReceiptItem[];
}

interface FinancePanelProps {
  claimId: string;
  receipts: Receipt[];
}

export function FinancePanel({ claimId, receipts }: FinancePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  // Track eligibility state per item
  const [eligibility, setEligibility] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    receipts.forEach((r) => r.items.forEach((i) => { init[i.id] = i.isEligible; }));
    return init;
  });

  const allItems = receipts.flatMap((r) => r.items);
  const eligibleTotal = allItems
    .filter((i) => eligibility[i.id])
    .reduce((s, i) => s + i.amountMyr, 0);

  function toggle(itemId: string) {
    setEligibility((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  function submit() {
    setError("");
    const items = allItems.map((i) => ({
      itemId: i.id,
      isEligible: eligibility[i.id] ?? true,
    }));
    startTransition(async () => {
      try {
        await financeReview(claimId, items, comment.trim() || undefined);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Semakan gagal.");
      }
    });
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-yellow-800 flex items-center gap-2">
          <BadgeCheck className="w-4 h-4" />
          Semakan Kewangan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-yellow-700">
          Tandakan item yang TIDAK layak dituntut. <span className="text-yellow-600">⚠ Blacklist</span> = auto-flagged kata kunci. <span className="text-purple-600">AI</span> = cadangan sistem AI.
        </p>

        {receipts.map((r) => (
          <div key={r.id} className="border rounded-lg bg-white overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{r.vendor ?? "Vendor tidak diketahui"}</p>
                {r.receiptDate && (
                  <p className="text-xs text-gray-500">
                    {new Date(r.receiptDate).toLocaleDateString("ms-MY")}
                  </p>
                )}
              </div>
              <a
                href={`/api/files/${r.fileUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                title="Lihat resit asal"
              >
                {r.fileMime === "application/pdf" ? (
                  <FileText className="w-4 h-4" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5" />
                )}
                Resit Asal
              </a>
            </div>
            {r.fileMime.startsWith("image/") && (
              <a href={`/api/files/${r.fileUrl}`} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/files/${r.fileUrl}`}
                  alt={`Resit ${r.vendor ?? ""}`}
                  className="w-full max-h-48 object-contain bg-gray-100 border-b cursor-zoom-in"
                />
              </a>
            )}
            <div className="divide-y">
              {r.items.map((item) => {
                const isElig = eligibility[item.id] ?? true;
                const isAiFlag = item.flaggedReason?.startsWith("AI:");
                const isFlagged = !!item.flaggedReason;
                return (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${
                      !isElig ? "bg-red-50" : isAiFlag ? "bg-purple-50" : isFlagged ? "bg-yellow-50" : ""
                    }`}
                  >
                    <Checkbox
                      checked={isElig}
                      onCheckedChange={() => toggle(item.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm ${!isElig ? "line-through text-gray-400" : ""}`}>
                          {item.description}
                          {item.qty > 1 && ` × ${item.qty}`}
                        </p>
                        {isFlagged && !isAiFlag && (
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                        )}
                        {isAiFlag && (
                          <span className="text-xs font-medium text-purple-600 shrink-0">AI</span>
                        )}
                      </div>
                      {item.flaggedReason && (
                        <p className={`text-xs ${isAiFlag ? "text-purple-600" : "text-yellow-600"}`}>
                          {isAiFlag ? item.flaggedReason.replace("AI: ", "") : item.flaggedReason}
                        </p>
                      )}
                    </div>
                    <span className={`text-sm font-medium shrink-0 ${!isElig ? "text-gray-400" : ""}`}>
                      RM {item.amountMyr.toFixed(2)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between p-3 bg-white rounded-lg border font-medium text-sm">
          <span>Jumlah layak:</span>
          <span className="text-primary">RM {eligibleTotal.toFixed(2)}</span>
        </div>

        <div>
          <Label className="text-xs text-yellow-700 mb-1.5 block">Nota kewangan (opsyenal)</Label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Nota atau ulasan kewangan..."
            rows={2}
            className="bg-white text-sm"
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={submit}
          disabled={isPending}
          className="w-full bg-yellow-700 hover:bg-yellow-800 text-white"
        >
          {isPending ? "Menghantar..." : "Hantar Semakan ke Pelulus"}
        </Button>
      </CardContent>
    </Card>
  );
}
