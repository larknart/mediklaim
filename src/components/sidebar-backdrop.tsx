"use client";

import { useSidebar } from "@/components/sidebar-context";

export function SidebarBackdrop() {
  const { open, close } = useSidebar();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 md:hidden"
      onClick={close}
      aria-hidden="true"
    />
  );
}
