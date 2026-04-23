// Schema for the `gi.user-data` IndexedDB doc (spec §3.F).
// One source of truth for everything the user can configure: theme, workweek,
// streak mode, PTO, holidays, bento layout, and a forward-compatible bag.
//
// `schemaVersion` MUST be bumped whenever a backward-incompatible change is
// made; add an entry to the migrations dispatch table in `migrations.ts`.

export type ThemeChoice = 'system' | 'dark' | 'light';

export type StreakMode = 'strict' | 'skip-non-workdays' | 'workdays-only';

export type PtoKind = 'vacation' | 'sick' | 'holiday' | 'other';

export type PtoEntry = {
  date: string;
  label?: string;
  kind?: PtoKind;
};

export type HolidayOverride = {
  date: string;
  treatAs: 'workday';
};

export type HolidaysConfig = {
  regions: string[];
  overrides: HolidayOverride[];
};

export type Workweek = {
  workdays: number[];
};

export type BentoConfig = {
  tileOrder: string[];
  hiddenTiles: string[];
};

export type UserData = {
  schemaVersion: 1;
  theme: ThemeChoice;
  workweek: Workweek;
  streakMode: StreakMode;
  pto: PtoEntry[];
  holidays: HolidaysConfig;
  bento: BentoConfig;
  preferences: Record<string, unknown>;
};

export const CURRENT_SCHEMA_VERSION = 1 as const;

export const DEFAULT_USER_DATA: UserData = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  theme: 'system',
  workweek: { workdays: [1, 2, 3, 4, 5] },
  streakMode: 'skip-non-workdays',
  pto: [],
  holidays: { regions: [], overrides: [] },
  bento: { tileOrder: [], hiddenTiles: [] },
  preferences: {},
};

export function cloneDefaultUserData(): UserData {
  return {
    ...DEFAULT_USER_DATA,
    workweek: { workdays: [...DEFAULT_USER_DATA.workweek.workdays] },
    pto: [],
    holidays: { regions: [], overrides: [] },
    bento: { tileOrder: [], hiddenTiles: [] },
    preferences: {},
  };
}
