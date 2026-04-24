// Pure date helpers shared across analytics. All inputs/outputs are in the
// user's local TZ; ISO date keys are `YYYY-MM-DD`.

export function toIsoDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

export function dayOfWeek(date: string | Date): number {
  const d = typeof date === 'string' ? parseIsoDate(date) : date;
  return d.getDay();
}

export function startOfDay(d: Date): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export function addDaysIso(date: string, days: number): string {
  return toIsoDateKey(addDays(parseIsoDate(date), days));
}

// ISO 8601 week year + week number (Mon-anchored).
export function isoWeekKey(date: string | Date): string {
  const d = typeof date === 'string' ? parseIsoDate(date) : new Date(date);
  d.setHours(0, 0, 0, 0);
  // Thursday in current week determines the year per ISO 8601.
  const dayNum = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayNum + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const diff = (d.getTime() - firstThursday.getTime()) / 86400000;
  const week = 1 + Math.round((diff - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function isoYearWeekRange(date: Date): { from: Date; to: Date } {
  const d = startOfDay(date);
  const dayNum = (d.getDay() + 6) % 7;
  const monday = addDays(d, -dayNum);
  const sunday = addDays(monday, 6);
  return { from: monday, to: sunday };
}

export function eachDay(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cursor = startOfDay(from);
  const end = startOfDay(to);
  while (cursor <= end) {
    out.push(toIsoDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
