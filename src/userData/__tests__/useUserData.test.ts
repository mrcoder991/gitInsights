import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { useUserDataStore } from '../useUserData';

beforeEach(() => {
  useUserDataStore.getState().reset();
});

describe('useUserDataStore', () => {
  it('hydrates with default workweek', async () => {
    await useUserDataStore.getState().hydrate('alice');
    expect(useUserDataStore.getState().data.workweek.workdays).toEqual([1, 2, 3, 4, 5]);
    expect(useUserDataStore.getState().status).toBe('ready');
  });

  it('bumps the pto version on every PTO mutation so worker memo keys invalidate', async () => {
    await useUserDataStore.getState().hydrate('alice');
    const before = useUserDataStore.getState().versions.pto;
    await useUserDataStore.getState().upsertPto({ date: '2026-04-22', kind: 'vacation' });
    const after = useUserDataStore.getState().versions.pto;
    expect(after).toBeGreaterThan(before);
    expect(useUserDataStore.getState().data.pto).toHaveLength(1);
  });

  it('rejects empty workweeks', async () => {
    await useUserDataStore.getState().hydrate('alice');
    await expect(
      useUserDataStore.getState().setWorkweek({ workdays: [] }),
    ).rejects.toThrow();
  });

  it('changing PTO bumps versions within one tick', async () => {
    await useUserDataStore.getState().hydrate('alice');
    const initial = useUserDataStore.getState().versions;
    await useUserDataStore.getState().upsertPto({ date: '2026-12-25', label: 'xmas' });
    const next = useUserDataStore.getState().versions;
    expect(next.pto).toBe(initial.pto + 1);
  });
});
