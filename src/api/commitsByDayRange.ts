import type { Octokit } from '@octokit/rest';

import { STALE_TIMES } from './queryClient';
import {
  getChunk,
  setChunk,
  type MonthChunk,
} from './commitCache';
import {
  boundsForMonthKey,
  chunkFromSearchResult,
  monthsOverlappingRangeDescending,
  searchCommitsInDateRange,
} from './githubCommitsSearch';

export type CommitsByDay = {
  byDate: Record<string, number>;
  totalCommits: number;
  fromIso: string;
  toIso: string;
  truncated: boolean;
  timestamps: string[];
  /** Month keys (YYYY-MM) that have been loaded from IDB. Plain array (survives JSON round-trip). */
  cachedMonths: string[];
  totalMonths: number;
};

export type GitHubClientsLite = {
  rest: Octokit;
};

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mergeChunks(
  chunks: MonthChunk[],
  fromIso: string,
  toIso: string,
  cachedMonths: string[],
  totalMonths: number,
): CommitsByDay {
  const byDate: Record<string, number> = {};
  const timestamps: string[] = [];
  let truncated = false;
  let totalCommits = 0;

  for (const c of chunks) {
    truncated ||= c.truncated;
    for (const [d, n] of Object.entries(c.byDate)) {
      if (d < fromIso || d > toIso) continue;
      byDate[d] = (byDate[d] ?? 0) + n;
    }
    for (const t of c.timestamps) {
      const day = t.slice(0, 10);
      if (day < fromIso || day > toIso) continue;
      timestamps.push(t);
    }
  }

  for (const d of Object.keys(byDate)) {
    if (d >= fromIso && d <= toIso) totalCommits += byDate[d] ?? 0;
  }

  return { byDate, totalCommits, fromIso, toIso, truncated, timestamps, cachedMonths, totalMonths };
}

// ---------------------------------------------------------------------------
// Phase 1: IDB-only read (instant, no network)
// ---------------------------------------------------------------------------

export async function loadAllCachedChunks(
  login: string,
  from: Date | string,
  to: Date | string,
): Promise<CommitsByDay | null> {
  const fromDate = new Date(typeof from === 'string' ? from : from);
  const toDate = new Date(typeof to === 'string' ? to : to);
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(0, 0, 0, 0);

  const fromIso = toIsoDate(fromDate);
  const toIso = toIsoDate(toDate);

  const monthKeys = monthsOverlappingRangeDescending(fromDate, toDate);
  const chunks: MonthChunk[] = [];
  const cachedMonths: string[] = [];

  for (const mk of monthKeys) {
    const cached = await getChunk(login, mk);
    if (cached) {
      chunks.push(cached);
      cachedMonths.push(mk);
    }
  }

  if (chunks.length === 0) return null;

  return mergeChunks(chunks, fromIso, toIso, cachedMonths, monthKeys.length);
}

// ---------------------------------------------------------------------------
// Phase 2: Background refresh (gap-aware)
// ---------------------------------------------------------------------------

async function fetchAndStoreMonth(
  clients: GitHubClientsLite,
  login: string,
  monthKey: string,
  priority: 'foreground' | 'backfill',
): Promise<MonthChunk> {
  const { from, to } = boundsForMonthKey(monthKey);
  const data = await searchCommitsInDateRange(clients.rest, login, from, to, priority);
  const chunk = chunkFromSearchResult(login, monthKey, data);
  await setChunk(chunk);
  return chunk;
}

function computeRefreshRange(
  allMonthKeys: string[],
  cachedChunks: Map<string, MonthChunk>,
  staleMs: number,
): string[] {
  const now = Date.now();
  const staleMonths: string[] = [];

  for (const mk of allMonthKeys) {
    const chunk = cachedChunks.get(mk);
    if (!chunk) {
      staleMonths.push(mk);
      continue;
    }
    const age = now - Date.parse(chunk.fetchedAt);
    if (!Number.isFinite(age) || age < 0 || age >= staleMs) {
      staleMonths.push(mk);
    }
  }

  if (staleMonths.length === 0) return [];

  let earliestFetchedAt: number | null = null;
  for (const chunk of cachedChunks.values()) {
    const ts = Date.parse(chunk.fetchedAt);
    if (Number.isFinite(ts) && (earliestFetchedAt === null || ts < earliestFetchedAt)) {
      earliestFetchedAt = ts;
    }
  }

  if (earliestFetchedAt !== null) {
    const gapStart = new Date(earliestFetchedAt);
    gapStart.setDate(gapStart.getDate() - 7);
    const gapStartMonth = toIsoDate(gapStart).slice(0, 7);

    for (const mk of allMonthKeys) {
      if (mk >= gapStartMonth && !staleMonths.includes(mk)) {
        const chunk = cachedChunks.get(mk);
        if (chunk) {
          const age = now - Date.parse(chunk.fetchedAt);
          if (!Number.isFinite(age) || age >= staleMs) {
            staleMonths.push(mk);
          }
        }
      }
    }
  }

  staleMonths.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  return [...new Set(staleMonths)];
}

/**
 * Background refresh: fetches stale/missing months and calls `onSnapshot`
 * after each month completes with a full merged view of all IDB data.
 *
 * In dev mode (React Strict Mode) the effect may double-fire, causing two
 * concurrent runs that both feed the search queue. This is harmless — the
 * queue serializes requests, and the extra calls are only in development.
 * In production there is exactly one invocation.
 */
export async function refreshStaleMonths(
  clients: GitHubClientsLite,
  login: string,
  from: Date | string,
  to: Date | string,
  opts: {
    staleMs?: number;
    signal?: AbortSignal;
    onSnapshot?: (data: CommitsByDay) => void;
  },
): Promise<void> {
  const staleMs = opts.staleMs ?? STALE_TIMES.commitsByDay;
  const fromDate = new Date(typeof from === 'string' ? from : from);
  const toDate = new Date(typeof to === 'string' ? to : to);
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(0, 0, 0, 0);

  const fromIso = toIsoDate(fromDate);
  const toIso = toIsoDate(toDate);

  const allMonthKeys = monthsOverlappingRangeDescending(fromDate, toDate);

  const cachedChunks = new Map<string, MonthChunk>();
  for (const mk of allMonthKeys) {
    const cached = await getChunk(login, mk);
    if (cached) cachedChunks.set(mk, cached);
  }

  const monthsToRefresh = computeRefreshRange(allMonthKeys, cachedChunks, staleMs);
  if (monthsToRefresh.length === 0) return;

  for (const mk of monthsToRefresh) {
    if (opts.signal?.aborted) return;

    try {
      const chunk = await fetchAndStoreMonth(clients, login, mk, 'foreground');
      cachedChunks.set(mk, chunk);
    } catch {
      continue;
    }

    const allChunks = allMonthKeys
      .filter((m) => cachedChunks.has(m))
      .map((m) => cachedChunks.get(m)!);
    const cachedMonths = [...cachedChunks.keys()];

    opts.onSnapshot?.(mergeChunks(allChunks, fromIso, toIso, cachedMonths, allMonthKeys.length));
  }
}

// ---------------------------------------------------------------------------
// On-demand refresh for a specific date range (max 30 days)
// ---------------------------------------------------------------------------

export async function refreshDateRange(
  clients: GitHubClientsLite,
  login: string,
  rangeFrom: Date | string,
  rangeTo: Date | string,
  opts?: {
    signal?: AbortSignal;
    onSnapshot?: (data: CommitsByDay) => void;
    fullFrom?: Date | string;
    fullTo?: Date | string;
  },
): Promise<void> {
  const from = new Date(typeof rangeFrom === 'string' ? rangeFrom : rangeFrom);
  const to = new Date(typeof rangeTo === 'string' ? rangeTo : rangeTo);
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);

  const monthKeys = monthsOverlappingRangeDescending(from, to);

  for (const mk of monthKeys) {
    if (opts?.signal?.aborted) return;

    try {
      const { from: mFrom, to: mTo } = boundsForMonthKey(mk);
      const data = await searchCommitsInDateRange(clients.rest, login, mFrom, mTo, 'foreground');
      const chunk = chunkFromSearchResult(login, mk, data);
      await setChunk(chunk);
    } catch {
      continue;
    }

    if (opts?.fullFrom && opts?.fullTo) {
      const snapshot = await loadAllCachedChunks(login, opts.fullFrom, opts.fullTo);
      if (snapshot) opts.onSnapshot?.(snapshot);
    }
  }
}
