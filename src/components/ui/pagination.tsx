import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  /** Returns the URL for a given page number. */
  buildHref: (page: number) => string;
  className?: string;
}

/**
 * Server-safe pagination bar with Button-styled prev/next links.
 * Disabled states render as inert <span> elements (not clickable).
 * Returns null when totalPages ≤ 1.
 */
export function Pagination({
  page,
  totalPages,
  buildHref,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  const disabledCls =
    "inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md opacity-40 cursor-not-allowed select-none bg-background text-muted-foreground";

  return (
    <div
      className={cn(
        "flex items-center justify-between text-sm",
        className
      )}
    >
      <span className="text-muted-foreground">
        Halaman {page} / {totalPages}
      </span>
      <div className="flex gap-2">
        {prevDisabled ? (
          <span className={disabledCls} aria-disabled="true">
            <ChevronLeft className="w-4 h-4" />
            Sebelum
          </span>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
              Sebelum
            </Link>
          </Button>
        )}
        {nextDisabled ? (
          <span className={disabledCls} aria-disabled="true">
            Seterusnya
            <ChevronRight className="w-4 h-4" />
          </span>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(page + 1)}>
              Seterusnya
              <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
