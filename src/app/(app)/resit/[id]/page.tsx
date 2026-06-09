import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { ExtractionStatus } from "@/generated/prisma";
import { ReceiptEditForm } from "./_components/receipt-edit-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Clock, FileImage } from "lucide-react";
import { BackButton } from "@/components/back-button";

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const [receipt, thresholdSetting] = await Promise.all([
    prisma.receipt.findUnique({ where: { id }, include: { items: true } }),
    prisma.settings.findUnique({ where: { key: "ai_confidence_threshold" } }),
  ]);
  const confidenceThreshold = typeof thresholdSetting?.value === "number" ? thresholdSetting.value : 0.7;

  if (!receipt || receipt.ownerId !== session.user.id) notFound();

  const statusBadge = {
    [ExtractionStatus.PENDING]: { label: "Sedang proses...", icon: Clock, color: "text-yellow-600" },
    [ExtractionStatus.DONE]:    { label: "Selesai", icon: CheckCircle2, color: "text-success" },
    [ExtractionStatus.FAILED]:  { label: "Gagal — edit manual", icon: AlertTriangle, color: "text-red-600" },
    [ExtractionStatus.SKIPPED]: { label: "Dihantar manual", icon: FileImage, color: "text-gray-500" },
  }[receipt.extractionStatus];

  const Icon = statusBadge.icon;

  return (
    <div className="space-y-4 pb-10">
      <BackButton />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Edit Resit</h1>
          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{receipt.fileUrl.split("/").pop()}</p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-medium ${statusBadge.color}`}>
          <Icon className="w-3.5 h-3.5" />
          {statusBadge.label}
        </span>
      </div>

      {receipt.aiConfidence != null && receipt.aiConfidence < confidenceThreshold && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-xs text-yellow-700">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Keyakinan AI rendah ({Math.round(receipt.aiConfidence * 100)}%). Sila semak dan betulkan maklumat.
        </div>
      )}

      <ReceiptEditForm
        receipt={{
          id: receipt.id,
          vendor: receipt.vendor,
          receiptDate: receipt.receiptDate ? receipt.receiptDate.toISOString().split("T")[0] : null,
          totalMyr: receipt.totalMyr ? Number(receipt.totalMyr) : null,
          extractionStatus: receipt.extractionStatus,
          items: receipt.items.map((i) => ({
            id: i.id,
            description: i.description,
            qty: i.qty,
            unitMyr: Number(i.unitMyr),
            amountMyr: Number(i.amountMyr),
            isEligible: i.isEligible,
            flaggedReason: i.flaggedReason,
          })),
        }}
      />
    </div>
  );
}
