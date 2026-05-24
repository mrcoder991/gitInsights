// Month-chunked commit cache for GET /search/commits (spec §3.D.1, Phase 11).
import { clear, createStore, del, get, keys, set } from 'idb-keyval';

const DB_NAME = 'gi.commits';
const STORE_NAME = 'chunks';

const idbStore = createStore(DB_NAME, STORE_NAME);

/** Per-commit row persisted for heatmap day drill-down (search/commits, merge:false). */
export type CachedCommitDayEntry = {
  sha: string;
  repoFullName: string;
  title: string;
  authorDate: string;
  htmlUrl: string;
};

export type MonthChunk = {
  month: string;
  login: string;
  byDate: Record<string, number>;
  timestamps: string[];
  /** YYYY-MM-DD → commits that day (author-date), newest first within each day. */
  dayCommits: Record<string, CachedCommitDayEntry[]>;
  fetchedAt: string;
  /** @deprecated No longer written. Kept optional for backward compat with existing IDB data. */
  sealed?: boolean;
  truncated: boolean;
};

function chunkKey(login: string, month: string): string {
  return `v2:${login}:${month}`;
}

function legacyChunkKey(login: string, month: string): string {
  return `v1:${login}:${month}`;
}

function loginKeyPrefixes(login: string): [string, string] {
  return [`v1:${login}:`, `v2:${login}:`];
}

export async function getChunk(login: string, month: string): Promise<MonthChunk | null> {
  const primary = chunkKey(login, month);
  const row = await get<MonthChunk>(primary, idbStore);
  if (row) return row;

  const legacy = await get<LegacyMonthBlob>(legacyChunkKey(login, month), idbStore);
  if (!legacy) return null;

  const migrated: MonthChunk = {
    month: legacy.month,
    login: legacy.login,
    byDate: legacy.byDate,
    timestamps: legacy.timestamps,
    dayCommits: legacy.dayCommits ?? {},
    fetchedAt: legacy.fetchedAt,
    truncated: legacy.truncated,
  };
  await setChunk(migrated);
  await del(legacyChunkKey(login, month), idbStore);
  return migrated;
}

type LegacyMonthBlob = Omit<MonthChunk, 'dayCommits'> & { dayCommits?: Record<string, CachedCommitDayEntry[]> };

export async function setChunk(chunk: MonthChunk): Promise<void> {
  await set(chunkKey(chunk.login, chunk.month), chunk, idbStore);
}

export async function deleteAllChunks(login: string): Promise<void> {
  const all = await keys<string>(idbStore);
  const [p1, p2] = loginKeyPrefixes(login);
  await Promise.all(
    all.filter((k) => k.startsWith(p1) || k.startsWith(p2)).map((k) => del(k, idbStore)),
  );
}

/** Sorted ascending YYYY-MM. */
export async function listCachedMonths(login: string): Promise<string[]> {
  const all = await keys<string>(idbStore);
  const [p1, p2] = loginKeyPrefixes(login);
  const months = new Set<string>();
  for (const k of all) {
    if (k.startsWith(p1)) {
      months.add(k.slice(p1.length));
    } else if (k.startsWith(p2)) {
      months.add(k.slice(p2.length));
    }
  }
  const out = [...months].filter((m) => /^\d{4}-\d{2}$/.test(m));
  out.sort();
  return out;
}

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Load commit details for one calendar day from the month chunk in IndexedDB (no network). */
export async function getCachedCommitsForDay(
  login: string,
  dateKey: string,
): Promise<CachedCommitDayEntry[]> {
  if (!ISO_DATE_ONLY.test(dateKey)) return [];
  const month = dateKey.slice(0, 7);
  const chunk = await getChunk(login, month);
  const list = chunk?.dayCommits[dateKey];
  return Array.isArray(list) ? list : [];
}

export async function clearCommitCacheStore(): Promise<void> {
  try {
    await clear(idbStore);
  } catch {
    // best-effort
  }
}
