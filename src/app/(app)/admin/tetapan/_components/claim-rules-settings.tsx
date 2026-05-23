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
}

export function ClaimRulesSettings({ cutoffDays: initCutoff, receiptMaxAgeMonths: initMaxAge, proRataEnabled: initProRata }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cutoffDays, setCutoffDays] = useState(String(initCutoff));
  const [maxAge, setMaxAge] = useState(String(initMaxAge));
  const [proRata, setProRata] = useState(initProRata);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function save() {
    const days = parseInt(cutoffDays);
    const months = parseInt(maxAge);
    if (isNaN(days) || days < 1 || days > 365) { setError("Had hari hantar: 1–365."); return; }
    if (isNaN(months) || months < 1 || months > 24) { setError("Had umur resit: 1–24 bulan."); return; }
    setError(""); setSaved(false);
    startTransition(async () => {
      try {
        await updateSetting("claim_cutoff_days", days);
        await updateSetting("receipt_max_age_months", months);
        await updateSetting("pro_rata_enabled", proRata);
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
          <Label className="text-xs text-gray-500 mb-1.5 block">
            Had hari hantar tuntutan (selepas bulan berakhir)
          </Label>
          <Input
            type="number"
            min="1"
            max="365"
            value={cutoffDays}
            onChange={(e) => setCutoffDays(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">
            Contoh: 45 = tuntutan Januari mesti dihantar sebelum 17 Mac.
          </p>
        </div>
        <div>
          <Label className="text-xs text-gray-500 mb-1.5 block">
            Had umur resit (bulan)
          </Label>
          <Input
            type="number"
            min="1"
            max="24"
            value={maxAge}
            onChange={(e) => setMaxAge(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">
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
            <p className="text-xs text-gray-500">
              Kakitangan yang mula berkhidmat pertengahan tahun mendapat peruntukan mengikut baki bulan.
            </p>
          </div>
        </label>
        {saved && <p className="text-xs text-green-600">Tetapan disimpan.</p>}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <Button onClick={save} disabled={isPending} className="bg-green-700 hover:bg-green-800">
          <Save className="w-4 h-4 mr-2" />
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </CardContent>
    </Card>
  );
}
