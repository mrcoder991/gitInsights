// Storage cleanup utilities used by logout (spec §3.A "Logout clears all gi.*
// keys plus the IndexedDB cache") and the 401-boot path. Phase 3+ will own
// real IndexedDB stores via TanStack Query / idb-keyval; for Phase 2 we just
// wipe anything namespaced `gi.*` so future phases can drop in without
// changing the logout contract.

const NAMESPACE_PREFIX = 'gi.';

export function clearLocalStorageNamespace(): void {
  if (typeof window === 'undefined') return;
  // Snapshot keys first — removing while iterating skips entries.
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(NAMESPACE_PREFIX)) keys.push(key);
  }
  for (const key of keys) {
    window.localStorage.removeItem(key);
  }
}

// Best-effort IndexedDB wipe. `indexedDB.databases()` is not available in
// every browser (Firefox shipped it later, Safari only recently); when the
// API is missing we silently no-op rather than blocking logout. Phase 3 will
// register specific store names that we can fall back to enumerating.
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
