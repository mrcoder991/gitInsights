import { dayOfWeek } from './dates';
import type { HolidaysConfig, PtoEntry, Workweek } from '../userData/schema';

// Single source of truth for "the user was not expected to work on this date"
// (spec §6 PTO + Public Holidays). Every metric MUST funnel through this fn.

export type OffDayContext = {
  workdays: ReadonlySet<number>;
  ptoSet: ReadonlySet<string>;
  holidaySet: ReadonlySet<string>;
  overrideSet: ReadonlySet<string>;
};

export function isWorkday(date: string | Date, workdays: ReadonlySet<number>): boolean {
  return workdays.has(dayOfWeek(date));
}

export function isOffDay(date: string, ctx: OffDayContext): boolean {
  if (ctx.ptoSet.has(date)) return true;
  if (ctx.holidaySet.has(date) && !ctx.overrideSet.has(date)) return true;
  if (!isWorkday(date, ctx.workdays)) return true;
  return false;
}

export function isPtoDay(date: string, ctx: OffDayContext): boolean {
  return ctx.ptoSet.has(date);
}

export function isHolidayDay(date: string, ctx: OffDayContext): boolean {
  return ctx.holidaySet.has(date) && !ctx.overrideSet.has(date);
}

export function buildOffDayContext(args: {
  workweek: Workweek;
  pto: PtoEntry[];
  holidays: HolidaysConfig;
  holidayDates: Iterable<string>;
}): OffDayContext {
  return {
    workdays: new Set(args.workweek.workdays),
    ptoSet: new Set(args.pto.map((p) => p.date)),
    holidaySet: new Set(args.holidayDates),
    overrideSet: new Set(args.holidays.overrides.map((o) => o.date)),
  };
}
