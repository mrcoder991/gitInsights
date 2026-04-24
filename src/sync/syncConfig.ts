// Per-account sync settings persisted to localStorage. Keyed by `viewer.login`
// so a multi-account browser doesn't cross-pollinate.

const STORAGE_KEY = 'gi.sync.config';

export type SyncConfig = {
  enabled: boolean;
  gistId: string | null;
  // Last successful sync timestamps. Drives the "synced 12 seconds ago"
  // indicator and the conflict-detection cache.
  lastSyncedAt: string | null;
  remoteUpdatedAt: string | null;
};

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: false,
  gistId: null,
  lastSyncedAt: null,
  remoteUpdatedAt: null,
};

type Bucket = Record<string, SyncConfig>;

function readBucket(): Bucket {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Bucket;
  } catch {
    return {};
  }
}

function writeBucket(bucket: Bucket): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bucket));
}

export function loadSyncConfig(login: string): SyncConfig {
  const bucket = readBucket();
  return { ...DEFAULT_SYNC_CONFIG, ...(bucket[login] ?? {}) };
}

export function saveSyncConfig(login: string, next: Partial<SyncConfig>): SyncConfig {
  const bucket = readBucket();
  const merged: SyncConfig = { ...DEFAULT_SYNC_CONFIG, ...(bucket[login] ?? {}), ...next };
  bucket[login] = merged;
  writeBucket(bucket);
  return merged;
}

export function clearSyncConfig(login: string): void {
  const bucket = readBucket();
  delete bucket[login];
  writeBucket(bucket);
}

// Re-auth intent flag. Set right before `reauthorize(['gist'])`; consumed by
// /callback once the new token is in place. We persist it because the
// redirect blows away in-memory state.
const SYNC_INTENT_KEY = 'gi.sync.pending-enable';

export function markSyncIntent(login: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SYNC_INTENT_KEY, login);
}

export function consumeSyncIntent(): string | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(SYNC_INTENT_KEY);
  if (v) window.localStorage.removeItem(SYNC_INTENT_KEY);
  return v;
}
