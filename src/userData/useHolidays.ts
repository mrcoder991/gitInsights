import { useEffect, useState } from 'react';

import { loadHolidayDates, indexHolidays, type HolidayLookup } from '../data/holidays';
import { useHolidaysConfig } from './useUserData';

// Loads bundled holiday JSONs for the regions the user has selected. Returns
// an empty lookup until at least one region resolves; cheap because the
// bundles are tree-split via dynamic `import()`.

export type HolidayState = {
  lookup: HolidayLookup;
  dates: Set<string>;
  isLoading: boolean;
};

const EMPTY_STATE: HolidayState = {
  lookup: new Map(),
  dates: new Set(),
  isLoading: false,
};

export function useHolidays(): HolidayState {
  const config = useHolidaysConfig();
  const [state, setState] = useState<HolidayState>(EMPTY_STATE);

  useEffect(() => {
    let cancelled = false;
    if (config.regions.length === 0) {
      setState(EMPTY_STATE);
      return () => {
        cancelled = true;
      };
    }
    setState((prev) => ({ ...prev, isLoading: true }));
    void (async () => {
      const entries = await loadHolidayDates(config.regions);
      if (cancelled) return;
      const lookup = indexHolidays(entries);
      setState({
        lookup,
        dates: new Set(lookup.keys()),
        isLoading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [config.regions]);

  return state;
}
