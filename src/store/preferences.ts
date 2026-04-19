import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Phase 1 only owns the `theme` preference. The full `gi.user-data` IndexedDB
// store (workweek, streakMode, PTO, holidays, bento, …) lands in Phase 5; this
// localStorage-backed Zustand slice is intentionally throwaway. The migration
// path is "read `gi.theme.tmp` once on Phase-5 boot, copy into `gi.user-data`,
// delete the temp key" — see docs/tasks/phase-05-analytics-wlb-pto-holidays.md.

export type ThemeChoice = 'system' | 'dark' | 'light';

type PreferencesState = {
  theme: ThemeChoice;
  setTheme: (next: ThemeChoice) => void;
};

export const PREFERENCES_STORAGE_KEY = 'gi.theme.tmp';

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (next) => set({ theme: next }),
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);
