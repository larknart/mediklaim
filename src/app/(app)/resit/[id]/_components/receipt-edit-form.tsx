"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateReceipt, retryExtraction, deleteReceipt } from "@/server/actions/receipt";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/alert-dialog";
import { ExtractionStatus } from "@/generated/prisma";
import { Plus, Trash2, RefreshCw, Save } from "lucide-react";

interface Item {
  id?: string;
  description: string;
  qty: number;
  unitMyr: number;
  amountMyr: number;
  isEligible: boolean;
  flaggedReason: string | null;
}

interface ReceiptEditFormProps {
  receipt: {
    id: string;
    vendor: string | null;
    receiptDate: string | null;
    totalMyr: number | null;
    extractionStatus: ExtractionStatus;
    items: Item[];
  };
}

export function ReceiptEditForm({ receipt }: ReceiptEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [vendor, setVendor] = useState(receipt.vendor ?? "");
  const [receiptDate, setReceiptDate] = useState(receipt.receiptDate ?? "");
  const [items, setItems] = useState<Item[]>(receipt.items.length > 0 ? receipt.items : [
    { description: "", qty: 1, unitMyr: 0, amountMyr: 0, isEligible: true, flaggedReason: null },
  ]);

  const computedTotal = items.reduce((s, i) => s + i.amountMyr, 0);
  const eligibleTotal = items.filter((i) => i.isEligible).reduce((s, i) => s + i.amountMyr, 0);
  const hasIneligible = eligibleTotal < computedTotal;

  function updateItem(idx: number, field: keyof Item, value: unknown) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === "qty" || field === "unitMyr") {
        const qty = field === "qty" ? Number(value) : next[idx].qty;
        const unit = field === "unitMyr" ? Number(value) : next[idx].unitMyr;
        next[idx].amountMyr = parseFloat((qty * unit).toFixed(2));
      }
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { description: "", qty: 1, unitMyr: 0, amountMyr: 0, isEligible: true, flaggedReason: null },
    ]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function save() {
    if (!vendor.trim()) { setError("Nama vendor diperlukan."); return; }
    if (items.length === 0) { setError("Tambah sekurang-kurangnya satu item."); return; }
    setError("");
    startTransition(async () => {
      try {
        await updateReceipt(receipt.id, {
          vendor: vendor.trim(),
          receiptDate: receiptDate || undefined,
          totalMyr: computedTotal,
          items: items.map((i) => ({
            id: i.id,
            description: i.description,
            qty: i.qty,
            unitMyr: i.unitMyr,
            amountMyr: i.amountMyr,
            isEligible: i.isEligible,
          })),
        });
        router.push("/resit");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal simpan.");
      }
    });
  }

  // Poll while AI is processing (after retry or on initial PENDING)
  useEffect(() => {
    if (receipt.extractionStatus !== ExtractionStatus.PENDING) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [receipt.extractionStatus, router]);

  function retry() {
    startTransition(async () => {
      await retryExtraction(receipt.id);
      router.refresh();
    });
  }

  const [showDelete, setShowDelete] = useState(false);

  function handleDelete() {
    setShowDelete(false);
    startTransition(async () => {
      await deleteReceipt(receipt.id);
      router.push("/resit");
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Maklumat Resit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Nama Vendor / Klinik</Label>
            <Input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Klinik Kesihatan / Farmasi..."
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Tarikh Resit</Label>
            <Input
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Item ({items.length})</CardTitle>
            <div className="text-right">
              <p className="text-sm font-semibold text-green-700">
                Jumlah resit: RM {computedTotal.toFixed(2)}
              </p>
              {hasIneligible && (
                <p className="text-xs text-amber-600">
                  Anggaran layak: RM {eligibleTotal.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className={`border rounded-lg p-3 space-y-2 ${!item.isEligible ? "bg-red-50 border-red-200" : item.flaggedReason ? "bg-yellow-50 border-yellow-200" : ""}`}>
              <div className="flex items-center gap-2">
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(idx, "description", e.target.value)}
                  placeholder="Nama ubat / rawatan"
                  className="flex-1 text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(idx)}
                  className="shrink-0 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Qty</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e) => updateItem(idx, "qty", parseInt(e.target.value) || 1)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Unit (RM)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitMyr}
                    onChange={(e) => updateItem(idx, "unitMyr", parseFloat(e.target.value) || 0)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Amaun (RM)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.amountMyr}
                    onChange={(e) => updateItem(idx, "amountMyr", parseFloat(e.target.value) || 0)}
                    className="text-sm"
                  />
                </div>
              </div>
              {item.flaggedReason && (
                <p className="text-xs text-yellow-600">⚠ {item.flaggedReason}</p>
              )}
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={item.isEligible}
                  onCheckedChange={(v) => updateItem(idx, "isEligible", !!v)}
                />
                Layak dituntut
              </label>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={addItem}
            className="w-full border-dashed"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Item
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        onClick={save}
        disabled={isPending}
        className="w-full bg-green-700 hover:bg-green-800"
        size="lg"
      >
        <Save className="w-4 h-4 mr-2" />
        {isPending ? "Menyimpan..." : "Simpan Perubahan"}
      </Button>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={retry}
          disabled={isPending || receipt.extractionStatus === ExtractionStatus.PENDING}
          className="flex-1"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${receipt.extractionStatus === ExtractionStatus.PENDING ? "animate-spin" : ""}`} />
          {receipt.extractionStatus === ExtractionStatus.PENDING ? "AI sedang proses..." : "Cuba Semula AI"}
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowDelete(true)}
          disabled={isPending}
          className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Padam Resit
        </Button>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Padam resit ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Resit akan dibuang dari inbox dan tidak boleh dipulihkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Padam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
