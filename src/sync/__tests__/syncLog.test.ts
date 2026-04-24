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

import { appendSyncEvent, clearSyncLog, getSyncLog, type SyncEvent } from '../syncLog';

const STORAGE_KEY = 'gi.sync.log';

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-24T22:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  clearSyncLog();
});

describe('syncLog 24h retention', () => {
  it('drops events older than 24 hours on read', () => {
    const oldEvent: SyncEvent = {
      at: '2026-04-23T21:00:00.000Z', // 25h before "now"
      level: 'info',
      message: 'too old',
    };
    const fresh: SyncEvent = {
      at: '2026-04-24T20:00:00.000Z', // 2h before "now"
      level: 'info',
      message: 'recent',
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([fresh, oldEvent]));

    const log = getSyncLog();
    expect(log).toHaveLength(1);
    expect(log[0]!.message).toBe('recent');
  });

  it('keeps events within the last 24 hours', () => {
    const justInside: SyncEvent = {
      at: '2026-04-23T22:30:00.000Z', // 23.5h before "now"
      level: 'info',
      message: 'just inside',
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([justInside]));

    expect(getSyncLog()).toHaveLength(1);
  });

  it('prunes when appending', () => {
    const oldEvent: SyncEvent = {
      at: '2026-04-23T20:00:00.000Z', // 26h before "now"
      level: 'info',
      message: 'too old',
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([oldEvent]));

    const log = appendSyncEvent({ level: 'info', message: 'fresh' });
    expect(log).toHaveLength(1);
    expect(log[0]!.message).toBe('fresh');
  });
});
