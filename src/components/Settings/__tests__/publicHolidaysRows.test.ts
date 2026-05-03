import { describe, expect, it } from 'vitest';

import { holidayRowsFromLookup, type HolidayListRow } from '../publicHolidayList';

function mapFrom(entries: Record<string, { name: string }[]>): Map<string, { name: string }[]> {
  return new Map(Object.entries(entries));
}

describe('holidayRowsFromLookup', () => {
  const mid2025 = new Date('2025-06-15T12:00:00');

  it('returns empty for empty lookup', () => {
    expect(holidayRowsFromLookup(new Map(), mid2025)).toEqual([]);
  });

  it('labels timing from reference today', () => {
    const lookup = mapFrom({
      '2025-06-01': [{ name: 'before' }],
      '2025-06-15': [{ name: 'today' }],
      '2025-06-30': [{ name: 'after' }],
    });
    const rows = holidayRowsFromLookup(lookup, mid2025);
    const byDate = Object.fromEntries(rows.map((r) => [r.date, r]));

    expect(byDate['2025-06-01']!.timing).toBe('past');
    expect(byDate['2025-06-15']!.timing).toBe('upcoming');
    expect(byDate['2025-06-30']!.timing).toBe('upcoming');
  });

  it('sorts upcoming ascending by date, then past descending', () => {
    const lookup = mapFrom({
      '2025-05-01': [{ name: 'old past' }],
      '2025-08-01': [{ name: 'far future' }],
      '2025-07-01': [{ name: 'near future' }],
      '2025-04-01': [{ name: 'recent past' }],
    });
    const rows = holidayRowsFromLookup(lookup, mid2025);
    const timingOrder = rows.map((r: HolidayListRow) => r.timing);
    expect(timingOrder.filter((t) => t === 'upcoming')).toHaveLength(2);
    expect(timingOrder.filter((t) => t === 'past')).toHaveLength(2);
    const upcoming = rows.filter((r) => r.timing === 'upcoming').map((r) => r.date);
    expect(upcoming).toEqual(['2025-07-01', '2025-08-01']);
    const past = rows.filter((r) => r.timing === 'past').map((r) => r.date);
    expect(past).toEqual(['2025-05-01', '2025-04-01']);
  });

  it('flattens multiple names on the same date', () => {
    const lookup = mapFrom({
      '2025-12-25': [{ name: 'A' }, { name: 'B' }],
    });
    const rows = holidayRowsFromLookup(lookup, mid2025);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.date === '2025-12-25')).toBe(true);
  });
});
