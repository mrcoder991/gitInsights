import { QueryClient, type QueryKey } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { clear, createStore, del, get, set } from 'idb-keyval';

import { classifyError, isRetryable } from './errors';

// Cache TTLs are spec §3.D ground truth; keep these next to the QueryClient
// so any future tweak is one place. Hours/days written long-form for grep-ability.

const ONE_MINUTE = 60_000;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = 24 * ONE_HOUR;

export const STALE_TIMES = {
  viewer: 5 * ONE_MINUTE,
  contributions: ONE_HOUR,
  commitHistory: ONE_HOUR,
  repoMetadata: ONE_DAY,
} as const;

export const GC_TIME = 7 * ONE_DAY;

// Bump when the cache shape changes in a backwards-incompatible way (added
// fields are fine; removed/renamed fields require a buster).
export const CACHE_VERSION = 'v1';
const RQ_DB_NAME = 'gi.rq-cache';

const idbStore = createStore(RQ_DB_NAME, 'keyval');

const idbStorage = {
  getItem: (key: string) => get<string>(key, idbStore).then((v) => v ?? null),
  setItem: (key: string, value: string) => set(key, value, idbStore),
  removeItem: (key: string) => del(key, idbStore),
};

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIMES.contributions,
        gcTime: GC_TIME,
        retry: (failureCount, error) => {
          if (failureCount >= 3) return false;
          return isRetryable(classifyError(error));
        },
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function createPersister(login: string) {
  return createAsyncStoragePersister({
    storage: idbStorage,
    key: `gi.rq-cache.${login}.${CACHE_VERSION}`,
    throttleTime: 1000,
  });
}

export async function clearAllQueryCache(): Promise<void> {
  try {
    await clear(idbStore);
  } catch {
    // Best-effort; logout's outer wipe (clearAppIndexedDb) deletes the whole
    // database anyway.
  }
}

export type QueryKeys = {
  viewer: () => QueryKey;
  viewerContributions: (from: string, to: string) => QueryKey;
  viewerOrgs: () => QueryKey;
  repoCommitHistory: (owner: string, name: string, since?: string, until?: string) => QueryKey;
  repoLanguages: (owner: string, name: string) => QueryKey;
  restUser: () => QueryKey;
};

export const queryKeys: QueryKeys = {
  viewer: () => ['viewer'],
  viewerContributions: (from, to) => ['viewer', 'contributions', from, to],
  viewerOrgs: () => ['viewer', 'orgs'],
  repoCommitHistory: (owner, name, since, until) => [
    'repo',
    owner,
    name,
    'commits',
    since ?? null,
    until ?? null,
  ],
  repoLanguages: (owner, name) => ['repo', owner, name, 'languages'],
  restUser: () => ['rest', 'user'],
};
