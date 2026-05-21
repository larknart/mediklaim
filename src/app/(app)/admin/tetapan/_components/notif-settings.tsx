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
import { Save, MessageCircle } from "lucide-react";

interface NotifSettingsProps {
  waEnabled: boolean;
  waRatePerMin: number;
  waRatePerDay: number;
  waQuietStart: number;
  waQuietEnd: number;
}

export function NotifSettings(props: NotifSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [waEnabled, setWaEnabled] = useState(props.waEnabled);
  const [ratePerMin, setRatePerMin] = useState(String(props.waRatePerMin));
  const [ratePerDay, setRatePerDay] = useState(String(props.waRatePerDay));
  const [quietStart, setQuietStart] = useState(String(props.waQuietStart));
  const [quietEnd, setQuietEnd] = useState(String(props.waQuietEnd));

  function save() {
    setError(""); setSaved(false);
    startTransition(async () => {
      try {
        await updateSetting("wa_enabled", waEnabled);
        await updateSetting("wa_rate_limit_per_min", parseInt(ratePerMin));
        await updateSetting("wa_rate_limit_per_day", parseInt(ratePerDay));
        await updateSetting("wa_quiet_hours_start", parseInt(quietStart));
        await updateSetting("wa_quiet_hours_end", parseInt(quietEnd));
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
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          WhatsApp (Evolution API)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={waEnabled} onCheckedChange={(v) => setWaEnabled(!!v)} />
          <div>
            <span className="text-sm font-medium">Aktifkan notifikasi WhatsApp</span>
            <p className="text-xs text-gray-500">
              Hantar mesej WA untuk CLAIM_APPROVED, CLAIM_REJECTED, ACTION_REQUIRED
            </p>
          </div>
        </label>

        <div className={`space-y-3 ${!waEnabled ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Had / minit</Label>
              <Input
                type="number"
                min="1"
                value={ratePerMin}
                onChange={(e) => setRatePerMin(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Had / hari</Label>
              <Input
                type="number"
                min="1"
                value={ratePerDay}
                onChange={(e) => setRatePerDay(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Quiet hours mula (jam)</Label>
              <Input
                type="number"
                min="0"
                max="23"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Quiet hours tamat (jam)</Label>
              <Input
                type="number"
                min="0"
                max="23"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Mesej tidak dihantar antara jam {quietStart}:00 – {quietEnd}:00. Akan dihantar semula bila buka.
          </p>
        </div>

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
