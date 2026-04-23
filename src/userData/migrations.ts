import { CURRENT_SCHEMA_VERSION, cloneDefaultUserData, type UserData } from './schema';

// Dispatch table for forward-only schema migrations. Each entry takes the doc
// at version `n` and returns a doc at version `n + 1`. v1 ships first, so
// there are no migrations yet — the table exists so v2 doesn't require a
// refactor to land.
type Migration = (input: unknown) => unknown;

const MIGRATIONS: Record<number, Migration> = {
  // Example for future maintainers:
  // 1: (input) => ({ ...(input as object), newField: 'default', schemaVersion: 2 }),
};

export type MigrationResult = {
  data: UserData;
  migrated: boolean;
  fromVersion: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readVersion(input: unknown): number {
  if (!isObject(input)) return 0;
  const v = input.schemaVersion;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function migrateUserData(input: unknown): MigrationResult {
  const fromVersion = readVersion(input);

  if (!isObject(input) || fromVersion === 0) {
    return { data: cloneDefaultUserData(), migrated: false, fromVersion: 0 };
  }

  if (fromVersion > CURRENT_SCHEMA_VERSION) {
    throw new MigrationError(
      `unrecognized user-data version ${fromVersion}. you're on a newer build than this app.`,
      fromVersion,
    );
  }

  let cursor: unknown = input;
  let version = fromVersion;
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) {
      throw new MigrationError(`missing migration step for v${version}`, version);
    }
    cursor = step(cursor);
    version += 1;
  }

  return {
    data: hydrateDefaults(cursor),
    migrated: fromVersion < CURRENT_SCHEMA_VERSION,
    fromVersion,
  };
}

function hydrateDefaults(input: unknown): UserData {
  const defaults = cloneDefaultUserData();
  if (!isObject(input)) return defaults;
  const merged: UserData = {
    ...defaults,
    ...(input as Partial<UserData>),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    workweek: {
      workdays:
        Array.isArray((input as Partial<UserData>).workweek?.workdays) &&
        ((input as Partial<UserData>).workweek?.workdays?.length ?? 0) > 0
          ? ((input as Partial<UserData>).workweek!.workdays as number[])
          : defaults.workweek.workdays,
    },
    pto: Array.isArray((input as Partial<UserData>).pto)
      ? ((input as Partial<UserData>).pto as UserData['pto'])
      : defaults.pto,
    holidays: {
      regions: Array.isArray((input as Partial<UserData>).holidays?.regions)
        ? ((input as Partial<UserData>).holidays!.regions as string[])
        : defaults.holidays.regions,
      overrides: Array.isArray((input as Partial<UserData>).holidays?.overrides)
        ? ((input as Partial<UserData>).holidays!.overrides as UserData['holidays']['overrides'])
        : defaults.holidays.overrides,
    },
    bento: {
      tileOrder: Array.isArray((input as Partial<UserData>).bento?.tileOrder)
        ? ((input as Partial<UserData>).bento!.tileOrder as string[])
        : defaults.bento.tileOrder,
      hiddenTiles: Array.isArray((input as Partial<UserData>).bento?.hiddenTiles)
        ? ((input as Partial<UserData>).bento!.hiddenTiles as string[])
        : defaults.bento.hiddenTiles,
    },
    preferences: isObject((input as Partial<UserData>).preferences)
      ? ((input as Partial<UserData>).preferences as Record<string, unknown>)
      : defaults.preferences,
  };
  return merged;
}

export class MigrationError extends Error {
  readonly fromVersion: number;

  constructor(message: string, fromVersion: number) {
    super(message);
    this.name = 'MigrationError';
    this.fromVersion = fromVersion;
  }
}
