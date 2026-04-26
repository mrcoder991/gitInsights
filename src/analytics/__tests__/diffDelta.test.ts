import { describe, expect, it } from 'vitest';

import { commitMomentum, diffDelta, recencyWeight } from '../diffDelta';

describe('diffDelta', () => {
  it('floors at 0', () => {
    const score = diffDelta({
      authoredAt: '2026-04-01T12:00:00Z',
      additions: 1,
      deletions: 0,
      filesChanged: 0,
      isMerge: true,
    });
    expect(score).toBe(0);
  });

  it('applies vendor penalty when >80% of paths are vendor-y', () => {
    const baseScore = diffDelta({
      authoredAt: '2026-04-01T12:00:00Z',
      additions: 100,
      deletions: 50,
      filesChanged: 4,
      isMerge: false,
    });
    const vendorScore = diffDelta({
      authoredAt: '2026-04-01T12:00:00Z',
      additions: 100,
      deletions: 50,
      filesChanged: 4,
      isMerge: false,
      changedPaths: [
        'node_modules/foo/x.js',
        'node_modules/foo/y.js',
        'node_modules/foo/z.js',
        'node_modules/foo/q.js',
        'package-lock.json',
      ],
    });
    expect(vendorScore).toBeCloseTo(baseScore * 0.9, 5);
  });
});

describe('recencyWeight', () => {
  it('is 1.0 for today and approaches 0.25 at 365 days', () => {
    const now = new Date('2026-04-23T00:00:00Z');
    expect(recencyWeight(now.toISOString(), now)).toBeCloseTo(1, 5);
    expect(recencyWeight('2025-04-23T00:00:00Z', now)).toBeCloseTo(0.25, 2);
  });
});

describe('commitMomentum', () => {
  it('sums recency weights per commit across the rolling window', () => {
    const now = new Date('2026-04-23T00:00:00Z');
    const result = commitMomentum(
      [{ authoredAt: '2026-04-23T10:00:00Z' }, { authoredAt: '2026-04-22T10:00:00Z' }],
      now,
    );
    const wToday = recencyWeight('2026-04-23T10:00:00Z', now);
    const wYesterday = recencyWeight('2026-04-22T10:00:00Z', now);
    expect(result.total).toBeCloseTo(wToday + wYesterday, 5);
    expect(Object.keys(result.perDay)).toEqual(
      expect.arrayContaining(['2026-04-22', '2026-04-23']),
    );
  });
});
