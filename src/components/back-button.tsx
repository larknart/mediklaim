"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export function BackButton({ label = "Kembali" }: { label?: string }) {
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 text-gray-500 hover:text-gray-800">
      <ChevronLeft className="w-4 h-4 mr-1" />
      {label}
    </Button>
  );
}
