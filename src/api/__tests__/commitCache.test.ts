import { describe, expect, it } from 'vitest';

import { monthKeyFromDate } from '../githubCommitsSearch';

describe('commit cache utils', () => {
  it('monthKeyFromDate matches YYYY-MM', () => {
    expect(monthKeyFromDate(new Date(2026, 0, 7))).toBe('2026-01');
  });
});
