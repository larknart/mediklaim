"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAllocationUsage } from "@/server/actions/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, Search, AlertTriangle } from "lucide-react";

interface AllocationRow {
  userId: string;
  name: string;
  staffNo: string | null;
  deptName: string | null;
  limitMyr: number;
  usedMyr: number;
}

interface Props {
  rows: AllocationRow[];
  year: number;
  currentYear: number;
  defaultLimit: number;
}

type DraftRow = { limitMyr: string; usedMyr: string };

export function AllocationTable({ rows, year, currentYear, defaultLimit }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [drafts, setDrafts] = useState<Record<string, DraftRow>>(() =>
    Object.fromEntries(
      rows.map((r) => [r.userId, { limitMyr: String(r.limitMyr), usedMyr: String(r.usedMyr) }])
    )
  );

  const years = [currentYear - 1, currentYear, currentYear + 1];

  function setDraft(userId: string, field: keyof DraftRow, value: string) {
    setDrafts((prev) => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }));
    setSaved(false);
  }

  function save() {
    setError("");
    setSaved(false);

    const entries: { userId: string; usedMyr: number; limitMyr: number }[] = [];

    for (const row of rows) {
      const draft = drafts[row.userId];
      const newUsed = parseFloat(draft.usedMyr);
      const newLimit = parseFloat(draft.limitMyr);

      if (isNaN(newUsed) || newUsed < 0) {
        setError(`Nilai "Telah Guna" tidak sah untuk ${row.name}.`);
        return;
      }
      if (isNaN(newLimit) || newLimit <= 0) {
        setError(`Nilai "Had" tidak sah untuk ${row.name}.`);
        return;
      }

      // Only send changed rows
      const origUsed = Math.round(row.usedMyr * 100) / 100;
      const origLimit = Math.round(row.limitMyr * 100) / 100;
      const roundedUsed = Math.round(newUsed * 100) / 100;
      const roundedLimit = Math.round(newLimit * 100) / 100;

      if (roundedUsed !== origUsed || roundedLimit !== origLimit) {
        entries.push({ userId: row.userId, usedMyr: roundedUsed, limitMyr: roundedLimit });
      }
    }

    if (entries.length === 0) {
      setSaved(true);
      return;
    }

    startTransition(async () => {
      try {
        await setAllocationUsage(year, entries);
        setSaved(true);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal simpan peruntukan.");
      }
    });
  }

  const filtered = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.staffNo ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.deptName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Year selector + search + save */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {years.map((y) => (
            <a
              key={y}
              href={`/admin/peruntukan?year=${y}`}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                y === year
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-muted-foreground"
              }`}
            >
              {y}
            </a>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Cari nama, no. staf, jabatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-sm h-9"
          />
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          {saved && <span className="text-xs text-success font-medium">Tersimpan ✓</span>}
          <Button
            onClick={save}
            disabled={isPending}
            className="h-9"
          >
            <Save className="w-4 h-4 mr-2" />
            {isPending ? "Menyimpan..." : "Simpan Semua"}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">No. Staf</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Jabatan</th>
                  <th className="px-4 py-3 font-medium text-right">Had (RM)</th>
                  <th className="px-4 py-3 font-medium text-right">Telah Guna (RM)</th>
                  <th className="px-4 py-3 font-medium text-right">Baki (RM)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      Tiada staf dijumpai.
                    </td>
                  </tr>
                )}
                {filtered.map((row) => {
                  const draft = drafts[row.userId];
                  const limitVal = parseFloat(draft.limitMyr) || 0;
                  const usedVal = parseFloat(draft.usedMyr) || 0;
                  const baki = limitVal - usedVal;
                  const isOver = usedVal > limitVal;
                  const isChanged =
                    Math.round(parseFloat(draft.usedMyr) * 100) / 100 !== Math.round(row.usedMyr * 100) / 100 ||
                    Math.round(parseFloat(draft.limitMyr) * 100) / 100 !== Math.round(row.limitMyr * 100) / 100;

                  return (
                    <tr key={row.userId} className={isOver ? "bg-red-50" : isChanged ? "bg-amber-50" : ""}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground">{row.name}</div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">
                        {row.staffNo ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">
                        {row.deptName ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="50"
                          value={draft.limitMyr}
                          onChange={(e) => setDraft(row.userId, "limitMyr", e.target.value)}
                          className="w-24 text-right text-sm h-8 ml-auto"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isOver && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.usedMyr}
                            onChange={(e) => setDraft(row.userId, "usedMyr", e.target.value)}
                            className={`w-28 text-right text-sm h-8 ${isOver ? "border-red-400" : ""}`}
                          />
                        </div>
                      </td>
                      <td className={`px-4 py-2.5 text-right font-medium tabular-nums ${isOver ? "text-red-600" : "text-primary"}`}>
                        {baki.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 border-t bg-muted/50 text-xs text-muted-foreground flex items-center gap-4">
            <span>{rows.length} staf · Had lalai: RM {defaultLimit.toFixed(2)}</span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 inline-block" />
              Baris berubah
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block" />
              Melebihi had
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
