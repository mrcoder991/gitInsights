import { describe, expect, it } from 'vitest';

import {
  formatDisplayDayMonth,
  formatDisplayDayMonthYear,
  formatDisplayMonthYear,
  formatDisplayWeekdayDayMonth,
  formatDisplayWeekdayDayMonthYear,
} from '../dates';

describe('formatDisplayDayMonth', () => {
  it('pads day and lowercases month', () => {
    expect(formatDisplayDayMonth('2026-02-02')).toBe('feb 02');
    expect(formatDisplayDayMonth('2026-12-09')).toBe('dec 09');
  });
});

describe('formatDisplayDayMonthYear', () => {
  it('includes year', () => {
    expect(formatDisplayDayMonthYear('2026-05-04')).toBe('may 04, 2026');
  });
});

describe('formatDisplayWeekdayDayMonth', () => {
  it('prefixes weekday', () => {
    expect(formatDisplayWeekdayDayMonth('2026-05-04')).toMatch(/^[a-z]{3}, may 04$/);
  });
});

describe('formatDisplayWeekdayDayMonthYear', () => {
  it('includes weekday and year', () => {
    expect(formatDisplayWeekdayDayMonthYear('2026-05-04')).toMatch(/^[a-z]{3}, may 04, 2026$/);
  });
});

describe('formatDisplayMonthYear', () => {
  it('formats month bucket label', () => {
    expect(formatDisplayMonthYear(2026, 0)).toBe('jan 2026');
  });
});
