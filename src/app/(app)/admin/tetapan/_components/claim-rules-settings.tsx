"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSetting } from "@/server/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save } from "lucide-react";

interface Props {
  cutoffDays: number;
  receiptMaxAgeMonths: number;
  proRataEnabled: boolean;
  slaHeadDays: number;
  slaFinanceDays: number;
  slaApproverDays: number;
}

export function ClaimRulesSettings({ cutoffDays: initCutoff, receiptMaxAgeMonths: initMaxAge, proRataEnabled: initProRata, slaHeadDays: initHead, slaFinanceDays: initFinance, slaApproverDays: initApprover }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cutoffDays, setCutoffDays] = useState(String(initCutoff));
  const [maxAge, setMaxAge] = useState(String(initMaxAge));
  const [proRata, setProRata] = useState(initProRata);
  const [slaHead, setSlaHead] = useState(String(initHead));
  const [slaFinance, setSlaFinance] = useState(String(initFinance));
  const [slaApprover, setSlaApprover] = useState(String(initApprover));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function save() {
    const days = parseInt(cutoffDays);
    const months = parseInt(maxAge);
    const head = parseInt(slaHead);
    const finance = parseInt(slaFinance);
    const approver = parseInt(slaApprover);
    if (isNaN(days) || days < 1 || days > 365) { setError("Had hari hantar: 1–365."); return; }
    if (isNaN(months) || months < 1 || months > 24) { setError("Had umur resit: 1–24 bulan."); return; }
    if ([head, finance, approver].some((v) => isNaN(v) || v < 1 || v > 30)) { setError("SLA: 1–30 hari bekerja."); return; }
    setError(""); setSaved(false);
    startTransition(async () => {
      try {
        await updateSetting("claim_cutoff_days", days);
        await updateSetting("receipt_max_age_months", months);
        await updateSetting("pro_rata_enabled", proRata);
        await updateSetting("sla_head_days", head);
        await updateSetting("sla_finance_days", finance);
        await updateSetting("sla_approver_days", approver);
        setSaved(true);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal simpan.");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Peraturan Tuntutan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">
            Had hari hantar tuntutan (selepas bulan berakhir)
          </Label>
          <Input
            type="number"
            min="1"
            max="365"
            value={cutoffDays}
            onChange={(e) => setCutoffDays(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Contoh: 45 = tuntutan Januari mesti dihantar sebelum 17 Mac.
          </p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">
            Had umur resit (bulan)
          </Label>
          <Input
            type="number"
            min="1"
            max="24"
            value={maxAge}
            onChange={(e) => setMaxAge(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Resit lebih lama dari had ini tidak diterima dalam tuntutan.
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={proRata}
            onCheckedChange={(v) => setProRata(!!v)}
          />
          <div>
            <span className="text-sm font-medium">Peruntukan pro-rata</span>
            <p className="text-xs text-muted-foreground">
              Kakitangan yang mula berkhidmat pertengahan tahun mendapat peruntukan mengikut baki bulan.
            </p>
          </div>
        </label>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Had SLA (hari bekerja)</p>
          <p className="text-xs text-muted-foreground mb-3">Amaran kuning ≥ 75% had, merah apabila melepasi had.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Sokongan (HEAD)</Label>
              <Input type="number" min="1" max="30" value={slaHead} onChange={(e) => setSlaHead(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Kewangan</Label>
              <Input type="number" min="1" max="30" value={slaFinance} onChange={(e) => setSlaFinance(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Kelulusan</Label>
              <Input type="number" min="1" max="30" value={slaApprover} onChange={(e) => setSlaApprover(e.target.value)} />
            </div>
          </div>
        </div>
        {saved && <p className="text-xs text-success">Tetapan disimpan.</p>}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <Button onClick={save} disabled={isPending} className="">
          <Save className="w-4 h-4 mr-2" />
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </CardContent>
    </Card>
  );
}
