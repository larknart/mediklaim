"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <AlertTriangle className="w-10 h-10 text-red-500" />
      <div>
        <h2 className="text-lg font-semibold text-foreground">Ralat sistem</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {error.message || "Sesuatu tidak kena. Sila cuba semula."}
        </p>
      </div>
      <Button onClick={reset} variant="outline">
        Cuba semula
      </Button>
    </div>
  );
}
