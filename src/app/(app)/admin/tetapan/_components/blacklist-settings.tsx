"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBlacklistKeyword, deleteBlacklistKeyword } from "@/server/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, ShieldAlert } from "lucide-react";

interface Keyword { id: string; keyword: string; reason: string | null }

export function BlacklistSettings({ keywords: initial }: { keywords: Keyword[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [newKw, setNewKw] = useState("");
  const [newReason, setNewReason] = useState("");

  function add() {
    if (!newKw.trim()) return;
    setError("");
    startTransition(async () => {
      try {
        await addBlacklistKeyword(newKw.trim(), newReason.trim() || undefined);
        setNewKw(""); setNewReason("");
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal tambah.");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Padam keyword ini?")) return;
    startTransition(async () => {
      try {
        await deleteBlacklistKeyword(id);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal padam.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            Keyword Tidak Layak
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-500">
            Item resit yang mengandungi keyword ini akan auto-flagged sebagai tidak layak semasa semakan kewangan.
          </p>
          <div className="flex gap-2">
            <Input
              value={newKw}
              onChange={(e) => setNewKw(e.target.value)}
              placeholder="keyword (cth: vitamin)"
              className="flex-1"
            />
            <Input
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="sebab (opsyenal)"
              className="flex-1"
            />
            <Button onClick={add} disabled={isPending || !newKw.trim()} className="bg-green-700 hover:bg-green-800 shrink-0">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="space-y-1">
            {initial.map((kw) => (
              <div key={kw.id} className="flex items-center gap-2 p-2 rounded bg-red-50 border border-red-100">
                <span className="flex-1 text-sm font-mono text-red-700">{kw.keyword}</span>
                {kw.reason && <span className="text-xs text-gray-500">{kw.reason}</span>}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(kw.id)}
                  disabled={isPending}
                  className="shrink-0 h-7 w-7"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
