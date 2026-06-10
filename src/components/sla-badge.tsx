import type { SlaInfo } from "@/lib/sla";

const STEP_BM: Record<string, string> = {
  HEAD: "Sokongan",
  FINANCE: "Kewangan",
  APPROVER: "Kelulusan",
};

export function SlaBadge({ step, sla }: { step: string; sla: SlaInfo }) {
  const label =
    sla.status === "OVERDUE"
      ? `Lewat ${sla.elapsed - sla.target} hari`
      : `${sla.elapsed}/${sla.target} hari`;

  const colorClass =
    sla.status === "OVERDUE"
      ? "bg-destructive/20 text-destructive"
      : sla.status === "WARNING"
      ? "bg-amber-100 text-amber-700"
      : "bg-muted text-muted-foreground";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {STEP_BM[step] ?? step}: {label}
    </span>
  );
}
