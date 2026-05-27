"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText, BookOpen, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";

type ExportFormat = "excel" | "pdf/summary" | "pdf/coversheets";

interface ExportButtonProps {
  /** Called at click time to get current selection. Return empty array to abort with toast. */
  getIds: () => string[];
  disabled?: boolean;
}

async function triggerDownload(ids: string[], format: ExportFormat): Promise<void> {
  const res = await fetch(`/api/export/claims/${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Gagal eksport. Cuba lagi.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  if (format === "excel") {
    a.download = `eksport-excel-${date}.xlsx`;
  } else if (format === "pdf/summary") {
    a.download = `eksport-ringkasan-${date}.pdf`;
  } else {
    a.download = `eksport-coversheet-${date}.pdf`;
  }
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButton({ getIds, disabled }: ExportButtonProps) {
  const [loading, setLoading] = useState<ExportFormat | null>(null);

  async function handleExport(format: ExportFormat) {
    const ids = getIds();
    if (ids.length === 0) {
      toast.warning("Pilih sekurang-kurangnya satu tuntutan.");
      return;
    }
    setLoading(format);
    try {
      await triggerDownload(ids, format);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal eksport. Cuba lagi.");
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({ variant: "outline", size: "sm" })}
        disabled={disabled || busy}
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5 mr-1.5" />
        )}
        Eksport
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleExport("excel")}
          disabled={busy}
        >
          {loading === "excel" ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 mr-2" />
          )}
          Excel
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport("pdf/summary")}
          disabled={busy}
        >
          {loading === "pdf/summary" ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-2" />
          )}
          PDF Ringkasan
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport("pdf/coversheets")}
          disabled={busy}
        >
          {loading === "pdf/coversheets" ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <BookOpen className="w-4 h-4 mr-2" />
          )}
          PDF Cover Sheets
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
