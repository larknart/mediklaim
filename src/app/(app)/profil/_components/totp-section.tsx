"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { initiate2fa, confirm2fa, disable2fa } from "@/server/actions/totp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldOff, Copy, CheckCircle2 } from "lucide-react";

type State = "idle" | "enrolling" | "showing_codes" | "disabling";

interface Props {
  totpEnabled: boolean;
  required?: boolean;
}

export function TotpSection({ totpEnabled: initialEnabled, required }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<State>("idle");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState("");

  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [enrollCode, setEnrollCode] = useState("");

  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const [disableCode, setDisableCode] = useState("");

  function startEnroll() {
    setError("");
    startTransition(async () => {
      try {
        const result = await initiate2fa();
        setQrDataUrl(result.qrDataUrl);
        setSecret(result.secret);
        setState("enrolling");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Ralat sistem.");
      }
    });
  }

  function submitEnroll(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const result = await confirm2fa(enrollCode, secret);
        setRecoveryCodes(result.recoveryCodes);
        setSecret("");
        setQrDataUrl("");
        setEnrollCode("");
        setEnabled(true);
        setState("showing_codes");
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Ralat sistem.");
      }
    });
  }

  function submitDisable(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await disable2fa(disableCode);
        setEnabled(false);
        setDisableCode("");
        setState("idle");
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Ralat sistem.");
      }
    });
  }

  function copyAllCodes() {
    navigator.clipboard.writeText(recoveryCodes.join("\n"))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => setError("Gagal menyalin. Sila salin kod secara manual."));
  }

  if (state === "idle") {
    return (
      <div className="space-y-4">
        {required && !enabled && (
          <Alert>
            <AlertDescription className="text-amber-700">
              Pentadbir sistem mewajibkan 2FA untuk akaun Admin. Sila aktifkan sebelum meneruskan.
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {enabled ? (
              <>
                <ShieldCheck className="w-5 h-5 text-success" />
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Aktif</Badge>
              </>
            ) : (
              <>
                <ShieldOff className="w-5 h-5 text-muted-foreground" />
                <Badge variant="outline" className="text-muted-foreground">Tidak Aktif</Badge>
              </>
            )}
          </div>
          {enabled ? (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/20 hover:bg-destructive/10"
              onClick={() => { setState("disabling"); setError(""); }}
            >
              Nyahaktif 2FA
            </Button>
          ) : (
            <Button
              size="sm"
              className=""
              onClick={startEnroll}
              disabled={isPending}
            >
              {isPending ? "Memuat..." : "Aktifkan 2FA"}
            </Button>
          )}
        </div>
        {!enabled && (
          <p className="text-xs text-muted-foreground">
            2FA menambah lapisan keselamatan dengan memerlukan kod dari aplikasi authenticator semasa log masuk.
          </p>
        )}
      </div>
    );
  }

  if (state === "enrolling") {
    return (
      <form onSubmit={submitEnroll} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Imbas kod QR menggunakan aplikasi authenticator (Google Authenticator, Authy, dll.).
        </p>
        <div className="flex justify-center">
          <Image src={qrDataUrl} alt="QR 2FA" width={200} height={200} className="border rounded" unoptimized />
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-muted-foreground">Tidak dapat imbas? Masukkan kunci manual</summary>
          <code className="block mt-2 p-2 bg-muted rounded break-all select-all font-mono">{secret}</code>
        </details>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-2">
          <Label htmlFor="enroll-code">Kod 6 digit dari aplikasi</Label>
          <Input
            id="enroll-code"
            type="text"
            inputMode="numeric"
            placeholder="000000"
            maxLength={6}
            value={enrollCode}
            onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, ""))}
            required
            autoFocus
            className="text-center text-xl tracking-widest"
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1"
            onClick={() => { setState("idle"); setError(""); setEnrollCode(""); setSecret(""); setQrDataUrl(""); }}>
            Batal
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={isPending || enrollCode.length !== 6}
          >
            {isPending ? "Mengesahkan..." : "Aktifkan"}
          </Button>
        </div>
      </form>
    );
  }

  if (state === "showing_codes") {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 text-sm text-primary bg-success/5 rounded p-4 border border-primary/20">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">2FA berjaya diaktifkan</p>
            <p className="text-xs text-primary mt-1">
              Simpan kod pemulihan di bawah di tempat selamat. Ia hanya dipaparkan sekali sahaja.
            </p>
          </div>
        </div>
        <div className="bg-muted/50 rounded p-3 border space-y-1">
          {recoveryCodes.map((code) => (
            <code key={code} className="block text-sm font-mono text-muted-foreground">{code}</code>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={copyAllCodes}>
          {copied ? (
            <><CheckCircle2 className="w-4 h-4 mr-2 text-success" />Disalin!</>
          ) : (
            <><Copy className="w-4 h-4 mr-2" />Salin Semua Kod</>
          )}
        </Button>
        <Button type="button" className="w-full" onClick={() => { setRecoveryCodes([]); setCopied(false); setState("idle"); }}>
          Selesai
        </Button>
      </div>
    );
  }

  // state === "disabling"
  return (
    <form onSubmit={submitDisable} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Masukkan kod 6 digit dari aplikasi authenticator untuk mengesahkan penyahaktifan 2FA.
      </p>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="space-y-2">
        <Label htmlFor="disable-code">Kod Pengesahan</Label>
        <Input
          id="disable-code"
          type="text"
          inputMode="numeric"
          placeholder="000000"
          maxLength={6}
          value={disableCode}
          onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
          required
          autoFocus
          className="text-center text-xl tracking-widest"
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1"
          onClick={() => { setState("idle"); setError(""); setDisableCode(""); }}>
          Batal
        </Button>
        <Button
          type="submit"
          variant="destructive"
          className="flex-1"
          disabled={isPending || disableCode.length !== 6}
        >
          {isPending ? "Memproses..." : "Nyahaktif 2FA"}
        </Button>
      </div>
    </form>
  );
}
