import { useMemo } from 'react';

import { resolveTimeframe, type ResolvedTimeframe } from '../analytics/timeframe';
import { useSetTimeframe, useStoredTimeframe } from '../userData';
import type { Timeframe } from '../userData/schema';

export type UseTimeframeResult = ResolvedTimeframe & {
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => Promise<void>;
};

// Floor `now` to the nearest minute so rolling presets don't re-resolve on
// every render — the resolved range only changes once per minute.
function minuteFloor(d: Date): Date {
  return new Date(Math.floor(d.getTime() / 60_000) * 60_000);
}

export function useTimeframe(): UseTimeframeResult {
  const timeframe = useStoredTimeframe();
  const setTimeframe = useSetTimeframe();

  const resolved = useMemo(() => {
    const now = minuteFloor(new Date());
    try {
      return resolveTimeframe(timeframe, now);
    } catch {
      return resolveTimeframe({ kind: 'preset', preset: 'last-year' }, now);
    }
  }, [timeframe]);

  return { timeframe, setTimeframe, ...resolved };
}
