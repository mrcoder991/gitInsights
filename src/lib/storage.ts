// Storage cleanup used by logout (spec §3.A) and the 401-boot path. Wipes
// anything namespaced `gi.*` so new stores stay covered automatically.

const NAMESPACE_PREFIX = 'gi.';

// Keys that survive logout / clear-cache. The device id is per-install, used
// only by the cross-device sync log; rotating it on every logout would muddy
// "this was me on the laptop" attribution for no benefit.
const PERSISTENT_KEYS = new Set<string>(['gi.device.id']);

export function clearLocalStorageNamespace(): void {
  if (typeof window === 'undefined') return;
  // Snapshot keys first — removing while iterating skips entries.
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(NAMESPACE_PREFIX) && !PERSISTENT_KEYS.has(key)) {
      keys.push(key);
    }
  }
  for (const key of keys) {
    window.localStorage.removeItem(key);
  }
}

// Best-effort IndexedDB wipe. `indexedDB.databases()` is not available in
// every browser (Firefox shipped it later, Safari only recently); when the
// API is missing we silently no-op rather than blocking logout — the
// Phase 3 query-cache layer also runs `clearAllQueryCache()` directly.
export async function clearAppIndexedDb(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  type IDBWithDatabases = typeof indexedDB & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };
  const idb = indexedDB as IDBWithDatabases;
  if (typeof idb.databases !== 'function') return;

  let entries: Array<{ name?: string }> = [];
  try {
    entries = await idb.databases();
  } catch {
    return;
  }

  await Promise.all(
    entries
      .map((entry) => entry.name)
      .filter((name): name is string => Boolean(name && name.startsWith(NAMESPACE_PREFIX)))
      .map(
        (name) =>
          new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          }),
      ),
  );
}
