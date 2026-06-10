"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBlacklistKeyword, deleteBlacklistKeyword } from "@/server/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, ShieldAlert } from "lucide-react";

interface Keyword { id: string; keyword: string; reason: string | null }

export function BlacklistSettings({ keywords: initial }: { keywords: Keyword[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [newKw, setNewKw] = useState("");
  const [newReason, setNewReason] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
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
            <ShieldAlert className="w-4 h-4 text-destructive" />
            Keyword Tidak Layak
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
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
            <Button onClick={add} disabled={isPending || !newKw.trim()} className="shrink-0">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="space-y-1">
            {initial.map((kw) => (
              <div key={kw.id} className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/10">
                <span className="flex-1 text-sm font-mono text-destructive">{kw.keyword}</span>
                {kw.reason && <span className="text-xs text-muted-foreground">{kw.reason}</span>}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(kw.id)}
                  disabled={isPending}
                  className="shrink-0 h-7 w-7"
                  aria-label="Padam keyword"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Padam keyword ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak boleh dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Padam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
