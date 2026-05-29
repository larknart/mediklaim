"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/sidebar-context";

export function SidebarToggle() {
  const { toggle } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden mr-2 flex-shrink-0"
      onClick={toggle}
      aria-label="Buka menu"
    >
      <Menu className="w-5 h-5" />
    </Button>
  );
}
