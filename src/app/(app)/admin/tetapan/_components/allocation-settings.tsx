"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSetting } from "@/server/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save } from "lucide-react";

export function AllocationSettings({ defaultLimit: initial }: { defaultLimit: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [limit, setLimit] = useState(String(initial));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function save() {
    const val = parseFloat(limit);
    if (isNaN(val) || val <= 0) { setError("Amaun tidak sah."); return; }
    setError(""); setSaved(false);
    startTransition(async () => {
      try {
        await updateSetting("default_annual_limit", val);
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
        <CardTitle className="text-base">Peruntukan Tahunan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-gray-500 mb-1.5 block">
            Had lalai peruntukan tahunan (RM)
          </Label>
          <Input
            type="number"
            min="0"
            step="50"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">
            Peruntukan ini digunakan apabila tiada had khas ditetapkan untuk pengguna.
            Reset automatik setiap 1 Januari.
          </p>
        </div>
        {saved && <p className="text-xs text-success">Tetapan disimpan.</p>}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <Button onClick={save} disabled={isPending} className="">
          <Save className="w-4 h-4 mr-2" />
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </CardContent>
    </Card>
  );
}
