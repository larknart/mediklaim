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
import { Save, Database, HardDrive, Download, AlertTriangle } from "lucide-react";

interface SistemSettingsProps {
  maintenanceMode: boolean;
  logRetentionYears: number;
  stats: {
    dbSize: string;
    storageMb: string;
    claimCount: number;
    userCount: number;
    receiptCount: number;
    version: string;
  };
}

export function SistemSettings(props: SistemSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [maintenance, setMaintenance] = useState(props.maintenanceMode);
  const [logRetention, setLogRetention] = useState(String(props.logRetentionYears));

  function save() {
    setError(""); setSaved(false);
    startTransition(async () => {
      try {
        await updateSetting("maintenance_mode", maintenance);
        await updateSetting("log_retention_years", parseInt(logRetention, 10));
        setSaved(true);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal simpan.");
      }
    });
  }

  function downloadPdpa() {
    window.open("/api/admin/pdpa-export", "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Database className="w-4 h-4" />
              Pangkalan Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold">{props.stats.dbSize}</p>
            <p className="text-xs text-muted-foreground">{props.stats.claimCount} tuntutan · {props.stats.receiptCount} resit · {props.stats.userCount} pengguna</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <HardDrive className="w-4 h-4" />
              Storan Fail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{props.stats.storageMb} MB</p>
            <p className="text-xs text-muted-foreground">Folder ./storage</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            Mod Penyelenggaraan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={maintenance} onCheckedChange={(v) => setMaintenance(!!v)} />
            <div>
              <span className="text-sm font-medium">Aktifkan mod penyelenggaraan</span>
              <p className="text-xs text-muted-foreground">Pengguna bukan admin akan diarahkan ke halaman penyelenggaraan.</p>
            </div>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pengekalan Log</CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Tempoh simpan audit log (tahun)</Label>
          <Input
            type="number"
            min="1"
            max="20"
            className="w-32"
            value={logRetention}
            onChange={(e) => setLogRetention(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">Polisi kerajaan: minimum 7 tahun.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">PDPA &amp; Eksport Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Eksport semua data sistem (pengguna, tuntutan, resit) dalam format JSON untuk tujuan pematuhan PDPA. Tidak termasuk kata laluan.
          </p>
          <Button variant="outline" onClick={downloadPdpa} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Eksport Data PDPA (JSON)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Versi Sistem</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-mono text-muted-foreground">MediKlaim MDS v{props.stats.version}</p>
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
