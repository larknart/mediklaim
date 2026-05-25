"use client";

import { useState, useTransition, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { resetPasswordWithToken } from "@/server/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Eye, EyeOff, ArrowLeft } from "lucide-react";

function ResetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [isPending, startTransition] = useTransition();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="space-y-4 text-center text-sm text-red-600">
        <p>Pautan tidak sah atau telah tamat tempoh.</p>
        <Link href="/lupa-kata-laluan" className="text-green-700 hover:underline">
          Minta pautan baru
        </Link>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Kata laluan tidak sepadan.");
      return;
    }
    startTransition(async () => {
      try {
        await resetPasswordWithToken(token, newPassword);
        setDone(true);
        setTimeout(() => router.push("/login"), 3000);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Ralat sistem.";
        if (msg === "TOKEN_INVALID") setError("Pautan tidak sah.");
        else if (msg === "TOKEN_EXPIRED") setError("Pautan telah tamat tempoh. Sila minta pautan baru.");
        else setError(msg);
      }
    });
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 text-sm text-green-800 bg-green-50 rounded p-4 border border-green-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Kata laluan berjaya ditetapkan</p>
            <p className="text-xs text-green-700 mt-1">Anda akan dihalakan ke halaman log masuk dalam 3 saat...</p>
          </div>
        </div>
        <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-green-700 hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Log Masuk Sekarang
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}{" "}
            {error.includes("tamat tempoh") && (
              <Link href="/lupa-kata-laluan" className="underline font-medium">Minta pautan baru</Link>
            )}
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="password">Kata Laluan Baru</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Sahkan Kata Laluan Baru</Label>
        <Input
          id="confirm"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>
      <Button
        type="submit"
        className="w-full bg-green-700 hover:bg-green-800"
        disabled={isPending}
      >
        {isPending ? "Menyimpan..." : "Tetapkan Kata Laluan Baru"}
      </Button>
      <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Log Masuk
      </Link>
    </form>
  );
}

export default function ResetKataLaluanPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 to-green-700 p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-2">
            <div className="w-16 h-16 bg-green-700 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">M</span>
            </div>
          </div>
          <CardTitle className="text-xl font-bold text-green-900">Tetapkan Kata Laluan</CardTitle>
          <CardDescription>Cipta kata laluan baru untuk akaun anda</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-center text-gray-500">Memuatkan...</p>}>
            <ResetForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
