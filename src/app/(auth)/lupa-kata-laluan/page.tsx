"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/server/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, ArrowLeft } from "lucide-react";

export default function LupaKataLaluanPage() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await requestPasswordReset(email.trim());
        setDone(true);
      } catch {
        setError("Ralat sistem. Sila cuba lagi.");
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sidebar to-primary p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-2">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">M</span>
            </div>
          </div>
          <CardTitle className="text-xl font-bold text-primary">Lupa Kata Laluan</CardTitle>
          <CardDescription>Masukkan e-mel akaun anda</CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-sm text-primary bg-success/5 rounded p-4 border border-primary/20">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">E-mel dihantar</p>
                  <p className="text-xs text-primary mt-1">
                    Jika e-mel terdaftar dalam sistem, pautan penetapan semula kata laluan telah dihantar. Semak inbox (termasuk folder spam).
                  </p>
                </div>
              </div>
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Log Masuk
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mel</Label>
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
              <Button
                type="submit"
                className="w-full"
                disabled={isPending}
              >
                {isPending ? "Menghantar..." : "Hantar Pautan Reset"}
              </Button>
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Log Masuk
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
