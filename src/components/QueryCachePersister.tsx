import { useQueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { useEffect } from 'react';

import { classifyError } from '../api/errors';
import { CACHE_VERSION, createPersister, GC_TIME } from '../api/queryClient';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/auth';

// Two pieces of glue between the auth store and the TanStack Query cache:
//
// 1. Persist the cache to a per-account IndexedDB key (spec §3.D). On account
//    switch, the previous persister is torn down and a fresh one keyed on the
//    new login takes over.
// 2. When any query surfaces a 401, hand off to `logout()` (spec §3.H). The
//    persister cleanup in (1) re-runs on the resulting login change and
//    detaches cleanly.

export function QueryCachePersister(): null {
  const queryClient = useQueryClient();
  const login = useAuth().viewer?.login ?? null;

  useEffect(() => {
    if (!login) return;

    const persister = createPersister(login);
    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister,
      maxAge: GC_TIME,
      buster: `${CACHE_VERSION}.${login}`,
    });

    return unsubscribe;
  }, [login, queryClient]);

  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'error') return;
      const info = classifyError(event.action.error);
      if (info.kind === 'unauthorized') {
        void useAuthStore.getState().logout();
      }
    });
  }, [queryClient]);

  return null;
}
