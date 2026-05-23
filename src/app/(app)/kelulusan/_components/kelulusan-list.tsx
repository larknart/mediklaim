"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { bulkApprove } from "@/server/actions/approval";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Shield, CheckSquare, Square } from "lucide-react";

export interface ClaimRow {
  id: string;
  refNo: string;
  claimantName: string;
  departmentName: string | null;
  totalEligibleMyr: number;
  totalClaimedMyr: number;
  status: "FINANCE_REVIEWED" | "APPROVED";
}

export function KelulusanList({ claims }: { claims: ClaimRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [result, setResult] = useState<{ approved: number; failed: string[] } | null>(null);

  const approvable = claims.filter((c) => c.status === "FINANCE_REVIEWED");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === approvable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(approvable.map((c) => c.id)));
    }
  }

  function handleBulkConfirm() {
    startTransition(async () => {
      const res = await bulkApprove(Array.from(selected));
      setResult(res);
      setSelected(new Set());
      router.refresh();
    });
  }

  if (claims.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-400">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Tiada tuntutan menunggu kelulusan.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      {approvable.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-1">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {selected.size === approvable.length && approvable.length > 0
              ? <CheckSquare className="w-4 h-4" />
              : <Square className="w-4 h-4" />}
            {selected.size === approvable.length && approvable.length > 0
              ? "Batal semua"
              : `Pilih semua (${approvable.length})`}
          </button>
          {selected.size > 0 && (
            <Button
              size="sm"
              className="bg-green-700 hover:bg-green-800"
              onClick={() => setDialogOpen(true)}
              disabled={isPending}
            >
              Lulus {selected.size} Tuntutan
            </Button>
          )}
        </div>
      )}

      {/* Result banner */}
      {result && (
        <div className={`text-sm px-3 py-2 rounded-lg ${result.failed.length > 0 ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800"}`}>
          {result.approved} tuntutan diluluskan.
          {result.failed.length > 0 && ` ${result.failed.length} gagal (mungkin status berubah).`}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {claims.map((claim) => {
              const isApprovable = claim.status === "FINANCE_REVIEWED";
              const isChecked = selected.has(claim.id);
              return (
                <div key={claim.id} className={`flex items-center gap-3 p-4 ${isChecked ? "bg-green-50" : "hover:bg-gray-50"}`}>
                  {/* Checkbox */}
                  <button
                    className="shrink-0 text-gray-400 hover:text-green-700 disabled:opacity-30"
                    onClick={() => isApprovable && toggle(claim.id)}
                    disabled={!isApprovable || isPending}
                    aria-label={isChecked ? "Nyahpilih" : "Pilih"}
                  >
                    {isChecked
                      ? <CheckSquare className="w-5 h-5 text-green-700" />
                      : <Square className="w-5 h-5" />}
                  </button>

                  {/* Icon */}
                  <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-green-700" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{claim.refNo}</p>
                    <p className="text-xs text-gray-500">{claim.claimantName} · {claim.departmentName ?? "—"}</p>
                    <p className="text-xs font-medium text-green-700 mt-0.5">
                      Layak: RM {claim.totalEligibleMyr.toFixed(2)}
                    </p>
                  </div>

                  {/* Status + link */}
                  <div className="shrink-0 flex items-center gap-2">
                    <Badge variant={claim.status === "APPROVED" ? "default" : "outline"}>
                      {claim.status === "APPROVED" ? "Diluluskan" : "Menunggu"}
                    </Badge>
                    <Link
                      href={`/tuntutan/${claim.id}`}
                      className="text-xs text-green-700 hover:underline"
                    >
                      Buka →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Confirm dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={(v) => !isPending && setDialogOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lulus {selected.size} Tuntutan?</AlertDialogTitle>
            <AlertDialogDescription>
              Tuntutan yang dipilih akan diluluskan pada amaun layak masing-masing. Tindakan ini tidak boleh dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
            <Button
              onClick={handleBulkConfirm}
              disabled={isPending}
              className="bg-green-700 hover:bg-green-800"
            >
              {isPending ? "Memproses..." : "Ya, Lulus Semua"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
