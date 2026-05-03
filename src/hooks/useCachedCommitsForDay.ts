import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { getCachedCommitsForDay, type CachedCommitDayEntry } from '../api/commitCache';

/** Reads IndexedDB month chunk only (no GitHub calls). */
export function useCachedCommitsForDay(options: {
  login: string | null | undefined;
  dateKey: string | null;
  enabled: boolean;
}): UseQueryResult<CachedCommitDayEntry[]> {
  const login = options.login ?? '';
  const dateKey = options.dateKey ?? '';
  return useQuery({
    queryKey: ['idb', 'viewerCommitsForDay', login, dateKey] as const,
    queryFn: () => getCachedCommitsForDay(login, dateKey),
    enabled: options.enabled && login.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(dateKey),
  });
}
