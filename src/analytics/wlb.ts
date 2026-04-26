import { isOffDay, isPtoDay, type OffDayContext } from './offDay';
import { longestBreakDays, longestStreak } from './streaks';
import type { StreakMode } from '../userData/schema';

// Spec §6 WLB Audit. Pure rollup; off-days are stripped from
// `LateNightRatio` / `NonWorkdayRatio` denominators so a single vacation
// hotfix doesn't skew the trend.

export type WlbCommitInput = {
  authoredAt: string;
};

export type WlbResult = {
  totalCommits: number;
  offDayCommits: number;
  evaluableCommits: number;
  lateNightRatio: number;
  nonWorkdayRatio: number;
  hourHistogram: number[];
  longestStreakDays: number;
  longestBreakDays: number;
  ptoDaysTaken: number;
  ptoDaysWithCommits: number;
  ptoHonoredRatio: number | null;
  ptoViolationCount: number;
};

function authoredDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function authoredHour(iso: string): number {
  return new Date(iso).getHours();
}

function authoredDayOfWeek(iso: string): number {
  return new Date(iso).getDay();
}

export function wlbAudit(args: {
  commits: WlbCommitInput[];
  byDate: ReadonlyMap<string, number>;
  ctx: OffDayContext;
  streakMode: StreakMode;
}): WlbResult {
  const histogram = new Array<number>(24).fill(0);
  let totalCommits = 0;
  let offDayCommits = 0;
  let evaluable = 0;
  let lateNight = 0;
  let nonWorkday = 0;

  for (const c of args.commits) {
    totalCommits += 1;
    const dayKey = authoredDateKey(c.authoredAt);
    const hour = authoredHour(c.authoredAt);
    histogram[hour] = (histogram[hour] ?? 0) + 1;
    const off = isOffDay(dayKey, args.ctx);
    if (off) {
      offDayCommits += 1;
      continue;
    }
    evaluable += 1;
    if (hour >= 22 || hour < 6) lateNight += 1;
    if (!args.ctx.workdays.has(authoredDayOfWeek(c.authoredAt))) nonWorkday += 1;
  }

  let ptoDaysTaken = 0;
  let ptoDaysWithCommits = 0;
  for (const date of args.ctx.ptoSet) {
    ptoDaysTaken += 1;
    if ((args.byDate.get(date) ?? 0) > 0) ptoDaysWithCommits += 1;
  }
  const ptoHonoredRatio =
    ptoDaysTaken === 0 ? null : (ptoDaysTaken - ptoDaysWithCommits)/ptoDaysTaken;

  return {
    totalCommits,
    offDayCommits,
    evaluableCommits: evaluable,
    lateNightRatio: evaluable === 0 ? 0 : lateNight / evaluable,
    nonWorkdayRatio: evaluable === 0 ? 0 : nonWorkday / evaluable,
    hourHistogram: histogram,
    longestStreakDays: longestStreak({
      byDate: args.byDate,
      ctx: args.ctx,
      mode: args.streakMode,
    }),
    longestBreakDays: longestBreakDays({ byDate: args.byDate, ctx: args.ctx }),
    ptoDaysTaken,
    ptoDaysWithCommits,
    ptoHonoredRatio,
    ptoViolationCount: ptoDaysWithCommits,
  };
}

export { isPtoDay };
