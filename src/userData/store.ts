import { createStore, del, get, set } from 'idb-keyval';

import { migrateUserData, MigrationError } from './migrations';
import { cloneDefaultUserData, CURRENT_SCHEMA_VERSION, type UserData } from './schema';

// IndexedDB user-data store (spec §3.F). One DB, one record per `viewer.login`.
// Reads / writes go through `idb-keyval`; the Zustand mirror in `useUserData`
// is the read path for React components.

const DB_NAME = 'gi.user-data';
const STORE_NAME = 'docs';

const idbStore = createStore(DB_NAME, STORE_NAME);

export function userDataKey(login: string): string {
  return `gi.user-data:${login}`;
}

export async function loadUserData(login: string): Promise<UserData> {
  const raw = await get<unknown>(userDataKey(login), idbStore);
  if (raw === undefined) return cloneDefaultUserData();
  const result = migrateUserData(raw);
  if (result.migrated) {
    await set(userDataKey(login), result.data, idbStore);
  }
  return result.data;
}

export async function saveUserData(login: string, data: UserData): Promise<void> {
  await set(userDataKey(login), data, idbStore);
}

export async function clearUserData(login: string): Promise<void> {
  await del(userDataKey(login), idbStore);
}

export async function exportUserData(login: string): Promise<UserData> {
  return loadUserData(login);
}

export async function importUserData(login: string, raw: unknown): Promise<UserData> {
  if (typeof raw !== 'object' || raw === null) {
    throw new MigrationError(
      "that file isn't a gi.user-data document. import a json the app exported.",
      0,
    );
  }
  const candidate = raw as { schemaVersion?: unknown };
  if (
    typeof candidate.schemaVersion !== 'number' ||
    candidate.schemaVersion > CURRENT_SCHEMA_VERSION
  ) {
    throw new MigrationError(
      `that json is schema v${String(candidate.schemaVersion)}. this build only knows v${CURRENT_SCHEMA_VERSION}. update the app and try again.`,
      typeof candidate.schemaVersion === 'number' ? candidate.schemaVersion : 0,
    );
  }
  const result = migrateUserData(raw);
  await saveUserData(login, result.data);
  return result.data;
}

// Phase 1 stored the theme preference under `gi.theme.tmp` in localStorage.
// Migrate that value into the user-data doc once on first read, then drop the
// temp key so subsequent boots are clean. Idempotent.
export const PHASE1_TEMP_THEME_KEY = 'gi.theme.tmp';

type Phase1ThemeBlob = {
  state?: { theme?: 'system' | 'dark' | 'light' };
  version?: number;
};

export async function migrateLegacyTheme(login: string, current: UserData): Promise<UserData> {
  if (typeof window === 'undefined') return current;
  const raw = window.localStorage.getItem(PHASE1_TEMP_THEME_KEY);
  if (!raw) return current;
  let parsed: Phase1ThemeBlob | null = null;
  try {
    parsed = JSON.parse(raw) as Phase1ThemeBlob;
  } catch {
    window.localStorage.removeItem(PHASE1_TEMP_THEME_KEY);
    return current;
  }
  const theme = parsed?.state?.theme;
  if (!theme || theme === current.theme) {
    window.localStorage.removeItem(PHASE1_TEMP_THEME_KEY);
    return current;
  }
  const next = { ...current, theme };
  await saveUserData(login, next);
  window.localStorage.removeItem(PHASE1_TEMP_THEME_KEY);
  return next;
}
