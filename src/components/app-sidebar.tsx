"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import { Role } from "@/generated/prisma";
import { useSidebar } from "@/components/sidebar-context";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  CheckSquare,
  Calculator,
  Shield,
  BarChart3,
  LineChart,
  Users,
  Settings,
  ScrollText,
  Bell,
  LogOut,
  Building2,
  CalendarRange,
  UserCircle,
  MessageSquare,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
  badge?: number;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Papan Pemuka", icon: LayoutDashboard },
  { href: "/resit", label: "Resit Saya", icon: FileText },
  { href: "/tuntutan", label: "Tuntutan Saya", icon: ClipboardList },
  {
    href: "/sokongan",
    label: "Sokongan",
    icon: CheckSquare,
    roles: [Role.HEAD],
  },
  {
    href: "/semakan",
    label: "Semakan Kewangan",
    icon: Calculator,
    roles: [Role.FINANCE],
  },
  {
    href: "/kelulusan",
    label: "Kelulusan",
    icon: Shield,
    roles: [Role.APPROVER, Role.YDP],
  },
  {
    href: "/laporan",
    label: "Laporan",
    icon: BarChart3,
    roles: [Role.FINANCE, Role.APPROVER, Role.YDP, Role.ADMIN],
  },
  {
    href: "/analitik",
    label: "Analitik",
    icon: LineChart,
    roles: [Role.HEAD, Role.FINANCE, Role.APPROVER, Role.YDP, Role.ADMIN],
  },
  {
    href: "/notifikasi",
    label: "Notifikasi",
    icon: Bell,
  },
  {
    href: "/admin/pengguna",
    label: "Pengguna",
    icon: Users,
    roles: [Role.ADMIN],
  },
  {
    href: "/admin/peruntukan",
    label: "Peruntukan",
    icon: Wallet,
    roles: [Role.ADMIN],
  },
  {
    href: "/admin/jabatan",
    label: "Jabatan",
    icon: Building2,
    roles: [Role.ADMIN],
  },
  {
    href: "/admin/tetapan",
    label: "Tetapan",
    icon: Settings,
    roles: [Role.ADMIN],
  },
  {
    href: "/admin/delegasi",
    label: "Delegasi",
    icon: CalendarRange,
    roles: [Role.ADMIN],
  },
  {
    href: "/admin/audit",
    label: "Log Audit",
    icon: ScrollText,
    roles: [Role.ADMIN],
  },
  {
    href: "/admin/whatsapp",
    label: "Outbox WA",
    icon: MessageSquare,
    roles: [Role.ADMIN],
  },
];

export function AppSidebar({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRoles = session?.user?.roles ?? [];
  const { open, close } = useSidebar();

  // Close drawer on navigation (mobile)
  useEffect(() => {
    close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.some((r) => userRoles.includes(r))
  );

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 h-screen w-64 max-w-64 bg-sidebar text-sidebar-foreground flex flex-col z-50",
        "transition-transform duration-200",
        "-translate-x-full md:translate-x-0",
        open && "translate-x-0"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        {/* Replace src="/mds-logo-mark.png" once asset is placed in /public */}
        <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center flex-shrink-0">
          <span className="text-primary-foreground font-bold text-[10px] leading-none tracking-tight">
            MDS
          </span>
        </div>
        <div>
          <p className="font-bold text-sm leading-tight text-sidebar-primary-foreground">
            MediKlaim MDS
          </p>
          <p className="text-sidebar-foreground/60 text-xs">Majlis Daerah Setiu</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const badge = item.href === "/notifikasi" ? unreadCount : (item.badge ?? 0);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {badge > 0 && (
                <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-xs">
                  {badge > 99 ? "99+" : badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-sidebar-primary-foreground truncate">
            {session?.user?.name}
          </p>
          <p className="text-xs text-sidebar-foreground/60 truncate">
            {session?.user?.email}
          </p>
        </div>
        <Link
          href="/profil"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors mb-1"
        >
          <UserCircle className="w-4 h-4 shrink-0" />
          Profil &amp; Kata Laluan
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Keluar
        </Button>
      </div>
    </aside>
  );
}
