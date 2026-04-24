import { describe, expect, it } from 'vitest';

import { buildOffDayContext } from '../offDay';
import { wlbAudit } from '../wlb';

function ctx(opts?: { pto?: string[]; workdays?: number[] }) {
  return buildOffDayContext({
    workweek: { workdays: opts?.workdays ?? [1, 2, 3, 4, 5] },
    pto: (opts?.pto ?? []).map((date) => ({ date })),
    holidays: { regions: [], overrides: [] },
    holidayDates: [],
  });
}

describe('wlbAudit', () => {
  it('excludes off-day commits from the late-night ratio denominator', () => {
    const result = wlbAudit({
      commits: [
        { authoredAt: '2026-04-22T23:00:00' },
        { authoredAt: '2026-04-22T10:00:00' },
        { authoredAt: '2026-04-19T23:00:00' }, // Sunday — off-day, excluded
      ],
      byDate: new Map([
        ['2026-04-22', 2],
        ['2026-04-19', 1],
      ]),
      ctx: ctx(),
      streakMode: 'skip-non-workdays',
    });
    expect(result.evaluableCommits).toBe(2);
    expect(result.lateNightRatio).toBeCloseTo(0.5, 5);
  });

  it('counts PTO honored ratio correctly', () => {
    const result = wlbAudit({
      commits: [{ authoredAt: '2026-04-22T10:00:00' }],
      byDate: new Map([['2026-04-22', 1]]),
      ctx: ctx({ pto: ['2026-04-22', '2026-04-23'] }),
      streakMode: 'skip-non-workdays',
    });
    expect(result.ptoDaysTaken).toBe(2);
    expect(result.ptoViolationCount).toBe(1);
    expect(result.ptoHonoredRatio).toBeCloseTo(0.5, 5);
  });

  it('returns null PTO honored ratio when no PTO declared', () => {
    const result = wlbAudit({
      commits: [],
      byDate: new Map(),
      ctx: ctx(),
      streakMode: 'skip-non-workdays',
    });
    expect(result.ptoHonoredRatio).toBeNull();
  });
});
