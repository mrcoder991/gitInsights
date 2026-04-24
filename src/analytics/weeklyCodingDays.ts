import { addDays, addDaysIso, isoWeekKey, isoYearWeekRange, startOfDay, toIsoDateKey } from './dates';
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
