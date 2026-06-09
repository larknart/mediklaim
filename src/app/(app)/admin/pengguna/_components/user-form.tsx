"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUser, resetUserPassword } from "@/server/actions/admin";
import { validatePasswordPolicy, type PasswordPolicy } from "@/lib/password-policy";
import { PasswordPolicyHints } from "@/components/password-policy-hints";
import { Role } from "@/generated/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ALL_ROLES: { value: Role; label: string }[] = [
  { value: Role.CLAIMANT, label: "Kakitangan (Claimant)" },
  { value: Role.HEAD, label: "Ketua Jabatan" },
  { value: Role.FINANCE, label: "Pegawai Kewangan" },
  { value: Role.APPROVER, label: "Setiausaha (Approver)" },
  { value: Role.YDP, label: "Yang Dipertua (YDP)" },
  { value: Role.ADMIN, label: "Admin Sistem" },
];

interface Department { id: string; name: string }

interface UserFormProps {
  departments: Department[];
  policy: PasswordPolicy;
  user?: {
    id: string;
    name: string;
    email: string;
    staffNo: string | null;
    phone: string | null;
    departmentId: string | null;
    isAhliMajlis: boolean;
    joinDate: string | null;
    roles: Role[];
  };
}

export function UserForm({ departments, policy, user }: UserFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [staffNo, setStaffNo] = useState(user?.staffNo ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState(user?.departmentId ?? "");
  const [isAhliMajlis, setIsAhliMajlis] = useState(user?.isAhliMajlis ?? false);
  const [joinDate, setJoinDate] = useState(user?.joinDate ?? "");
  const [roles, setRoles] = useState<Set<Role>>(new Set(user?.roles ?? [Role.CLAIMANT]));

  function toggleRole(role: Role) {
    setRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  function submit() {
    if (!name.trim() || !email.trim()) { setError("Nama dan email diperlukan."); return; }
    if (!user && !password.trim()) { setError("Password diperlukan untuk pengguna baru."); return; }
    if (roles.size === 0) { setError("Pilih sekurang-kurangnya satu peranan."); return; }
    const pwErr = password.trim() ? validatePasswordPolicy(password, policy) : null;
    if (pwErr) { setError(pwErr); return; }
    setError("");

    startTransition(async () => {
      try {
        if (user) {
          await updateUser(user.id, {
            name: name.trim(),
            phone: phone.trim() || undefined,
            departmentId: departmentId || null,
            roles: Array.from(roles),
            isAhliMajlis,
            joinDate: joinDate || null,
          });
          if (password.trim()) await resetUserPassword(user.id, password);
        } else {
          await createUser({
            email: email.trim(),
            name: name.trim(),
            staffNo: staffNo.trim() || undefined,
            phone: phone.trim() || undefined,
            password,
            departmentId: departmentId || undefined,
            roles: Array.from(roles),
            isAhliMajlis,
            joinDate: joinDate || undefined,
          });
        }
        router.push("/admin/pengguna");
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal simpan pengguna.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Nama Penuh</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama penuh..." />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@mds.gov.my"
              disabled={!!user}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">No. Staf</Label>
              <Input value={staffNo} onChange={(e) => setStaffNo(e.target.value)} placeholder="MDS-XXX-001" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">No. Telefon</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="60123456789" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">
              {user ? "Password Baru (kosongkan jika tak tukar)" : "Password"}
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {password && <PasswordPolicyHints policy={policy} password={password} />}
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Jabatan</Label>
            <Select value={departmentId} onValueChange={(v) => setDepartmentId(v ?? departmentId)}>
              <SelectTrigger>
                <span>{departments.find((d) => d.id === departmentId)?.name ?? "Pilih jabatan..."}</span>
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-gray-500 mb-2 block">Peranan</Label>
            <div className="space-y-2">
              {ALL_ROLES.map((r) => (
                <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={roles.has(r.value)}
                    onCheckedChange={() => toggleRole(r.value)}
                  />
                  <span className="text-sm">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Tarikh Mula Berkhidmat</Label>
            <Input
              type="date"
              value={joinDate}
              onChange={(e) => setJoinDate(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Digunakan untuk kira peruntukan pro-rata tahun pertama.</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={isAhliMajlis}
              onCheckedChange={(v) => setIsAhliMajlis(!!v)}
            />
            <div>
              <span className="text-sm font-medium">Ahli Majlis</span>
              <p className="text-xs text-gray-500">Tuntutan skip langkah sokongan Ketua Jabatan</p>
            </div>
          </label>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={submit}
          disabled={isPending}
          className="w-full"
        >
          {isPending ? "Menyimpan..." : user ? "Kemaskini Pengguna" : "Cipta Pengguna"}
        </Button>
      </CardContent>
    </Card>
  );
}
