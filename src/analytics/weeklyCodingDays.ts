import { addDays, addDaysIso, isoWeekKey, isoYearWeekRange, startOfDay, toIsoDateKey } from './dates';
import { windowSpanDays } from './timeframe';
import { isOffDay, type OffDayContext } from './offDay';

// Spec §6 Weekly Coding Days. ISO week, Monday-anchored. Off-days are removed
// from numerator AND denominator: a Mon-Fri user with a PTO day is judged on
// 4 expected days, not 5.

export type WeeklyBucket = {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  expected: number;
  active: number;
};

export function weeklyCodingDays(args: {
  byDate: ReadonlyMap<string, number>;
  ctx: OffDayContext;
  from: Date;
  to: Date;
}): WeeklyBucket[] {
  const buckets = new Map<string, WeeklyBucket>();
  const cursor = startOfDay(args.from);
  const end = startOfDay(args.to);
  while (cursor <= end) {
    const date = toIsoDateKey(cursor);
    const off = isOffDay(date, args.ctx);
    const weekKey = isoWeekKey(cursor);
    if (!buckets.has(weekKey)) {
      const range = isoYearWeekRange(cursor);
      buckets.set(weekKey, {
        weekKey,
        weekStart: toIsoDateKey(range.from),
        weekEnd: toIsoDateKey(range.to),
        expected: 0,
        active: 0,
      });
    }
    const bucket = buckets.get(weekKey)!;
    if (!off) {
      bucket.expected += 1;
      if ((args.byDate.get(date) ?? 0) > 0) bucket.active += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return [...buckets.values()].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

export function bestWeek(buckets: WeeklyBucket[]): WeeklyBucket | null {
  let best: WeeklyBucket | null = null;
  for (const b of buckets) {
    if (!best || b.active > best.active) best = b;
  }
  return best;
}

export function currentAndPrevWeek(
  args: { byDate: ReadonlyMap<string, number>; ctx: OffDayContext; today?: Date },
): { current: WeeklyBucket | null; previous: WeeklyBucket | null } {
  const today = args.today ?? new Date();
  const range = isoYearWeekRange(today);
  const prevRange = { from: addDays(range.from, -7), to: addDays(range.to, -7) };
  const all = weeklyCodingDays({
    byDate: args.byDate,
    ctx: args.ctx,
    from: prevRange.from,
    to: range.to,
  });
  const current = all.find((b) => b.weekStart === toIsoDateKey(range.from)) ?? null;
  const previous = all.find((b) => b.weekStart === toIsoDateKey(prevRange.from)) ?? null;
  return { current, previous };
}

export function trailingTwelveWeeks(args: {
  byDate: ReadonlyMap<string, number>;
  ctx: OffDayContext;
  today?: Date;
}): WeeklyBucket[] {
  const today = args.today ?? new Date();
  const range = isoYearWeekRange(today);
  const from = addDays(range.from, -7 * 11);
  return weeklyCodingDays({ byDate: args.byDate, ctx: args.ctx, from, to: range.to });
}

export { addDaysIso };

// Spec §6 Weekly Coding Days — timeframe-aware histogram bucketing.

const DAYS_12_WEEKS = 84;
const DAYS_6_MONTHS = 182;

export type HistogramBucket = {
  label: string;
  from: string;
  to: string;
  meanRatio: number;
  weekCount: number;
  totalActive: number;
  totalExpected: number;
  isRest: boolean;
  isPartial: boolean;
  bestWeek: WeeklyBucket | null;
  worstWeek: WeeklyBucket | null;
};

function bucketMeanRatio(weeks: WeeklyBucket[]): number {
  const totalExpected = weeks.reduce((s, w) => s + w.expected, 0);
  if (totalExpected === 0) return 0;
  const totalActive = weeks.reduce((s, w) => s + w.active, 0);
  return totalActive / totalExpected;
}

function bestAndWorst(weeks: WeeklyBucket[]): { best: WeeklyBucket | null; worst: WeeklyBucket | null } {
  const active = weeks.filter((w) => w.expected > 0);
  if (active.length === 0) return { best: null, worst: null };
  let best = active[0]!;
  let worst = active[0]!;
  for (const w of active) {
    const r = w.expected > 0 ? w.active / w.expected : 0;
    const rb = best.expected > 0 ? best.active / best.expected : 0;
    const rw = worst.expected > 0 ? worst.active / worst.expected : 0;
    if (r > rb) best = w;
    if (r < rw) worst = w;
  }
  return { best, worst };
}

const MONTH_ABBR_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function formatShortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return `${MONTH_ABBR_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function weeksToBucket(weeks: WeeklyBucket[], label: string, isPartial = false): HistogramBucket {
  const { best, worst } = bestAndWorst(weeks);
  const totalExpected = weeks.reduce((s, w) => s + w.expected, 0);
  const totalActive = weeks.reduce((s, w) => s + w.active, 0);
  return {
    label,
    from: weeks[0]!.weekStart,
    to: weeks[weeks.length - 1]!.weekEnd,
    meanRatio: bucketMeanRatio(weeks),
    weekCount: weeks.length,
    totalActive,
    totalExpected,
    isRest: totalExpected === 0,
    isPartial,
    bestWeek: best,
    worstWeek: worst,
  };
}

function perWeekBuckets(weeks: WeeklyBucket[]): HistogramBucket[] {
  return weeks.map((w) => ({
    label: `w${w.weekKey.split('-W')[1] ?? '??'}`,
    from: w.weekStart,
    to: w.weekEnd,
    meanRatio: w.expected > 0 ? w.active / w.expected : 0,
    weekCount: 1,
    totalActive: w.active,
    totalExpected: w.expected,
    isRest: w.expected === 0,
    isPartial: false,
    bestWeek: w.expected > 0 ? w : null,
    worstWeek: w.expected > 0 ? w : null,
  }));
}

function pairsBuckets(weeks: WeeklyBucket[]): HistogramBucket[] {
  const buckets: HistogramBucket[] = [];
  for (let i = 0; i < weeks.length; i += 2) {
    const pair = weeks.slice(i, i + 2);
    const isPartial = pair.length === 1;
    const start = pair[0]!.weekStart;
    const end = pair[pair.length - 1]!.weekEnd;
    const label =
      start.slice(0, 7) === end.slice(0, 7)
        ? `${formatShortDate(start)} – ${formatShortDate(end)}`
        : `${formatShortDate(start)} – ${formatShortDate(end)}`;
    buckets.push(weeksToBucket(pair, label, isPartial));
  }
  return buckets;
}

function monthlyBuckets(weeks: WeeklyBucket[]): HistogramBucket[] {
  const byMonth = new Map<string, WeeklyBucket[]>();
  for (const w of weeks) {
    const key = w.weekStart.slice(0, 7);
    const group = byMonth.get(key) ?? [];
    group.push(w);
    byMonth.set(key, group);
  }
  return [...byMonth.entries()].map(([key, group]) => {
    const [year, monthStr] = key.split('-');
    const month = parseInt(monthStr ?? '1', 10) - 1;
    const label = `${MONTH_ABBR_SHORT[month]} ${year ?? ''}`.trim();
    return weeksToBucket(group, label);
  });
}

export function bucketWeeklyCodingDays(weeks: WeeklyBucket[], from: Date, to: Date): HistogramBucket[] {
  if (weeks.length === 0) return [];

  const span = windowSpanDays(from, to);

  if (span <= DAYS_12_WEEKS) {
    return perWeekBuckets(weeks);
  }

  if (span <= DAYS_6_MONTHS) {
    return pairsBuckets(weeks);
  }

  return monthlyBuckets(weeks);
}
