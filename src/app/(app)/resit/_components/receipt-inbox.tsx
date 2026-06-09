"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { uploadReceipt, deleteReceipt, retryExtraction } from "@/server/actions/receipt";
import { ExtractionStatus, ReceiptStatus } from "@/generated/prisma";
import {
  Upload,
  FileImage,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  ChevronRight,
  Calendar,
  DollarSign,
  Building2,
} from "lucide-react";
import Link from "next/link";

type Receipt = {
  id: string;
  fileUrl: string;
  fileMime: string;
  receiptDate: Date | null;
  vendor: string | null;
  totalMyr: number | null;
  status: ReceiptStatus;
  extractionStatus: ExtractionStatus;
  aiConfidence: number | null;
  createdAt: Date;
  items: Array<{ id: string; description: string; amountMyr: number; isEligible: boolean }>;
};

const EXTRACTION_BADGE: Record<ExtractionStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING:  { label: "Menunggu AI", variant: "secondary" },
  DONE:     { label: "Diekstrak",   variant: "default" },
  FAILED:   { label: "Gagal OCR",   variant: "destructive" },
  SKIPPED:  { label: "Manual",      variant: "outline" },
};

export function ReceiptInbox({ receipts: initialReceipts }: { receipts: Receipt[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Poll while any receipt is still being processed by AI
  const hasPending = initialReceipts.some((r) => r.extractionStatus === ExtractionStatus.PENDING);
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [hasPending, router]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError("");
    setUploading(true);

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        await uploadReceipt(fd);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "DUPLICATE_RECEIPT") {
          setUploadError(`Resit "${file.name}" sudah pernah diupload.`);
        } else if (msg === "FILE_TOO_LARGE") {
          setUploadError(`Fail "${file.name}" melebihi 10MB.`);
        } else {
          setUploadError(`Gagal upload "${file.name}".`);
        }
      }
    }

    setUploading(false);
    router.refresh();
  }, [router]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startTransition(async () => {
      await deleteReceipt(id);
      router.refresh();
      toast.success("Resit berjaya dipadam.");
    });
  }

  function handleRetry(id: string) {
    startTransition(async () => {
      await retryExtraction(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragOver ? "border-primary bg-success/5" : "border-border hover:border-primary/70"
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <Loader2 className="w-10 h-10 text-success animate-spin" />
          ) : (
            <Upload className="w-10 h-10 text-gray-300 hidden sm:block" />
          )}
          <div className="hidden sm:block">
            <p className="font-medium text-muted-foreground">
              {uploading ? "Sedang upload..." : "Drag & drop resit di sini"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">JPG, PNG, WebP, PDF · Max 10MB</p>
          </div>
          {uploading && (
            <p className="font-medium text-muted-foreground sm:hidden">Sedang upload...</p>
          )}
          <div className="flex gap-2 flex-wrap justify-center">
            {/* Camera first on mobile */}
            <label className="cursor-pointer order-first sm:order-last">
              <Button variant="outline" className="border-primary/30 text-primary hover:bg-success/5" asChild>
                <span>
                  <Camera className="w-4 h-4 mr-2" />
                  Snap Kamera
                </span>
              </Button>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
                disabled={uploading}
              />
            </label>
            <label className="cursor-pointer">
              <Button variant="outline" asChild>
                <span>
                  <FileImage className="w-4 h-4 mr-2" />
                  Pilih Fail
                </span>
              </Button>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {uploadError}
        </div>
      )}

      {/* Receipt grid */}
      {initialReceipts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileImage className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Tiada resit dalam inbox.</p>
            <p className="text-sm mt-1">Upload resit anda untuk mula membuat tuntutan.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialReceipts.map((r) => {
            const status = EXTRACTION_BADGE[r.extractionStatus];
            const lowConfidence = r.aiConfidence !== null && r.aiConfidence < 0.6;

            return (
              <Card key={r.id} className="group hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  {/* Thumbnail */}
                  <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden relative">
                    {r.fileMime === "application/pdf" ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileImage className="w-12 h-12 text-gray-300" />
                        <span className="absolute bottom-2 right-2 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded">PDF</span>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/files/${r.fileUrl}`}
                        alt="Resit"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-1.5">
                    {r.extractionStatus === ExtractionStatus.DONE ? (
                      <>
                        {r.vendor && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate font-medium">{r.vendor}</span>
                          </div>
                        )}
                        {r.receiptDate && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                            {new Date(r.receiptDate).toLocaleDateString("ms-MY")}
                          </div>
                        )}
                        {r.totalMyr && (
                          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                            <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
                            RM {r.totalMyr.toFixed(2)}
                          </div>
                        )}
                        {lowConfidence && (
                          <p className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Sila semak ketepatan data di atas
                          </p>
                        )}
                      </>
                    ) : r.extractionStatus === ExtractionStatus.PENDING ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        AI sedang membaca resit...
                      </div>
                    ) : r.extractionStatus === ExtractionStatus.FAILED ? (
                      <p className="text-sm text-red-600">OCR gagal. Isi maklumat secara manual.</p>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={`/resit/${r.id}`}>
                        <ChevronRight className="w-3.5 h-3.5 mr-1" />
                        {r.extractionStatus === ExtractionStatus.DONE ? "Semak" : "Isi Data"}
                      </Link>
                    </Button>
                    {r.extractionStatus === ExtractionStatus.FAILED && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetry(r.id)}
                        disabled={isPending}
                        aria-label="Cuba semula ekstrak"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteId(r.id)}
                      disabled={isPending}
                      aria-label="Padam resit"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Padam resit ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Resit akan dibuang dari inbox dan tidak boleh dipulihkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Padam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
