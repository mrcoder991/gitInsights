import { useMemo } from 'react';

import { buildOffDayContext, type OffDayContext } from '../analytics/offDay';
import { useHolidays } from './useHolidays';
import { useHolidaysConfig, usePto, useWorkweek } from './useUserData';

export function useOffDayContext(): { ctx: OffDayContext; isLoading: boolean } {
  const workweek = useWorkweek();
  const pto = usePto();
  const holidaysConfig = useHolidaysConfig();
  const holidays = useHolidays();

  const ctx = useMemo(
    () =>
      buildOffDayContext({
        workweek,
        pto,
        holidays: holidaysConfig,
        holidayDates: holidays.dates,
      }),
    [workweek, pto, holidaysConfig, holidays.dates],
  );

  return { ctx, isLoading: holidays.isLoading };
}
