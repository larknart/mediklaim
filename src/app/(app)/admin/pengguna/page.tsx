import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserPlus } from "lucide-react";
import Link from "next/link";
import { UserActions } from "./_components/user-actions";
import { Pagination } from "@/components/ui/pagination";
import { PageHeader } from "@/components/page-header";

const ROLE_LABELS: Record<string, string> = {
  CLAIMANT: "Kakitangan",
  HEAD: "Ketua",
  FINANCE: "Kewangan",
  APPROVER: "Setiausaha",
  YDP: "YDP",
  ADMIN: "Admin",
};

const PAGE_SIZE = 30;

export default async function PenggunaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) redirect("/dashboard");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1"));

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      include: { roles: true, department: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengguna"
        subtitle={`${total} pengguna terdaftar`}
        actions={
          <Button asChild>
            <Link href="/admin/pengguna/baru">
              <UserPlus className="w-4 h-4 mr-2" />
              Tambah Pengguna
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Tiada pengguna berdaftar.</p>
            </div>
          ) : (
          <div className="divide-y">
            {users.map((user) => (
              <div key={user.id} className={`flex items-center gap-3 p-4 ${!user.isActive ? "opacity-50" : ""}`}>
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{user.name}</p>
                    {!user.isActive && <Badge variant="secondary">Tidak aktif</Badge>}
                    {user.isAhliMajlis && <Badge variant="outline" className="text-xs">Ahli Majlis</Badge>}
                  </div>
                  <p className="text-xs text-gray-500">{user.email}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {user.roles.map((r) => (
                      <span key={r.role} className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                        {ROLE_LABELS[r.role] ?? r.role}
                      </span>
                    ))}
                    {user.department && (
                      <span className="text-xs text-gray-400">· {user.department.name}</span>
                    )}
                  </div>
                </div>
                <UserActions userId={user.id} isActive={user.isActive} />
              </div>
            ))}
          </div>
          )}
        </CardContent>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={(p) => `?page=${p}`}
      />
    </div>
  );
}
