// Terengganu weekend: Friday (5) + Saturday (6)
// Working days: Sunday (0), Monday (1), Tuesday (2), Wednesday (3), Thursday (4)

export function isWorkingDay(date: Date, holidays: Set<string>): boolean {
  const dow = date.getDay();
  if (dow === 5 || dow === 6) return false;
  const iso = date.toISOString().split("T")[0];
  if (holidays.has(iso)) return false;
  return true;
}

export function countWorkingDays(from: Date, to: Date, holidays: Set<string>): number {
  let count = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur < end) {
    if (isWorkingDay(cur, holidays)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function addWorkingDays(from: Date, days: number, holidays: Set<string>): Date {
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  let remaining = days;
  while (remaining > 0) {
    cur.setDate(cur.getDate() + 1);
    if (isWorkingDay(cur, holidays)) remaining--;
  }
  return cur;
}
