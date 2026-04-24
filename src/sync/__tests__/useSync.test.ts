import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createLocalStorageStub() {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

vi.stubGlobal('window', { localStorage: createLocalStorageStub() });

vi.mock('idb-keyval', () => {
  const store = new Map<string, unknown>();
  return {
    createStore: () => store,
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(async () => {
      store.clear();
    }),
  };
});

import { useAuthStore } from '../../store/auth';
import { useSyncStore } from '../useSync';
import { saveSyncConfig } from '../syncConfig';
import { useUserDataStore } from '../../userData/useUserData';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
  window.localStorage.clear();
  useUserDataStore.getState().reset();
  useSyncStore.setState({
    status: 'disabled',
    enabled: false,
    gistId: null,
    lastSyncedAt: null,
    remoteUpdatedAt: null,
    error: null,
    log: [],
  });
  useAuthStore.setState({
    token: 'tok',
    viewer: { login: 'alice', name: 'A', avatarUrl: '' },
    status: 'authenticated',
    error: null,
  });
});

afterEach(() => {
  fetchMock.mockReset();
});

describe('sync engine — graceful disable', () => {
  it('flips sync off (without affecting auth) when the gist API returns 401', async () => {
    saveSyncConfig('alice', { enabled: true, gistId: 'g', remoteUpdatedAt: 'snap' });
    useSyncStore.getState().hydrate('alice');
    expect(useSyncStore.getState().enabled).toBe(true);

    await useUserDataStore.getState().hydrate('alice');

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'bad creds' }), { status: 401 }),
    );

    await useSyncStore.getState().syncNow();

    expect(useSyncStore.getState().enabled).toBe(false);
    expect(useSyncStore.getState().status).toBe('disabled');
    expect(useAuthStore.getState().token).toBe('tok');
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('keeps auth intact and surfaces an error when gist API returns 403', async () => {
    saveSyncConfig('alice', { enabled: true, gistId: 'g', remoteUpdatedAt: 'snap' });
    useSyncStore.getState().hydrate('alice');
    await useUserDataStore.getState().hydrate('alice');

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'forbidden' }), { status: 403 }),
    );

    await useSyncStore.getState().syncNow();

    expect(useSyncStore.getState().enabled).toBe(false);
    expect(useAuthStore.getState().token).toBe('tok');
  });
});
