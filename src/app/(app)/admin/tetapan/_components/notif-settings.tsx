"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateSetting, testSmtp, testWaConnection, testWaSend } from "@/server/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, MessageCircle, Mail, Wifi } from "lucide-react";

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

  const [smtpResult, setSmtpResult] = useState<"ok" | "fail" | null>(null);
  const [smtpTesting, setSmtpTesting] = useState(false);

  const [waEnabled, setWaEnabled] = useState(props.waEnabled);
  const [waConnResult, setWaConnResult] = useState<string | null>(null);
  const [waConnTesting, setWaConnTesting] = useState(false);
  const [waSendResult, setWaSendResult] = useState<string | null>(null);
  const [waSending, setWaSending] = useState(false);
  const waPhoneRef = useRef<HTMLInputElement>(null);

  function testSmtpHandler() {
    setSmtpResult(null); setSmtpTesting(true);
    startTransition(async () => {
      try {
        const r = await testSmtp();
        setSmtpResult(r.ok ? "ok" : "fail");
      } catch { setSmtpResult("fail"); }
      setSmtpTesting(false);
    });
  }

  function testWaConnHandler() {
    setWaConnResult(null); setWaConnTesting(true);
    startTransition(async () => {
      try {
        const r = await testWaConnection();
        setWaConnResult(r.connected ? `✓ ${r.state ?? "open"}` : `✗ ${r.state ?? "disconnected"}`);
      } catch (e) { setWaConnResult(`✗ ${e instanceof Error ? e.message : "Ralat"}`); }
      setWaConnTesting(false);
    });
  }

  function testWaSendHandler() {
    const phone = waPhoneRef.current?.value.trim() ?? "";
    if (!phone) { setWaSendResult("Masukkan nombor telefon."); return; }
    setWaSendResult(null); setWaSending(true);
    startTransition(async () => {
      try {
        const r = await testWaSend(phone);
        setWaSendResult(r.success ? "✓ Mesej dihantar." : `✗ ${r.error ?? "Gagal"}`);
      } catch (e) { setWaSendResult(`✗ ${e instanceof Error ? e.message : "Ralat"}`); }
      setWaSending(false);
    });
  }
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
    <div className="space-y-4">
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
            <p className="text-xs text-muted-foreground">
              Hantar mesej WA untuk CLAIM_APPROVED, CLAIM_REJECTED, ACTION_REQUIRED
            </p>
          </div>
        </label>

        <div className={`space-y-3 ${!waEnabled ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Had / minit</Label>
              <Input
                type="number"
                min="1"
                value={ratePerMin}
                onChange={(e) => setRatePerMin(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Had / hari</Label>
              <Input
                type="number"
                min="1"
                value={ratePerDay}
                onChange={(e) => setRatePerDay(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Quiet hours mula (jam)</Label>
              <Input
                type="number"
                min="0"
                max="23"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Quiet hours tamat (jam)</Label>
              <Input
                type="number"
                min="0"
                max="23"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Mesej tidak dihantar antara jam {quietStart}:00 – {quietEnd}:00. Akan dihantar semula bila buka.
          </p>
        </div>

        {waEnabled && (
          <div className="pt-3 border-t space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Uji Sambungan Evolution API</p>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={testWaConnHandler} disabled={waConnTesting}>
                  <Wifi className="w-3.5 h-3.5 mr-1.5" />
                  {waConnTesting ? "Menyemak..." : "Semak Sambungan"}
                </Button>
                {waConnResult && (
                  <span className={`text-xs font-mono ${waConnResult.startsWith("✓") ? "text-success" : "text-red-500"}`}>
                    {waConnResult}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Hantar Mesej Ujian</p>
              <div className="flex items-center gap-2">
                <Input ref={waPhoneRef} placeholder="60123456789" className="w-40 text-sm" />
                <Button variant="outline" size="sm" onClick={testWaSendHandler} disabled={waSending}>
                  {waSending ? "Menghantar..." : "Hantar"}
                </Button>
              </div>
              {waSendResult && (
                <p className={`text-xs font-mono mt-1 ${waSendResult.startsWith("✓") ? "text-success" : "text-red-500"}`}>
                  {waSendResult}
                </p>
              )}
            </div>
          </div>
        )}

        {saved && <p className="text-xs text-success">Tetapan disimpan.</p>}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        <Button onClick={save} disabled={isPending} className="">
          <Save className="w-4 h-4 mr-2" />
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="w-4 h-4" />
          E-mel (SMTP)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Uji sambungan SMTP menggunakan tetapan semasa dalam .env.</p>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={testSmtpHandler} disabled={smtpTesting}>
            {smtpTesting ? "Menguji..." : "Uji Sambungan SMTP"}
          </Button>
          {smtpResult === "ok" && <span className="text-xs text-success font-mono">✓ Sambungan berjaya.</span>}
          {smtpResult === "fail" && <span className="text-xs text-red-500 font-mono">✗ Gagal. Semak SMTP_HOST/PORT/USER/PASS.</span>}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
