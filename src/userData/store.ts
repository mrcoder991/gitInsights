import { del, get, set, type UseStore } from 'idb-keyval';

import { migrateUserData, MigrationError } from './migrations';
import { cloneDefaultUserData, CURRENT_SCHEMA_VERSION, type UserData } from './schema';

// IndexedDB user-data store (spec §3.F). One DB, one record per `viewer.login`.
// Reads / writes go through `idb-keyval`; the Zustand mirror in `useUserData`
// is the read path for React components.

const DB_NAME = 'gi.user-data';
const STORE_NAME = 'docs';

// We can't use `idb-keyval`'s `createStore` directly: it opens the DB with no
// version, so its `onupgradeneeded` only fires the very first time the DB is
// created. If a previous session left the DB around without our object store
// (aborted upgrade transaction, an older build that used a different store
// name, manual DevTools edit, etc.), every later transaction throws
// `'docs' is not a known object store name` permanently. This helper opens
// the DB, checks the store exists, and if it doesn't, reopens with
// `version + 1` and creates it inside `onupgradeneeded`. Same shape as
// idb-keyval's `UseStore` so `get`/`set`/`del` keep working unchanged.
function createSelfHealingStore(dbName: string, storeName: string): UseStore {
  let dbp: Promise<IDBDatabase> | null = null;

  const openDb = (version?: number): Promise<IDBDatabase> =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req =
        version === undefined ? indexedDB.open(dbName) : indexedDB.open(dbName, version);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('idb_open_failed'));
      req.onblocked = () => reject(new Error('idb_blocked'));
    });

  const open = (): Promise<IDBDatabase> => {
    if (dbp) return dbp;
    dbp = (async () => {
      const initial = await openDb();
      if (initial.objectStoreNames.contains(storeName)) return initial;
      const nextVersion = initial.version + 1;
      initial.close();
      return openDb(nextVersion);
    })().catch((err) => {
      // Reset so a later call can retry instead of being stuck on a rejected
      // promise. (e.g. tab was holding the upgrade open during `onblocked`.)
      dbp = null;
      throw err;
    });
    return dbp;
  };

  return ((txMode, callback) =>
    open().then((db) =>
      callback(db.transaction(storeName, txMode).objectStore(storeName)),
    )) as UseStore;
}

const idbStore = createSelfHealingStore(DB_NAME, STORE_NAME);

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
