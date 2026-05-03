import { describe, expect, it } from 'vitest';

import { groupPtoIntoRuns } from '../ptoRuns';

describe('groupPtoIntoRuns', () => {
  it('returns empty for empty input', () => {
    expect(groupPtoIntoRuns([])).toEqual([]);
  });

  it('single day is one run', () => {
    const runs = groupPtoIntoRuns([{ date: '2024-05-12', kind: 'vacation' }]);
    expect(runs).toHaveLength(1);
    const r0 = runs[0]!;
    expect(r0.start).toBe('2024-05-12');
    expect(r0.end).toBe('2024-05-12');
    expect(r0.entries).toHaveLength(1);
  });

  it('merges consecutive days with same kind and label', () => {
    const runs = groupPtoIntoRuns([
      { date: '2024-05-12', kind: 'vacation', label: 'trip' },
      { date: '2024-05-13', kind: 'vacation', label: 'trip' },
      { date: '2024-05-14', kind: 'vacation', label: 'trip' },
    ]);
    expect(runs).toHaveLength(1);
    const r0 = runs[0]!;
    expect(r0.start).toBe('2024-05-12');
    expect(r0.end).toBe('2024-05-14');
    expect(r0.entries).toHaveLength(3);
  });

  it('splits when label differs', () => {
    const runs = groupPtoIntoRuns([
      { date: '2024-05-12', kind: 'vacation', label: 'a' },
      { date: '2024-05-13', kind: 'vacation', label: 'b' },
    ]);
    expect(runs).toHaveLength(2);
  });

  it('splits when kind differs', () => {
    const runs = groupPtoIntoRuns([
      { date: '2024-05-12', kind: 'vacation' },
      { date: '2024-05-13', kind: 'sick' },
    ]);
    expect(runs).toHaveLength(2);
  });

  it('treats missing label like empty string for grouping', () => {
    const runs = groupPtoIntoRuns([
      { date: '2024-05-12', kind: 'vacation' },
      { date: '2024-05-13', kind: 'vacation', label: '' },
    ]);
    expect(runs).toHaveLength(1);
  });

  it('does not merge non-consecutive same meta', () => {
    const runs = groupPtoIntoRuns([
      { date: '2024-05-12', kind: 'vacation' },
      { date: '2024-05-14', kind: 'vacation' },
    ]);
    expect(runs).toHaveLength(2);
  });
});
