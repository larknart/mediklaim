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

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Email atau kata laluan tidak sah.",
  ACCOUNT_LOCKED: "Akaun anda telah dikunci 15 minit. Cuba sebentar lagi.",
  default: "Ralat semasa log masuk. Sila cuba lagi.",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(ERROR_MESSAGES[res.error] ?? ERROR_MESSAGES.default);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 to-green-700 p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-2">
            <div className="w-16 h-16 bg-green-700 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">M</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-green-900">MediKlaim MDS</CardTitle>
          <CardDescription>Sistem Tuntutan Perubatan Majlis Daerah Setiu</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <Button
              type="submit"
              className="w-full bg-green-700 hover:bg-green-800"
              disabled={loading}
            >
              {loading ? "Sedang log masuk..." : "Log Masuk"}
            </Button>
            <Link
              href="/lupa-kata-laluan"
              className="block text-center text-xs text-gray-500 hover:text-green-700 mt-2"
            >
              Lupa kata laluan?
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
