import { useEffect } from 'react';
import { create } from 'zustand';

import { useAuthStore } from '../store/auth';
import { getDeviceId } from './device';
import { loadUserData, migrateLegacyTheme, saveUserData } from './store';
import {
  DEFAULT_TIMEFRAME,
  cloneDefaultUserData,
  type HolidaysConfig,
  type PtoEntry,
  type StreakMode,
  type ThemeChoice,
  type Timeframe,
  type UserData,
  type Workweek,
} from './schema';

// Zustand mirror of the persisted `gi.user-data` doc. Components subscribe by
// selector; mutations write through to IndexedDB via `saveUserData`.
//
// `versions` is bumped on every mutation so worker memo keys (momentum, WLB) can
// invalidate by `(ptoVersion, holidaysVersion, workweekVersion)` without
// hashing the full doc. `localWriteId` is bumped only on *local* writes so
// the sync engine can debounce pushes without echoing remote pulls.

type Status = 'idle' | 'loading' | 'ready' | 'error';

type UserDataState = {
  status: Status;
  login: string | null;
  data: UserData;
  versions: { workweek: number; pto: number; holidays: number; streakMode: number };
  localWriteId: number;
  error: string | null;
  hydrate: (login: string) => Promise<void>;
  reset: () => void;
  setTheme: (next: ThemeChoice) => Promise<void>;
  setWorkweek: (next: Workweek) => Promise<void>;
  setStreakMode: (next: StreakMode) => Promise<void>;
  setPto: (next: PtoEntry[]) => Promise<void>;
  upsertPto: (entry: PtoEntry) => Promise<void>;
  removePto: (date: string) => Promise<void>;
  togglePto: (date: string, base?: Partial<PtoEntry>) => Promise<void>;
  setHolidays: (next: HolidaysConfig) => Promise<void>;
  setHolidayRegions: (regions: string[]) => Promise<void>;
  toggleHolidayOverride: (date: string) => Promise<void>;
  setTimeframe: (next: Timeframe) => Promise<void>;
  replaceAll: (next: UserData) => Promise<void>;
  replaceFromRemote: (next: UserData) => Promise<void>;
};

const initialState = {
  status: 'idle' as Status,
  login: null as string | null,
  data: cloneDefaultUserData(),
  versions: { workweek: 0, pto: 0, holidays: 0, streakMode: 0 },
  localWriteId: 0,
  error: null as string | null,
};

function bumpVersions(
  prev: UserDataState['versions'],
  patch: Partial<UserDataState['versions']>,
): UserDataState['versions'] {
  return {
    workweek: prev.workweek + (patch.workweek ?? 0),
    pto: prev.pto + (patch.pto ?? 0),
    holidays: prev.holidays + (patch.holidays ?? 0),
    streakMode: prev.streakMode + (patch.streakMode ?? 0),
  };
}

function stamp(data: UserData): UserData {
  return {
    ...data,
    updatedAt: new Date().toISOString(),
    lastWriterDeviceId: getDeviceId(),
  };
}

export const useUserDataStore = create<UserDataState>((set, get) => {
  const commit = async (
    next: UserData,
    versionPatch: Partial<UserDataState['versions']> = {},
  ) => {
    const login = get().login;
    if (!login) return;
    const stamped = stamp(next);
    await saveUserData(login, stamped);
    set({
      data: stamped,
      versions: bumpVersions(get().versions, versionPatch),
      localWriteId: get().localWriteId + 1,
    });
  };

  return {
    ...initialState,

    hydrate: async (login) => {
      if (get().login === login && get().status === 'ready') return;
      set({ status: 'loading', login, error: null });
      try {
        let data = await loadUserData(login);
        data = await migrateLegacyTheme(login, data);
        set({ status: 'ready', data, login });
      } catch (err) {
        set({
          status: 'error',
          error: err instanceof Error ? err.message : 'failed to read local user data.',
        });
      }
    },

    reset: () => set({ ...initialState, data: cloneDefaultUserData() }),

    setTheme: async (next) => {
      await commit({ ...get().data, theme: next });
    },

    setWorkweek: async (next) => {
      if (!Array.isArray(next.workdays) || next.workdays.length === 0) {
        throw new Error('workdays must include at least one day.');
      }
      await commit(
        { ...get().data, workweek: { workdays: [...next.workdays].sort() } },
        { workweek: 1 },
      );
    },

    setStreakMode: async (next) => {
      await commit({ ...get().data, streakMode: next }, { streakMode: 1 });
    },

    setPto: async (next) => {
      await commit({ ...get().data, pto: dedupePto(next) }, { pto: 1 });
    },

    upsertPto: async (entry) => {
      const next = dedupePto([...get().data.pto.filter((p) => p.date !== entry.date), entry]);
      await commit({ ...get().data, pto: next }, { pto: 1 });
    },

    removePto: async (date) => {
      const next = get().data.pto.filter((p) => p.date !== date);
      await commit({ ...get().data, pto: next }, { pto: 1 });
    },

    togglePto: async (date, base) => {
      const exists = get().data.pto.some((p) => p.date === date);
      if (exists) {
        await get().removePto(date);
      } else {
        await get().upsertPto({ date, ...(base ?? {}) });
      }
    },

    setHolidays: async (next) => {
      await commit(
        {
          ...get().data,
          holidays: {
            regions: [...new Set(next.regions)].sort(),
            overrides: dedupeOverrides(next.overrides),
          },
        },
        { holidays: 1 },
      );
    },

    setHolidayRegions: async (regions) => {
      const current = get().data.holidays;
      await get().setHolidays({ ...current, regions });
    },

    toggleHolidayOverride: async (date) => {
      const current = get().data.holidays;
      const exists = current.overrides.some((o) => o.date === date);
      const overrides = exists
        ? current.overrides.filter((o) => o.date !== date)
        : [...current.overrides, { date, treatAs: 'workday' as const }];
      await get().setHolidays({ ...current, overrides });
    },

    setTimeframe: async (next) => {
      await commit({ ...get().data, preferences: { ...get().data.preferences, timeframe: next } });
    },

    replaceAll: async (next) => {
      await commit(next, { workweek: 1, pto: 1, holidays: 1, streakMode: 1 });
    },

    // Used by the sync engine when a remote pull supersedes the local doc.
    // Preserves remote `updatedAt` and does NOT bump `localWriteId`, which
    // would otherwise re-trigger a push and loop.
    replaceFromRemote: async (next) => {
      const login = get().login;
      if (!login) return;
      await saveUserData(login, next);
      set({
        data: next,
        versions: bumpVersions(get().versions, {
          workweek: 1,
          pto: 1,
          holidays: 1,
          streakMode: 1,
        }),
      });
    },
  };
});

function dedupePto(entries: PtoEntry[]): PtoEntry[] {
  const map = new Map<string, PtoEntry>();
  for (const entry of entries) {
    if (!entry?.date) continue;
    map.set(entry.date, entry);
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function dedupeOverrides(
  entries: HolidaysConfig['overrides'],
): HolidaysConfig['overrides'] {
  const map = new Map<string, HolidaysConfig['overrides'][number]>();
  for (const entry of entries) {
    if (!entry?.date) continue;
    map.set(entry.date, entry);
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// Mounts once at app startup. Reads `viewer.login` from auth and hydrates the
// user-data doc; resets when the user logs out.
export function UserDataBoot(): null {
  const viewerLogin = useAuthStore((s) => s.viewer?.login ?? null);
  const status = useAuthStore((s) => s.status);
  const hydrate = useUserDataStore((s) => s.hydrate);
  const reset = useUserDataStore((s) => s.reset);

  useEffect(() => {
    if (status === 'authenticated' && viewerLogin) {
      void hydrate(viewerLogin);
    } else if (status === 'idle') {
      reset();
    }
  }, [hydrate, reset, status, viewerLogin]);

  return null;
}

export const useUserData = (): UserData => useUserDataStore((s) => s.data);
export const useTheme = (): ThemeChoice => useUserDataStore((s) => s.data.theme);
export const useWorkweek = (): Workweek => useUserDataStore((s) => s.data.workweek);
export const useStreakMode = (): StreakMode => useUserDataStore((s) => s.data.streakMode);
export const usePto = (): PtoEntry[] => useUserDataStore((s) => s.data.pto);
export const useHolidaysConfig = (): HolidaysConfig =>
  useUserDataStore((s) => s.data.holidays);
export const useUserDataReady = (): boolean =>
  useUserDataStore((s) => s.status === 'ready' || s.login !== null);
export const useUserDataVersions = (): UserDataState['versions'] =>
  useUserDataStore((s) => s.versions);
export const useStoredTimeframe = (): Timeframe =>
  useUserDataStore((s) => s.data.preferences.timeframe ?? DEFAULT_TIMEFRAME);
export const useSetTimeframe = (): ((tf: Timeframe) => Promise<void>) =>
  useUserDataStore((s) => s.setTimeframe);
