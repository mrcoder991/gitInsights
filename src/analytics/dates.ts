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

export function sundayWeekRange(date: Date): { from: Date; to: Date } {
  const d = startOfDay(date);
  const sunday = addDays(d, -d.getDay());
  const saturday = addDays(sunday, 6);
  return { from: sunday, to: saturday };
}

// Sunday-Saturday week key for user-facing weekly rollups. The week-year is
// based on the Saturday endpoint so the Dec/Jan bridge week stays one bucket.
export function sundayWeekKey(date: string | Date): string {
  const d = typeof date === 'string' ? parseIsoDate(date) : date;
  const range = sundayWeekRange(d);
  const weekYear = range.to.getFullYear();
  const firstWeekStart = sundayWeekRange(new Date(weekYear, 0, 1)).from;
  const week = Math.floor((range.from.getTime() - firstWeekStart.getTime()) / 86400000 / 7) + 1;
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
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

// --- User-facing calendar text (spec §10): lowercase month, 2-digit day ---
// With year: "feb 02, 2026". Without: "feb 02". With weekday: "mon, feb 02" / "mon, feb 02, 2026".

export const DISPLAY_MONTH_ABBR = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

export const DISPLAY_WEEKDAY_ABBR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local calendar date for display fields. ISO `YYYY-MM-DD` uses `parseIsoDate`; `Date` uses its local Y/M/D (no midnight shift). */
function displayCalendarDate(input: Date | string): Date {
  if (typeof input === 'string') return parseIsoDate(input);
  return new Date(input.getFullYear(), input.getMonth(), input.getDate());
}

/** e.g. feb 02 */
export function formatDisplayDayMonth(input: Date | string): string {
  const d = displayCalendarDate(input);
  return `${DISPLAY_MONTH_ABBR[d.getMonth()]} ${pad2(d.getDate())}`;
}

/** e.g. feb 02, 2026 */
export function formatDisplayDayMonthYear(input: Date | string): string {
  const d = displayCalendarDate(input);
  return `${DISPLAY_MONTH_ABBR[d.getMonth()]} ${pad2(d.getDate())}, ${d.getFullYear()}`;
}

/** e.g. mon, feb 02 */
export function formatDisplayWeekdayDayMonth(input: Date | string): string {
  const d = displayCalendarDate(input);
  const w = DISPLAY_WEEKDAY_ABBR[d.getDay()];
  return `${w}, ${formatDisplayDayMonth(d)}`;
}

/** e.g. mon, feb 02, 2026 */
export function formatDisplayWeekdayDayMonthYear(input: Date | string): string {
  const d = displayCalendarDate(input);
  const w = DISPLAY_WEEKDAY_ABBR[d.getDay()];
  return `${w}, ${formatDisplayDayMonth(d)}, ${d.getFullYear()}`;
}

/** e.g. may 2026 — month-only label (heatmap month row, timeframe month preset). */
export function formatDisplayMonthYear(year: number, monthIndex0: number): string {
  return `${DISPLAY_MONTH_ABBR[monthIndex0]} ${year}`;
}
