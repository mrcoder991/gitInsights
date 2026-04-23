import { useEffect } from 'react';
import { create } from 'zustand';

import { useAuthStore } from '../store/auth';
import { loadUserData, migrateLegacyTheme, saveUserData } from './store';
import {
  cloneDefaultUserData,
  type HolidaysConfig,
  type PtoEntry,
  type StreakMode,
  type ThemeChoice,
  type UserData,
  type Workweek,
} from './schema';

// Zustand mirror of the persisted `gi.user-data` doc. Components subscribe by
// selector; mutations write through to IndexedDB via `saveUserData`.
//
// `version` is bumped on every mutation so worker memo keys (EP, WLB) can
// invalidate by `(ptoVersion, holidaysVersion, workweekVersion)` without
// hashing the full doc.

type Status = 'idle' | 'loading' | 'ready' | 'error';

type UserDataState = {
  status: Status;
  login: string | null;
  data: UserData;
  versions: { workweek: number; pto: number; holidays: number; streakMode: number };
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
  replaceAll: (next: UserData) => Promise<void>;
};

const initialState = {
  status: 'idle' as Status,
  login: null as string | null,
  data: cloneDefaultUserData(),
  versions: { workweek: 0, pto: 0, holidays: 0, streakMode: 0 },
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

export const useUserDataStore = create<UserDataState>((set, get) => ({
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
    const login = get().login;
    if (!login) return;
    const data = { ...get().data, theme: next };
    await saveUserData(login, data);
    set({ data });
  },

  setWorkweek: async (next) => {
    const login = get().login;
    if (!login) return;
    if (!Array.isArray(next.workdays) || next.workdays.length === 0) {
      throw new Error('workdays must include at least one day.');
    }
    const data = { ...get().data, workweek: { workdays: [...next.workdays].sort() } };
    await saveUserData(login, data);
    set({ data, versions: bumpVersions(get().versions, { workweek: 1 }) });
  },

  setStreakMode: async (next) => {
    const login = get().login;
    if (!login) return;
    const data = { ...get().data, streakMode: next };
    await saveUserData(login, data);
    set({ data, versions: bumpVersions(get().versions, { streakMode: 1 }) });
  },

  setPto: async (next) => {
    const login = get().login;
    if (!login) return;
    const data = { ...get().data, pto: dedupePto(next) };
    await saveUserData(login, data);
    set({ data, versions: bumpVersions(get().versions, { pto: 1 }) });
  },

  upsertPto: async (entry) => {
    const login = get().login;
    if (!login) return;
    const next = dedupePto([...get().data.pto.filter((p) => p.date !== entry.date), entry]);
    const data = { ...get().data, pto: next };
    await saveUserData(login, data);
    set({ data, versions: bumpVersions(get().versions, { pto: 1 }) });
  },

  removePto: async (date) => {
    const login = get().login;
    if (!login) return;
    const next = get().data.pto.filter((p) => p.date !== date);
    const data = { ...get().data, pto: next };
    await saveUserData(login, data);
    set({ data, versions: bumpVersions(get().versions, { pto: 1 }) });
  },

  togglePto: async (date, base) => {
    const login = get().login;
    if (!login) return;
    const exists = get().data.pto.some((p) => p.date === date);
    if (exists) {
      await get().removePto(date);
    } else {
      await get().upsertPto({ date, ...(base ?? {}) });
    }
  },

  setHolidays: async (next) => {
    const login = get().login;
    if (!login) return;
    const data = {
      ...get().data,
      holidays: {
        regions: [...new Set(next.regions)].sort(),
        overrides: dedupeOverrides(next.overrides),
      },
    };
    await saveUserData(login, data);
    set({ data, versions: bumpVersions(get().versions, { holidays: 1 }) });
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

  replaceAll: async (next) => {
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
}));

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

// Convenience selectors so components don't have to recompose them everywhere.
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
