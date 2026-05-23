"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDelegation, deleteDelegation } from "@/server/actions/admin";
import { Role } from "@/generated/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, Plus, CalendarRange } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const DELEGATABLE_ROLES: { value: Role; label: string }[] = [
  { value: Role.HEAD, label: "Ketua Jabatan" },
  { value: Role.FINANCE, label: "Pegawai Kewangan" },
  { value: Role.APPROVER, label: "Setiausaha" },
  { value: Role.YDP, label: "Yang Dipertua" },
];

const ROLE_LABELS: Record<string, string> = {
  HEAD: "Ketua Jabatan",
  FINANCE: "Kewangan",
  APPROVER: "Setiausaha",
  YDP: "YDP",
};

export interface DelegationRow {
  id: string;
  delegatorName: string;
  delegateName: string;
  role: string;
  fromDate: string;
  toDate: string;
  isActive: boolean;
}

export interface UserOption {
  id: string;
  name: string;
  roles: string[];
}

interface Props {
  delegations: DelegationRow[];
  users: UserOption[];
}

export function DelegationList({ delegations, users }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [delegatorId, setDelegatorId] = useState("");
  const [delegateId, setDelegateId] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  function handleCreate() {
    if (!delegatorId || !delegateId || !role || !fromDate || !toDate) {
      setError("Semua medan diperlukan.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await createDelegation({ delegatorId, delegateId, role: role as Role, fromDate, toDate });
        setShowForm(false);
        setDelegatorId(""); setDelegateId(""); setRole(""); setFromDate(""); setToDate("");
        router.refresh();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Gagal cipta delegasi.";
        if (msg === "SAME_USER") setError("Delegator dan penolong tidak boleh sama.");
        else if (msg === "INVALID_DATE_RANGE") setError("Tarikh tamat mesti selepas tarikh mula.");
        else setError(msg);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteDelegation(id);
      router.refresh();
    });
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {delegations.length} rekod delegasi
        </p>
        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="bg-green-700 hover:bg-green-800"
        >
          <Plus className="w-4 h-4 mr-1" />
          Tambah Delegasi
        </Button>
      </div>

      {showForm && (
        <Card className="border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Delegasi Baru</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Delegator (yang cuti)</Label>
                <Select value={delegatorId} onValueChange={(v) => setDelegatorId(v ?? delegatorId)}>
                  <SelectTrigger>
                    <span className="truncate">{users.find((u) => u.id === delegatorId)?.name ?? "Pilih pengguna..."}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Penolong (yang cover)</Label>
                <Select value={delegateId} onValueChange={(v) => setDelegateId(v ?? delegateId)}>
                  <SelectTrigger>
                    <span className="truncate">{users.find((u) => u.id === delegateId)?.name ?? "Pilih pengguna..."}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Peranan yang didelegasi</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <span>{DELEGATABLE_ROLES.find((r) => r.value === role)?.label ?? "Pilih peranan..."}</span>
                </SelectTrigger>
                <SelectContent>
                  {DELEGATABLE_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Tarikh Mula</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} min={today} />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Tarikh Tamat</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} min={fromDate || today} />
              </div>
            </div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setError(""); }}>
                Batal
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={isPending} className="bg-green-700 hover:bg-green-800">
                {isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {delegations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-gray-400">
            Tiada rekod delegasi.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {delegations.map((d) => (
            <Card key={d.id} className={d.isActive ? "border-green-200" : ""}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <CalendarRange className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {d.delegatorName}
                      <span className="text-gray-400 font-normal mx-1">→</span>
                      {d.delegateName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {ROLE_LABELS[d.role] ?? d.role} · {d.fromDate} – {d.toDate}
                    </p>
                  </div>
                  {d.isActive && (
                    <Badge className="bg-green-100 text-green-700 text-xs shrink-0">Aktif</Badge>
                  )}
                  <button
                    onClick={() => handleDelete(d.id)}
                    disabled={isPending}
                    className="text-gray-300 hover:text-red-400 disabled:opacity-30 shrink-0"
                    aria-label="Padam"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
