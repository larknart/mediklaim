"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPublicHoliday, deletePublicHoliday, importPublicHolidays } from "@/server/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, Plus, CalendarDays, Download } from "lucide-react";

export interface HolidayRow {
  id: string;
  date: string;
  name: string;
}

export function HolidaySettings({ holidays }: { holidays: HolidayRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const currentYear = new Date().getFullYear();
  const [importYear, setImportYear] = useState(currentYear);
  const [importMsg, setImportMsg] = useState("");

  function handleAdd() {
    if (!date || !name.trim()) { setError("Tarikh dan nama diperlukan."); return; }
    setError("");
    startTransition(async () => {
      try {
        await addPublicHoliday(date, name.trim());
        setDate(""); setName("");
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal tambah.");
      }
    });
  }

  function handleImport() {
    setImportMsg("");
    setError("");
    startTransition(async () => {
      try {
        const result = await importPublicHolidays(importYear);
        setImportMsg(`${result.imported} cuti diimport untuk ${importYear}.`);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal import.");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deletePublicHoliday(id);
      router.refresh();
    });
  }

  const byYear = holidays.reduce<Record<number, HolidayRow[]>>((acc, h) => {
    const y = new Date(h.date).getFullYear();
    (acc[y] ??= []).push(h);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="w-4 h-4" />
          Kalendar Cuti Umum
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-gray-500">
          Hujung minggu Terengganu (Jumaat + Sabtu) dikecualikan secara automatik.
          Tambah cuti umum di bawah.
        </p>

        {/* Import from API */}
        <div className="flex gap-2 items-end border border-green-200 bg-green-50 rounded-lg p-3">
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Tahun</Label>
            <select
              value={importYear}
              onChange={(e) => setImportYear(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <Button
            onClick={handleImport}
            disabled={isPending}
            size="sm"
            variant="outline"
            className="border-green-700 text-green-700 hover:bg-green-100"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Import dari API (TRG)
          </Button>
          {importMsg && <p className="text-xs text-green-700 font-medium">{importMsg}</p>}
        </div>

        {/* Add form */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label className="text-xs text-gray-500 mb-1.5 block">Tarikh</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex-[2]">
            <Label className="text-xs text-gray-500 mb-1.5 block">Nama Cuti</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hari Raya Aidilfitri..."
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
          </div>
          <Button
            onClick={handleAdd}
            disabled={isPending}
            size="sm"
            className="bg-green-700 hover:bg-green-800 shrink-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {/* List by year */}
        {Object.entries(byYear)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([year, rows]) => (
            <div key={year}>
              <p className="text-xs font-semibold text-gray-500 mb-2">{year}</p>
              <div className="space-y-1">
                {rows
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((h) => (
                    <div key={h.id} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-gray-50">
                      <span className="text-gray-500 w-28 shrink-0">{h.date}</span>
                      <span className="flex-1">{h.name}</span>
                      <button
                        onClick={() => handleDelete(h.id)}
                        disabled={isPending}
                        className="text-gray-300 hover:text-red-400 disabled:opacity-30 ml-2"
                        aria-label="Padam"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}

        {holidays.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">Tiada cuti umum.</p>
        )}
      </CardContent>
    </Card>
  );
}
