"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, ArrowLeft } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Email atau kata laluan tidak sah.",
  ACCOUNT_LOCKED: "Akaun anda telah dikunci 15 minit. Cuba sebentar lagi.",
  default: "Ralat semasa log masuk. Sila cuba lagi.",
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [step, setStep] = useState<"password" | "totp">("password");
  const [pendingToken, setPendingToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error?.startsWith("TOTP_REQUIRED:")) {
        setPendingToken(res.error.slice("TOTP_REQUIRED:".length));
        setStep("totp");
        return;
      }
      if (res?.error) {
        setError(ERROR_MESSAGES[res.error] ?? ERROR_MESSAGES.default);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        pendingToken,
        ...(useRecovery ? { recoveryCode } : { totpCode }),
        redirect: false,
      });
      if (res?.error) {
        setError("Kod tidak sah atau pautan telah tamat tempoh. Cuba semula atau log masuk semula.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sidebar to-primary p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-2">
            <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center shadow-md">
              {step === "totp" ? (
                <ShieldCheck className="text-primary-foreground w-8 h-8" />
              ) : (
                <span className="text-primary-foreground text-xl font-bold tracking-tight">
                  MDS
                </span>
              )}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-primary">MediKlaim MDS</CardTitle>
          <CardDescription>
            {step === "totp"
              ? "Masukkan kod dari aplikasi authenticator anda"
              : "Sistem Tuntutan Perubatan Majlis Daerah Setiu"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "password" ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@mds.gov.my"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Kata Laluan</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sedang log masuk..." : "Log Masuk"}
              </Button>
              <Link
                href="/lupa-kata-laluan"
                className="block text-center text-xs text-muted-foreground hover:text-primary mt-2"
              >
                Lupa kata laluan?
              </Link>
            </form>
          ) : (
            <form onSubmit={handleTotpSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {!useRecovery ? (
                <div className="space-y-2">
                  <Label htmlFor="totp">Kod Pengesahan (6 digit)</Label>
                  <Input
                    id="totp"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                    required
                    autoComplete="one-time-code"
                    autoFocus
                    className="text-center text-xl tracking-widest"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="recovery">Kod Pemulihan</Label>
                  <Input
                    id="recovery"
                    type="text"
                    placeholder="A3F892B1CD"
                    maxLength={10}
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                    required
                    autoComplete="off"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">Satu kod pemulihan satu kali guna sahaja.</p>
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || (!useRecovery && totpCode.length !== 6)}
              >
                {loading ? "Mengesahkan..." : "Sahkan"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setUseRecovery(!useRecovery);
                  setError("");
                  setTotpCode("");
                  setRecoveryCode("");
                }}
                className="block w-full text-center text-xs text-muted-foreground hover:text-primary"
              >
                {useRecovery ? "Guna kod authenticator" : "Guna kod pemulihan"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("password");
                  setError("");
                  setPendingToken("");
                  setTotpCode("");
                  setRecoveryCode("");
                  setUseRecovery(false);
                }}
                className="flex items-center justify-center gap-1 w-full text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-3 h-3" />
                Kembali log masuk
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
