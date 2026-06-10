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
import { Trash2, Plus, CalendarRange } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
        toast.success("Delegasi berjaya dicipta.");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Gagal cipta delegasi.";
        if (msg === "SAME_USER") setError("Delegator dan penolong tidak boleh sama.");
        else if (msg === "INVALID_DATE_RANGE") setError("Tarikh tamat mesti selepas tarikh mula.");
        else setError(msg);
      }
    });
  }

  function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startTransition(async () => {
      await deleteDelegation(id);
      router.refresh();
      toast.success("Delegasi berjaya dipadam.");
    });
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {delegations.length} rekod delegasi
        </p>
        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className=""
        >
          <Plus className="w-4 h-4 mr-1" />
          Tambah Delegasi
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Delegasi Baru</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Delegator (yang cuti)</Label>
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
                <Label className="text-xs text-muted-foreground mb-1.5 block">Penolong (yang cover)</Label>
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
              <Label className="text-xs text-muted-foreground mb-1.5 block">Peranan yang didelegasi</Label>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Tarikh Mula</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} min={today} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Tarikh Tamat</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} min={fromDate || today} />
              </div>
            </div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setError(""); }}>
                Batal
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={isPending} className="">
                {isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {delegations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Tiada rekod delegasi.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {delegations.map((d) => (
            <Card key={d.id} className={d.isActive ? "border-primary/20" : ""}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <CalendarRange className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {d.delegatorName}
                      <span className="text-muted-foreground font-normal mx-1">→</span>
                      {d.delegateName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_LABELS[d.role] ?? d.role} · {d.fromDate} – {d.toDate}
                    </p>
                  </div>
                  {d.isActive && (
                    <Badge className="bg-primary/10 text-primary text-xs shrink-0">Aktif</Badge>
                  )}
                  <button
                    onClick={() => setDeleteId(d.id)}
                    disabled={isPending}
                    className="text-muted-foreground/50 hover:text-destructive disabled:opacity-30 shrink-0"
                    aria-label="Padam delegasi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Padam delegasi?</AlertDialogTitle>
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
