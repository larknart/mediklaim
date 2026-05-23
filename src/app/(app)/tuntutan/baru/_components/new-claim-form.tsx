"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClaim } from "@/server/actions/claim";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, AlertCircle, CheckCircle2, Calendar, Building2 } from "lucide-react";
import { ExtractionStatus, ClaimFor } from "@/generated/prisma";

const MONTHS_BM = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember",
];

type Receipt = {
  id: string;
  vendor: string | null;
  receiptDate: Date | null;
  totalMyr: number | null;
  extractionStatus: ExtractionStatus;
  items: Array<{ amountMyr: number }>;
};

type ResubmitContext = {
  claimId: string;
  refNo: string;
  rejectionComment: string | null;
  originalReceiptIds: string[];
};

interface NewClaimFormProps {
  receipts: Receipt[];
  remaining: number;
  limit: number;
  isAhliMajlis: boolean;
  resubmitContext?: ResubmitContext | null;
}

export function NewClaimForm({ receipts, remaining, limit, isAhliMajlis, resubmitContext }: NewClaimFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(resubmitContext?.originalReceiptIds ?? [])
  );
  const [forMonth, setForMonth] = useState(String(new Date().getMonth() + 1));
  const [forYear, setForYear] = useState(String(new Date().getFullYear()));
  const [beneficiaries, setBeneficiaries] = useState<Record<string, { claimFor: ClaimFor; childNo: string }>>({});
  const [error, setError] = useState("");

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear];

  function toggleReceipt(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getBeneficiary(id: string) {
    return beneficiaries[id] ?? { claimFor: ClaimFor.SELF, childNo: "1" };
  }

  function setBeneficiaryFor(id: string, claimFor: ClaimFor, childNo?: string) {
    setBeneficiaries((prev) => ({
      ...prev,
      [id]: { claimFor, childNo: childNo ?? prev[id]?.childNo ?? "1" },
    }));
  }

  const selectedReceipts = receipts.filter((r) => selectedIds.has(r.id));
  const totalSelected = selectedReceipts.reduce((sum, r) => {
    const total = r.totalMyr
      ? r.totalMyr
      : r.items.reduce((s, i) => s + i.amountMyr, 0);
    return sum + total;
  }, 0);

  const exceedsLimit = totalSelected > remaining;

  function handleSubmit() {
    if (selectedIds.size === 0) { setError("Pilih sekurang-kurangnya satu resit."); return; }
    setError("");
    startTransition(async () => {
      try {
        const receiptBeneficiaries: Record<string, { claimFor: ClaimFor; claimForChildNo?: number | null }> = {};
        for (const id of selectedIds) {
          const b = getBeneficiary(id);
          receiptBeneficiaries[id] = {
            claimFor: b.claimFor,
            ...(b.claimFor === ClaimFor.CHILD ? { claimForChildNo: parseInt(b.childNo) } : {}),
          };
        }
        const result = await createClaim({
          forMonth: parseInt(forMonth),
          forYear: parseInt(forYear),
          receiptIds: Array.from(selectedIds),
          receiptBeneficiaries,
          ...(resubmitContext && { resubmittedFromId: resubmitContext.claimId }),
        });
        router.push(`/tuntutan/${result.id}?submitted=1`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Gagal buat tuntutan.";
        if (msg === "CLAIM_PERIOD_CLOSED") {
          setError("Tempoh hantar tuntutan bagi bulan ini telah tamat.");
        } else if (msg.startsWith("RECEIPT_TOO_OLD:")) {
          const vendors = msg.replace("RECEIPT_TOO_OLD:", "");
          setError(`Resit berikut melebihi had umur: ${vendors}. Sila alih keluar resit tersebut.`);
        } else {
          setError(msg);
        }
      }
    });
  }

  return (
    <div className="space-y-4">
      {resubmitContext && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 space-y-1">
          <p className="text-sm font-medium text-amber-800">
            Hantar semula dari {resubmitContext.refNo}
          </p>
          {resubmitContext.rejectionComment && (
            <p className="text-xs text-amber-700">
              Sebab penolakan: &ldquo;{resubmitContext.rejectionComment}&rdquo;
            </p>
          )}
        </div>
      )}
      {/* Period selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bulan Tuntutan</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <div className="flex-1">
            <Label className="text-xs text-gray-500 mb-1.5 block">Bulan</Label>
            <Select value={forMonth} onValueChange={(v) => setForMonth(v ?? forMonth)}>
              <SelectTrigger>
                <span>{MONTHS_BM[parseInt(forMonth) - 1]}</span>
              </SelectTrigger>
              <SelectContent>
                {MONTHS_BM.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Label className="text-xs text-gray-500 mb-1.5 block">Tahun</Label>
            <Select value={forYear} onValueChange={(v) => setForYear(v ?? forYear)}>
              <SelectTrigger>
                <span>{forYear}</span>
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Limit info */}
      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg text-sm">
        <span className="text-gray-600">Baki peruntukan {forYear}:</span>
        <span className={`font-semibold ${remaining < 100 ? "text-red-600" : "text-green-700"}`}>
          RM {remaining.toFixed(2)} / RM {limit.toFixed(2)}
        </span>
      </div>

      {/* Receipt selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pilih Resit ({selectedIds.size} dipilih)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {receipts.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Tiada resit dalam inbox.</p>
              <Button variant="link" onClick={() => router.push("/resit")} className="text-green-700">
                Upload resit dahulu →
              </Button>
            </div>
          ) : (
            receipts.map((r) => {
              const total = r.totalMyr
                ? r.totalMyr
                : r.items.reduce((s, i) => s + i.amountMyr, 0);
              const isSelected = selectedIds.has(r.id);
              const needsReview = r.extractionStatus !== ExtractionStatus.DONE;

              const b = getBeneficiary(r.id);
              return (
                <div
                  key={r.id}
                  className={`rounded-lg border transition-colors ${
                    isSelected ? "border-green-500 bg-green-50" : "border-gray-200"
                  }`}
                >
                  <label className="flex items-center gap-3 p-3 cursor-pointer">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleReceipt(r.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{r.vendor ?? "Vendor tidak diketahui"}</span>
                        {needsReview && (
                          <Badge variant="outline" className="text-xs">Perlu semak</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {r.receiptDate && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(r.receiptDate).toLocaleDateString("ms-MY")}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-green-700">
                          RM {total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </label>
                  {isSelected && !isAhliMajlis && (
                    <div className="px-3 pb-3 flex items-center gap-2">
                      <span className="text-xs text-gray-500 shrink-0">Untuk:</span>
                      <select
                        value={b.claimFor}
                        onChange={(e) => setBeneficiaryFor(r.id, e.target.value as ClaimFor)}
                        className="border rounded px-2 py-1 text-xs"
                      >
                        <option value={ClaimFor.SELF}>Diri Sendiri</option>
                        <option value={ClaimFor.SPOUSE}>Isteri / Suami</option>
                        <option value={ClaimFor.CHILD}>Anak</option>
                      </select>
                      {b.claimFor === ClaimFor.CHILD && (
                        <>
                          <span className="text-xs text-gray-500">ke-</span>
                          <select
                            value={b.childNo}
                            onChange={(e) => setBeneficiaryFor(r.id, ClaimFor.CHILD, e.target.value)}
                            className="border rounded px-2 py-1 text-xs w-16"
                          >
                            {[1,2,3,4,5,6,7,8].map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Summary + submit */}
      {selectedIds.size > 0 && (
        <Card className={exceedsLimit ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Jumlah tuntutan:</span>
              <span className={`text-lg font-bold ${exceedsLimit ? "text-red-700" : "text-green-700"}`}>
                RM {totalSelected.toFixed(2)}
              </span>
            </div>
            {exceedsLimit && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Melebihi baki peruntukan. Hanya RM {remaining.toFixed(2)} akan dipertimbangkan.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handleSubmit}
        disabled={isPending || selectedIds.size === 0}
        className="w-full bg-green-700 hover:bg-green-800"
        size="lg"
      >
        {isPending ? "Menghantar..." : "Hantar Tuntutan"}
      </Button>
    </div>
  );
}
