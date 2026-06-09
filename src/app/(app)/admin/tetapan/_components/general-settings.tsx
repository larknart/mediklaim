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

export function GeneralSettings({ orgName: initial }: { orgName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [orgName, setOrgName] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function save() {
    setError(""); setSaved(false);
    startTransition(async () => {
      try {
        await updateSetting("org_name", orgName.trim());
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
        <CardTitle className="text-base">Maklumat Organisasi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Nama Agensi</Label>
          <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
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
