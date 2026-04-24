import { describe, expect, it } from 'vitest';

import { buildOffDayContext, isOffDay, isWorkday } from '../offDay';

const monFri = { workdays: [1, 2, 3, 4, 5] };

function ctx(opts?: {
  pto?: string[];
  holidays?: string[];
  overrides?: string[];
  workdays?: number[];
}) {
  return buildOffDayContext({
    workweek: { workdays: opts?.workdays ?? monFri.workdays },
    pto: (opts?.pto ?? []).map((date) => ({ date })),
    holidays: { regions: [], overrides: (opts?.overrides ?? []).map((date) => ({ date, treatAs: 'workday' as const })) },
    holidayDates: opts?.holidays ?? [],
  });
}

describe('isWorkday', () => {
  it('respects the configured workweek', () => {
    expect(isWorkday('2026-01-05', new Set([1, 2, 3, 4, 5]))).toBe(true);
    expect(isWorkday('2026-01-03', new Set([1, 2, 3, 4, 5]))).toBe(false);
    expect(isWorkday('2026-01-04', new Set([0, 1, 2, 3, 4]))).toBe(true);
  });
});

describe('isOffDay', () => {
  it('returns true for PTO days regardless of weekday', () => {
    const c = ctx({ pto: ['2026-01-05'] });
    expect(isOffDay('2026-01-05', c)).toBe(true);
  });

  it('returns true for holidays unless overridden', () => {
    const cWith = ctx({ holidays: ['2026-12-25'] });
    expect(isOffDay('2026-12-25', cWith)).toBe(true);
    const cOverride = ctx({ holidays: ['2026-12-25'], overrides: ['2026-12-25'] });
    // 2026-12-25 is a Friday — workday; the override flips it back from
    // off-day to workday because it's not also a non-workday.
    expect(isOffDay('2026-12-25', cOverride)).toBe(false);
  });

  it('treats non-workdays as off-days', () => {
    const c = ctx();
    expect(isOffDay('2026-01-03', c)).toBe(true);
  });
});
