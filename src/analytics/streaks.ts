import { addDaysIso, toIsoDateKey } from './dates';
import { isHolidayDay, isOffDay, isPtoDay, isWorkday, type OffDayContext } from './offDay';
import type { StreakMode } from '../userData/schema';

// Spec §6 Streak Modes. PTO + Public Holiday always skip (they never extend
// or break a streak in any mode). Non-workday handling is mode-specific:
//   - strict: non-workdays count and can break the streak.
//   - skip-non-workdays: non-workdays skip.
//   - workdays-only: non-workdays skip and non-workday commits don't count.

export type StreakArgs = {
  byDate: ReadonlyMap<string, number>;
  ctx: OffDayContext;
  mode: StreakMode;
  today?: string;
};

function isPtoOrHoliday(date: string, ctx: OffDayContext): boolean {
  return isPtoDay(date, ctx) || isHolidayDay(date, ctx);
}

function dayShouldCount(date: string, ctx: OffDayContext, mode: StreakMode): 'eval' | 'skip' {
  if (isPtoOrHoliday(date, ctx)) return 'skip';
  if (mode === 'strict') return 'eval';
  if (!isWorkday(date, ctx.workdays)) return 'skip';
  return 'eval';
}

export function currentStreak(args: StreakArgs): number {
  const today = args.today ?? toIsoDateKey(new Date());
  let streak = 0;
  let cursor = today;
  let safety = 366 * 5;
  while (safety-- > 0) {
    const verdict = dayShouldCount(cursor, args.ctx, args.mode);
    if (verdict === 'skip') {
      cursor = addDaysIso(cursor, -1);
      continue;
    }
    const count = args.byDate.get(cursor) ?? 0;
    if (count <= 0) break;
    streak += 1;
    cursor = addDaysIso(cursor, -1);
  }
  return streak;
}

export function longestStreak(args: StreakArgs): number {
  const today = args.today ?? toIsoDateKey(new Date());
  const dates = [...args.byDate.keys()].filter((d) => d <= today).sort();
  if (dates.length === 0) return 0;
  let best = 0;
  let current = 0;
  let cursor = dates[0]!;
  const end = today;
  let safety = 366 * 25;
  while (cursor <= end && safety-- > 0) {
    const verdict = dayShouldCount(cursor, args.ctx, args.mode);
    if (verdict === 'eval') {
      const count = args.byDate.get(cursor) ?? 0;
      if (count > 0) {
        current += 1;
        if (current > best) best = current;
      } else {
        current = 0;
      }
    }
    cursor = addDaysIso(cursor, 1);
  }
  return best;
}

export function longestBreakDays(args: Omit<StreakArgs, 'mode'>): number {
  const today = args.today ?? toIsoDateKey(new Date());
  const dates = [...args.byDate.keys()].filter((d) => d <= today).sort();
  if (dates.length === 0) return 0;
  let best = 0;
  let current = 0;
  let cursor = dates[0]!;
  let safety = 366 * 25;
  while (cursor <= today && safety-- > 0) {
    if (isOffDay(cursor, args.ctx)) {
      cursor = addDaysIso(cursor, 1);
      continue;
    }
    const count = args.byDate.get(cursor) ?? 0;
    if (count > 0) {
      current = 0;
    } else {
      current += 1;
      if (current > best) best = current;
    }
    cursor = addDaysIso(cursor, 1);
  }
  return best;
}
