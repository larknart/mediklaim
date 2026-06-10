"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPaidBulk } from "@/server/actions/approval";
import { ExportButton } from "@/components/export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Banknote, Calculator, FileText } from "lucide-react";
import NextLink from "next/link";

export interface SemukanClaimItem {
  id: string;
  refNo: string;
  claimantName: string;
  departmentName: string | null;
  totalApprovedMyr: number | null;
  totalClaimedMyr: number;
}

interface SemukanClientProps {
  reviewClaims: SemukanClaimItem[];
  approvedClaims: SemukanClaimItem[];
}

export function SemukanClient({ reviewClaims, approvedClaims }: SemukanClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [voucherNo, setVoucherNo] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const allClaims = [...reviewClaims, ...approvedClaims];

  function toggleAll() {
    if (selected.size === allClaims.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allClaims.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Only APPROVED claims in selection can be marked paid
  const selectedApproved = approvedClaims.filter((c) => selected.has(c.id));
  const totalSelected = allClaims
    .filter((c) => selected.has(c.id))
    .reduce((s, c) => s + (c.totalApprovedMyr ?? c.totalClaimedMyr), 0);

  function confirmPaid() {
    setError("");
    setSuccess("");
    startTransition(async () => {
      try {
        const result = await markPaidBulk(
          selectedApproved.map((c) => c.id),
          voucherNo.trim() || undefined
        );
        setSuccess(`${result.count} tuntutan berjaya ditandakan dibayar.`);
        setSelected(new Set());
        setVoucherNo("");
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal proses pembayaran.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Select-all row */}
      {allClaims.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <Checkbox
            checked={selected.size === allClaims.length && allClaims.length > 0}
            onCheckedChange={toggleAll}
          />
          Pilih Semua ({allClaims.length})
        </label>
      )}

      {/* Queue 1: Needs finance review */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Menunggu Semakan ({reviewClaims.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {reviewClaims.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Tiada tuntutan menunggu semakan.</div>
          ) : (
            <div className="divide-y">
              {reviewClaims.map((claim) => (
                <div key={claim.id} className="flex items-center gap-3 p-4 hover:bg-accent">
                  <Checkbox
                    checked={selected.has(claim.id)}
                    onCheckedChange={() => toggleOne(claim.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <NextLink
                      href={`/tuntutan/${claim.id}`}
                      className="font-medium text-sm hover:underline text-primary"
                    >
                      {claim.refNo}
                    </NextLink>
                    <p className="text-xs text-muted-foreground">
                      {claim.claimantName} · {claim.departmentName ?? "—"} · RM {claim.totalClaimedMyr.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Queue 2: Ready for payment */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Banknote className="w-4 h-4" />
            Menunggu Pembayaran ({approvedClaims.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {approvedClaims.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Tiada tuntutan menunggu pembayaran.</div>
          ) : (
            <div className="divide-y">
              {approvedClaims.map((claim) => (
                <div key={claim.id} className="flex items-center gap-3 p-4 hover:bg-accent">
                  <Checkbox
                    checked={selected.has(claim.id)}
                    onCheckedChange={() => toggleOne(claim.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <NextLink
                      href={`/tuntutan/${claim.id}`}
                      className="font-medium text-sm hover:underline text-primary"
                    >
                      {claim.refNo}
                    </NextLink>
                    <p className="text-xs text-muted-foreground">
                      {claim.claimantName} · {claim.departmentName ?? "—"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-700 shrink-0">
                    RM {(claim.totalApprovedMyr ?? claim.totalClaimedMyr).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selection summary card — appears when ≥1 selected */}
      {selected.size > 0 && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-emerald-800 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {selected.size} tuntutan dipilih · Jumlah: RM {totalSelected.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Voucher input — only show when APPROVED claims are selected */}
            {selectedApproved.length > 0 && (
              <div>
                <Label className="text-xs text-emerald-700 mb-1.5 block">
                  No. Baucer Pembayaran (opsyenal)
                </Label>
                <Input
                  value={voucherNo}
                  onChange={(e) => setVoucherNo(e.target.value)}
                  placeholder="cth: BV-2026-001234"
                  className="bg-white text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  No. baucer yang sama akan direkodkan untuk semua tuntutan yang dipilih.
                </p>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <p className="text-xs text-emerald-700 font-medium">{success}</p>
            )}

            <div className="flex gap-2">
              <ExportButton getIds={() => [...selected]} />
              {selectedApproved.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={isPending}
                      className="flex-1"
                    >
                      <Banknote className="w-4 h-4 mr-2" />
                      {isPending
                        ? "Memproses..."
                        : `Tandakan ${selectedApproved.length} Dibayar`}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Sahkan Pembayaran Bulk</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tandakan{" "}
                        <strong>{selectedApproved.length} tuntutan</strong> sebagai
                        dibayar (jumlah: RM{" "}
                        {selectedApproved
                          .reduce(
                            (s, c) => s + (c.totalApprovedMyr ?? c.totalClaimedMyr),
                            0
                          )
                          .toFixed(2)}
                        )?
                        {voucherNo.trim() && (
                          <>
                            {" "}No. Baucer:{" "}
                            <strong>{voucherNo.trim()}</strong>.
                          </>
                        )}{" "}
                        Tindakan ini tidak boleh dibatalkan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={confirmPaid}
                        className=""
                      >
                        Ya, Tandakan Dibayar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
