"use client";

import { useState } from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { ExportButton } from "@/components/export-button";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";

const MONTHS_BM = ["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ogos","Sep","Okt","Nov","Dis"];

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draf",
  SUBMITTED: "Menunggu Sokongan",
  HEAD_APPROVED: "Menunggu Kewangan",
  FINANCE_REVIEWED: "Menunggu Kelulusan",
  APPROVED: "Diluluskan",
  REJECTED: "Ditolak",
  PAID: "Dibayar",
  WITHDRAWN: "Tarik Balik",
};

export interface LaporanClaimItem {
  id: string;
  refNo: string;
  claimantName: string;
  departmentName: string | null;
  forMonth: number;
  forYear: number;
  status: string;
  totalClaimedMyr: number;
  totalApprovedMyr: number | null;
  resubmittedFromRefNo: string | null;
}

interface LaporanTableProps {
  claims: LaporanClaimItem[];
}

export function LaporanTable({ claims }: LaporanTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleAll() {
    if (selected.size === claims.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(claims.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {/* Selection toolbar — only shown when ≥1 row checked */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <span className="text-blue-700 font-medium">{selected.size} baris dipilih</span>
          <ExportButton getIds={() => [...selected]} />
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:text-blue-800 h-auto p-0"
            onClick={() => setSelected(new Set())}
          >
            Nyahpilih
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="p-3 w-10">
                <Checkbox
                  checked={claims.length > 0 && selected.size === claims.length}
                  onCheckedChange={toggleAll}
                  aria-label="Pilih semua"
                />
              </th>
              <th className="p-3 text-left">Ref No</th>
              <th className="p-3 text-left">Kakitangan</th>
              <th className="p-3 text-left">Jabatan</th>
              <th className="p-3 text-center">Bulan</th>
              <th className="p-3 text-right">Tuntut</th>
              <th className="p-3 text-right">Lulus</th>
              <th className="p-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {claims.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-400">
                  <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Tiada tuntutan untuk penapisan ini.</p>
                </td>
              </tr>
            ) : (
              claims.map((claim) => (
                <tr
                  key={claim.id}
                  className={`hover:bg-gray-50 ${selected.has(claim.id) ? "bg-blue-50" : ""}`}
                >
                  <td className="p-3">
                    <Checkbox
                      checked={selected.has(claim.id)}
                      onCheckedChange={() => toggleOne(claim.id)}
                    />
                  </td>
                  <td className="p-3">
                    <Link href={`/tuntutan/${claim.id}`} className="text-primary hover:underline font-medium">
                      {claim.refNo}
                    </Link>
                    {claim.resubmittedFromRefNo && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Rujukan asal: {claim.resubmittedFromRefNo} (Ditolak)
                      </p>
                    )}
                  </td>
                  <td className="p-3 text-gray-700">{claim.claimantName}</td>
                  <td className="p-3 text-gray-500">{claim.departmentName ?? "—"}</td>
                  <td className="p-3 text-center text-gray-500">
                    {MONTHS_BM[claim.forMonth - 1]} {claim.forYear}
                  </td>
                  <td className="p-3 text-right">RM {claim.totalClaimedMyr.toFixed(2)}</td>
                  <td className="p-3 text-right text-primary">
                    {claim.totalApprovedMyr != null
                      ? `RM ${claim.totalApprovedMyr.toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        claim.status === "APPROVED" || claim.status === "PAID"
                          ? "bg-primary/10 text-primary"
                          : claim.status === "REJECTED"
                          ? "bg-red-100 text-red-700"
                          : claim.status === "WITHDRAWN"
                          ? "bg-gray-100 text-gray-400 line-through"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {STATUS_LABELS[claim.status] ?? claim.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
