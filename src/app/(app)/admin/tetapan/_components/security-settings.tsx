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
import { Save, Shield } from "lucide-react";

interface SecuritySettingsProps {
  loginMaxAttempts: number;
  loginLockDurationMin: number;
  sessionTimeoutMin: number;
  sessionWarningMin: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSymbol: boolean;
  maxUploadSizeMb: number;
  require2faAdmin: boolean;
  passwordExpiryDays: number;
}

export function SecuritySettings(props: SecuritySettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [maxAttempts, setMaxAttempts] = useState(String(props.loginMaxAttempts));
  const [lockDuration, setLockDuration] = useState(String(props.loginLockDurationMin));
  const [sessionTimeout, setSessionTimeout] = useState(String(props.sessionTimeoutMin));
  const [sessionWarning, setSessionWarning] = useState(String(props.sessionWarningMin));
  const [pwMinLen, setPwMinLen] = useState(String(props.passwordMinLength));
  const [pwUpper, setPwUpper] = useState(props.passwordRequireUppercase);
  const [pwNumber, setPwNumber] = useState(props.passwordRequireNumber);
  const [pwSymbol, setPwSymbol] = useState(props.passwordRequireSymbol);
  const [maxUpload, setMaxUpload] = useState(String(props.maxUploadSizeMb));
  const [require2fa, setRequire2fa] = useState(props.require2faAdmin);
  const [pwExpiry, setPwExpiry] = useState(String(props.passwordExpiryDays));

  function save() {
    const attempts = parseInt(maxAttempts, 10);
    const lock = parseInt(lockDuration, 10);
    const timeout = parseInt(sessionTimeout, 10);
    const upload = parseInt(maxUpload, 10);
    const pwLen = parseInt(pwMinLen, 10);

    if (isNaN(attempts) || attempts < 3 || attempts > 10) {
      setError("Cubaan gagal: antara 3–10."); return;
    }
    if (isNaN(lock) || lock < 5 || lock > 60) {
      setError("Tempoh kunci: antara 5–60 minit."); return;
    }
    if (isNaN(timeout) || timeout < 15 || timeout > 480) {
      setError("Tamat tempoh sesi: antara 15–480 minit."); return;
    }
    const warning = parseInt(sessionWarning, 10);
    if (isNaN(warning) || warning < 2 || warning > 30) {
      setError("Amaran sesi: antara 2–30 minit."); return;
    }
    if (isNaN(upload) || upload < 1 || upload > 50) {
      setError("Had muat naik: antara 1–50 MB."); return;
    }
    if (isNaN(pwLen) || pwLen < 6 || pwLen > 32) {
      setError("Panjang kata laluan: antara 6–32."); return;
    }

    setError(""); setSaved(false);
    startTransition(async () => {
      try {
        await updateSetting("login_max_attempts", attempts);
        await updateSetting("login_lock_duration_min", lock);
        await updateSetting("session_timeout_min", timeout);
        await updateSetting("session_warning_min", warning);
        await updateSetting("password_min_length", pwLen);
        await updateSetting("password_require_uppercase", pwUpper);
        await updateSetting("password_require_number", pwNumber);
        await updateSetting("password_require_symbol", pwSymbol);
        await updateSetting("max_upload_size_mb", upload);
        await updateSetting("require_2fa_admin", require2fa);
        await updateSetting("password_expiry_days", parseInt(pwExpiry, 10) || 0);
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
            <Shield className="w-4 h-4" />
            Log Masuk &amp; Kunci Akaun
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Maksimum cubaan gagal</Label>
              <Input type="number" min="3" max="10" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Tempoh kunci (minit)</Label>
              <Input type="number" min="5" max="60" value={lockDuration} onChange={(e) => setLockDuration(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Tamat tempoh sesi (minit)</Label>
              <Input type="number" min="15" max="480" value={sessionTimeout} onChange={(e) => setSessionTimeout(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">
                Berkuat kuasa serta-merta untuk log masuk baru. Sesi sedia ada akan diperbaharui pada tindakan seterusnya.
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Amaran tamat tempoh sesi (minit)</Label>
              <Input type="number" min="2" max="30" value={sessionWarning} onChange={(e) => setSessionWarning(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">
                Tunjuk amaran X minit sebelum sesi tamat.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={require2fa} onCheckedChange={(v) => setRequire2fa(!!v)} />
              <span className="text-sm">Wajibkan 2FA untuk pengguna Admin</span>
            </label>
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              Admin tanpa 2FA akan diarahkan ke halaman profil untuk setup semasa log masuk.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Polisi Kata Laluan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Panjang minimum</Label>
            <Input type="number" min="6" max="32" value={pwMinLen} onChange={(e) => setPwMinLen(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={pwUpper} onCheckedChange={(v) => setPwUpper(!!v)} />
              <span className="text-sm">Wajib huruf besar</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={pwNumber} onCheckedChange={(v) => setPwNumber(!!v)} />
              <span className="text-sm">Wajib nombor</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={pwSymbol} onCheckedChange={(v) => setPwSymbol(!!v)} />
              <span className="text-sm">Wajib simbol (!@#$...)</span>
            </label>
          </div>
          <div className="pt-2 border-t">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Tempoh luput kata laluan (hari)</Label>
            <Input
              type="number"
              min="0"
              max="365"
              value={pwExpiry}
              onChange={(e) => setPwExpiry(e.target.value)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground mt-1">
              0 = tidak luput. Pengguna akan diarahkan ke /profil untuk tukar kata laluan bila tempoh tamat.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Had Muat Naik</CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Saiz maksimum fail (MB)</Label>
          <Input type="number" min="1" max="50" value={maxUpload} onChange={(e) => setMaxUpload(e.target.value)} />
          <p className="text-xs text-muted-foreground mt-1">
            Memerlukan kemas kini konfigurasi Next.js dan restart app di Coolify.
          </p>
        </CardContent>
      </Card>

      {saved && <p className="text-xs text-success">Tetapan disimpan.</p>}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button onClick={save} disabled={isPending} className="">
        <Save className="w-4 h-4 mr-2" />
        {isPending ? "Menyimpan..." : "Simpan"}
      </Button>
    </div>
  );
}
