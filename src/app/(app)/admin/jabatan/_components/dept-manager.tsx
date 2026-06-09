"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDepartment, updateDepartment, deleteDepartment } from "@/server/actions/admin";
import { Card, CardContent } from "@/components/ui/card";
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
import { Building2, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Dept { id: string; name: string; headId: string | null; headName: string | null; memberCount: number }
interface User { id: string; name: string; email: string }

export function DeptManager({ departments, users }: { departments: Dept[]; users: User[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string; headId: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function add() {
    if (!newName.trim()) return;
    setError("");
    startTransition(async () => {
      try {
        await createDepartment(newName.trim());
        setNewName("");
        router.refresh();
        toast.success("Jabatan berjaya ditambah.");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal cipta jabatan.");
      }
    });
  }

  function saveEdit() {
    if (!editing) return;
    startTransition(async () => {
      try {
        await updateDepartment(editing.id, { name: editing.name, headId: editing.headId || null });
        setEditing(null);
        router.refresh();
        toast.success("Jabatan berjaya dikemaskini.");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal kemaskini.");
      }
    });
  }

  function remove(id: string, count: number) {
    if (count > 0) { setError("Pindahkan semua ahli jabatan dahulu."); return; }
    setDeleteId(id);
  }

  function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startTransition(async () => {
      try {
        await deleteDepartment(id);
        router.refresh();
        toast.success("Jabatan berjaya dipadam.");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal padam.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nama jabatan baru..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button onClick={add} disabled={isPending || !newName.trim()} className="">
              <Plus className="w-4 h-4 mr-1" />
              Tambah
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          {departments.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Tiada jabatan.</p>
            </div>
          ) : (
            <div className="divide-y">
              {departments.map((dept) => (
                <div key={dept.id} className="p-4">
                  {editing?.id === dept.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        className="text-sm"
                      />
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Ketua Jabatan</Label>
                        <Select value={editing.headId} onValueChange={(v) => setEditing({ ...editing, headId: v ?? "" })}>
                          <SelectTrigger className="text-sm">
                            <span>{users.find((u) => u.id === editing.headId)?.name ?? "Pilih ketua..."}</span>
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit} disabled={isPending} className="">
                          <Check className="w-3 h-3 mr-1" />Simpan
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                          <X className="w-3 h-3 mr-1" />Batal
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{dept.name}</p>
                        <p className="text-xs text-gray-500">
                          Ketua: {dept.headName ?? "Belum ditetapkan"} · {dept.memberCount} ahli
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit jabatan"
                          onClick={() => setEditing({ id: dept.id, name: dept.name, headId: dept.headId ?? "" })}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Padam jabatan"
                          onClick={() => remove(dept.id, dept.memberCount)}
                          disabled={isPending}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Padam jabatan?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak boleh dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Padam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
