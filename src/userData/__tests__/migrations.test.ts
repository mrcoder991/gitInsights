import { describe, expect, it } from 'vitest';

import { migrateUserData, MigrationError } from '../migrations';
import { CURRENT_SCHEMA_VERSION } from '../schema';

describe('migrateUserData', () => {
  it('returns defaults when input is missing or non-object', () => {
    const result = migrateUserData(undefined);
    expect(result.fromVersion).toBe(0);
    expect(result.migrated).toBe(false);
    expect(result.data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.data.workweek.workdays).toEqual([1, 2, 3, 4, 5]);
  });

  it('passes through current-version docs unchanged', () => {
    const doc = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      theme: 'dark' as const,
      workweek: { workdays: [1, 2, 3] },
      streakMode: 'workdays-only' as const,
      pto: [{ date: '2026-01-01', kind: 'vacation' as const }],
      holidays: { regions: ['US'], overrides: [] },
      bento: { tileOrder: [], hiddenTiles: [] },
      preferences: { foo: 'bar' },
    };
    const result = migrateUserData(doc);
    expect(result.migrated).toBe(false);
    expect(result.data.theme).toBe('dark');
    expect(result.data.workweek.workdays).toEqual([1, 2, 3]);
    expect(result.data.holidays.regions).toEqual(['US']);
  });

  it('rejects future schema versions', () => {
    expect(() =>
      migrateUserData({ schemaVersion: 999, theme: 'dark' }),
    ).toThrow(MigrationError);
  });

  it('hydrates missing fields with defaults', () => {
    const partial = { schemaVersion: 1, theme: 'light' as const };
    const result = migrateUserData(partial);
    expect(result.data.theme).toBe('light');
    expect(result.data.workweek.workdays).toEqual([1, 2, 3, 4, 5]);
    expect(result.data.holidays.regions).toEqual([]);
  });
});
