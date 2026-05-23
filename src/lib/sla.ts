import { countWorkingDays, addWorkingDays } from "@/lib/working-days";

export type SlaStatus = "OK" | "WARNING" | "OVERDUE";

export interface SlaInfo {
  status: SlaStatus;
  elapsed: number;
  target: number;
  deadline: Date;
}

export function computeSla(
  stepStartedAt: Date,
  targetDays: number,
  holidays: Set<string>
): SlaInfo {
  const now = new Date();
  const elapsed = countWorkingDays(stepStartedAt, now, holidays);
  const deadline = addWorkingDays(stepStartedAt, targetDays, holidays);

  let status: SlaStatus;
  if (elapsed >= targetDays) {
    status = "OVERDUE";
  } else if (elapsed >= Math.ceil(targetDays * 0.75)) {
    status = "WARNING";
  } else {
    status = "OK";
  }

  return { status, elapsed, target: targetDays, deadline };
}
