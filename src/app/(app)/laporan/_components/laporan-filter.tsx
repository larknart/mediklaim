"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

const MONTHS_BM = ["Januari","Februari","Mac","April","Mei","Jun","Julai","Ogos","September","Oktober","November","Disember"];
const STATUSES = [
  { value: "", label: "Semua status" },
  { value: "SUBMITTED", label: "Menunggu Sokongan" },
  { value: "HEAD_APPROVED", label: "Menunggu Kewangan" },
  { value: "FINANCE_REVIEWED", label: "Menunggu Kelulusan" },
  { value: "APPROVED", label: "Diluluskan" },
  { value: "REJECTED", label: "Ditolak" },
  { value: "PAID", label: "Dibayar" },
];

interface LaporanFilterProps {
  currentYear: number;
  filterYear: number;
  filterMonth: number | null;
  filterStatus: string | null;
  filterDept: string | null;
  departments: { id: string; name: string }[];
}

export function LaporanFilter({
  currentYear,
  filterYear,
  filterMonth,
  filterStatus,
  filterDept,
  departments,
}: LaporanFilterProps) {
  const router = useRouter();

  function update(key: string, value: string | null) {
    const params = new URLSearchParams();
    const current: Record<string, string | null> = {
      year: String(filterYear),
      month: filterMonth ? String(filterMonth) : null,
      status: filterStatus,
      dept: filterDept,
      [key]: value,
    };
    for (const [k, v] of Object.entries(current)) {
      if (v) params.set(k, v);
    }
    router.push(`/laporan?${params}`);
  }

  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <Card>
      <CardContent className="p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select value={String(filterYear)} onValueChange={(v) => update("year", v ?? String(filterYear))}>
            <SelectTrigger className="text-sm">
              <span>{filterYear}</span>
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterMonth ? String(filterMonth) : ""}
            onValueChange={(v) => update("month", v || null)}
          >
            <SelectTrigger className="text-sm">
              <span>{filterMonth ? MONTHS_BM[filterMonth - 1] : "Semua bulan"}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua bulan</SelectItem>
              {MONTHS_BM.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterStatus ?? ""}
            onValueChange={(v) => update("status", v || null)}
          >
            <SelectTrigger className="text-sm">
              <span>{STATUSES.find((s) => s.value === (filterStatus ?? ""))?.label ?? "Semua status"}</span>
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterDept ?? ""}
            onValueChange={(v) => update("dept", v || null)}
          >
            <SelectTrigger className="text-sm">
              <span>{filterDept ? (departments.find((d) => d.id === filterDept)?.name ?? "Semua jabatan") : "Semua jabatan"}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua jabatan</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
