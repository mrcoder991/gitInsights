import { addDays, parseIsoDate, startOfDay, toIsoDateKey } from './dates';
import { type PresetId, type Timeframe } from '../userData/schema';

export { type Timeframe, type PresetId };

export const MAX_WINDOW_DAYS = 365;

export type ResolvedTimeframe = {
  from: Date;
  to: Date;
  label: string;
  clamped: boolean;
};

export class TimeframeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeframeError';
  }
}

const PRESET_DAYS: Record<PresetId, number> = {
  'last-week': 7,
  'last-30-days': 30,
  'last-3-months': 91,
  'last-6-months': 182,
  'last-year': 365,
};

export const PRESET_LABELS: Record<PresetId, string> = {
  'last-week': 'last week',
  'last-30-days': 'last 30 days',
  'last-3-months': 'last 3 months',
  'last-6-months': 'last 6 months',
  'last-year': 'last 12 months',
};

export const PRESET_SPAN_TAGS: Record<PresetId, string> = {
  'last-week': '7d',
  'last-30-days': '30d',
  'last-3-months': '~90d',
  'last-6-months': '~180d',
  'last-year': '365d',
};

const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function endOfDay(d: Date): Date {
  const next = new Date(d);
  next.setHours(23, 59, 59, 999);
  return next;
}

function formatShortDate(d: Date): string {
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

function applyClamp(from: Date, to: Date, label: string): ResolvedTimeframe {
  const spanDays = Math.round((to.getTime() - from.getTime()) / 86400000);
  if (spanDays > MAX_WINDOW_DAYS) {
    const clampedFrom = startOfDay(addDays(to, -MAX_WINDOW_DAYS));
    return { from: clampedFrom, to, label: `${label} (clamped to last 12 months)`, clamped: true };
  }
  return { from, to, label, clamped: false };
}

export function resolveTimeframe(tf: Timeframe, now: Date = new Date()): ResolvedTimeframe {
  const todayEnd = endOfDay(now);

  if (tf.kind === 'preset') {
    const days = PRESET_DAYS[tf.preset];
    const from = startOfDay(addDays(todayEnd, -days));
    return { from, to: todayEnd, label: PRESET_LABELS[tf.preset], clamped: false };
  }

  if (tf.kind === 'month') {
    const from = startOfDay(new Date(tf.year, tf.month - 1, 1));
    const lastOfMonth = new Date(tf.year, tf.month, 0);
    const to = endOfDay(new Date(Math.min(lastOfMonth.getTime(), todayEnd.getTime())));
    const label = `${MONTH_ABBR[tf.month - 1]} ${tf.year}`;

    if (from > now) throw new TimeframeError('month is in the future');
    return applyClamp(from, to, label);
  }

  if (tf.kind === 'quarter') {
    const startMonth = (tf.quarter - 1) * 3;
    const from = startOfDay(new Date(tf.year, startMonth, 1));
    const lastOfQuarter = new Date(tf.year, startMonth + 3, 0);
    const to = endOfDay(new Date(Math.min(lastOfQuarter.getTime(), todayEnd.getTime())));
    const label = `q${tf.quarter} ${tf.year}`;

    if (from > now) throw new TimeframeError('quarter is in the future');
    return applyClamp(from, to, label);
  }

  // custom
  const from = startOfDay(parseIsoDate(tf.from));
  const to = endOfDay(parseIsoDate(tf.to));

  if (to < from) throw new TimeframeError('to must be after from');
  if (from > now) throw new TimeframeError('from must not be in the future');

  const fromKey = toIsoDateKey(from);
  const toKey = toIsoDateKey(to);
  const label =
    fromKey === toKey
      ? fromKey
      : to.getFullYear() === from.getFullYear()
        ? `${formatShortDate(from)} – ${formatShortDate(to)}, ${from.getFullYear()}`
        : `${formatShortDate(from)}, ${from.getFullYear()} – ${formatShortDate(to)}, ${to.getFullYear()}`;

  return applyClamp(from, to, label);
}

export function windowSpanDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}
