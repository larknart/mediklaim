"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSetting } from "@/server/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, Hash } from "lucide-react";

interface RefNoSettingsProps {
  prefix: string;
  padding: number;
  currentCounter: number;
}

export function RefNoSettings(props: RefNoSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [prefix, setPrefix] = useState(props.prefix);
  const [padding, setPadding] = useState(String(props.padding));

  const previewNext = `${prefix}/${new Date().getFullYear()}/${String(props.currentCounter + 1).padStart(parseInt(padding, 10) || 5, "0")}`;

  function save() {
    const paddingNum = parseInt(padding, 10);
    if (!prefix.trim()) { setError("Awalan tidak boleh kosong."); return; }
    if (isNaN(paddingNum) || paddingNum < 3 || paddingNum > 8) { setError("Bilangan digit: 3–8."); return; }

    setError(""); setSaved(false);
    startTransition(async () => {
      try {
        await updateSetting("ref_no_prefix", prefix.trim());
        await updateSetting("ref_no_padding", paddingNum);
        setSaved(true);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal simpan.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Hash className="w-4 h-4" />
            Format Nombor Rujukan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Awalan (prefix)</Label>
              <Input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="MDS/MK"
              />
              <p className="text-xs text-gray-400 mt-1">Contoh: MDS/MK atau PBT/TUNTUTAN</p>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Bilangan digit</Label>
              <Input
                type="number"
                min="3"
                max="8"
                value={padding}
                onChange={(e) => setPadding(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Nombor diisi sifar di hadapan</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-md p-3 border">
            <p className="text-xs text-gray-500 mb-1">Nombor rujukan seterusnya:</p>
            <p className="text-lg font-mono font-bold text-gray-800">{previewNext}</p>
            <p className="text-xs text-gray-400 mt-1">Tuntutan semasa tahun ini: {props.currentCounter}</p>
          </div>

          <p className="text-xs text-amber-600 bg-amber-50 rounded p-2 border border-amber-200">
            Perubahan format hanya mempengaruhi tuntutan baru. Tuntutan sedia ada tidak berubah.
          </p>

          {saved && <p className="text-xs text-success">Tetapan disimpan.</p>}
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <Button onClick={save} disabled={isPending} className="">
            <Save className="w-4 h-4 mr-2" />
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
