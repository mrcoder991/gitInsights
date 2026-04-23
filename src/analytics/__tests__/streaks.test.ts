import { describe, expect, it } from 'vitest';

import { buildOffDayContext } from '../offDay';
import { currentStreak, longestStreak } from '../streaks';

function ctx(opts?: { pto?: string[]; workdays?: number[] }) {
  return buildOffDayContext({
    workweek: { workdays: opts?.workdays ?? [1, 2, 3, 4, 5] },
    pto: (opts?.pto ?? []).map((date) => ({ date })),
    holidays: { regions: [], overrides: [] },
    holidayDates: [],
  });
}

function counts(entries: Array<[string, number]>): Map<string, number> {
  return new Map(entries);
}

describe('currentStreak', () => {
  it('strict mode breaks on a missed weekend', () => {
    // today: 2026-04-23 (Thu). Weekend Apr 18-19 has no commits, so a strict
    // streak ends as we walk back through Sat/Sun.
    const byDate = counts([
      ['2026-04-23', 1],
      ['2026-04-22', 1],
      ['2026-04-21', 1],
      ['2026-04-20', 1],
      ['2026-04-17', 1], // Fri
    ]);
    const streak = currentStreak({
      byDate,
      ctx: ctx(),
      mode: 'strict',
      today: '2026-04-23',
    });
    expect(streak).toBe(4);
  });

  it('skip-non-workdays mode preserves streak across a quiet weekend', () => {
    const byDate = counts([
      ['2026-04-23', 1],
      ['2026-04-22', 1],
      ['2026-04-21', 1],
      ['2026-04-20', 1],
      ['2026-04-17', 1],
    ]);
    const streak = currentStreak({
      byDate,
      ctx: ctx(),
      mode: 'skip-non-workdays',
      today: '2026-04-23',
    });
    expect(streak).toBe(5);
  });

  it('PTO never breaks the streak in any mode', () => {
    const byDate = counts([
      ['2026-04-23', 1],
      ['2026-04-22', 1],
      ['2026-04-20', 1],
    ]);
    const streak = currentStreak({
      byDate,
      ctx: ctx({ pto: ['2026-04-21'] }),
      mode: 'strict',
      today: '2026-04-23',
    });
    expect(streak).toBe(3);
  });

  it('workdays-only ignores non-workday commits even when present', () => {
    const byDate = counts([
      ['2026-04-23', 1],
      ['2026-04-19', 5],
      ['2026-04-17', 1],
    ]);
    const streak = currentStreak({
      byDate,
      ctx: ctx(),
      mode: 'workdays-only',
      today: '2026-04-23',
    });
    expect(streak).toBe(1);
  });
});

describe('longestStreak', () => {
  it('returns the max evaluable run', () => {
    const byDate = counts([
      ['2026-04-13', 1],
      ['2026-04-14', 1],
      ['2026-04-15', 1],
      ['2026-04-16', 1],
      ['2026-04-17', 1],
      ['2026-04-20', 1],
      ['2026-04-21', 1],
    ]);
    const longest = longestStreak({
      byDate,
      ctx: ctx(),
      mode: 'skip-non-workdays',
      today: '2026-04-23',
    });
    expect(longest).toBe(7);
  });
});
