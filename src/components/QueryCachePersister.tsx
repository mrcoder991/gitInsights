import { IsRestoringProvider, useQueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from '@tanstack/query-persist-client-core';
import { useEffect, useState, type ReactNode } from 'react';

import { classifyError } from '../api/errors';
import { CACHE_VERSION, createPersister, GC_TIME } from '../api/queryClient';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/auth';

// Three pieces of glue between the auth store and the TanStack Query cache:
//
// 1. Persist the cache to a per-account IndexedDB key (spec §3.D). On account
//    switch, the previous persister is torn down and a fresh one keyed on the
//    new login takes over.
// 2. While the cache is restoring from IndexedDB, publish `isRestoring = true`
//    via TanStack Query's `IsRestoringProvider`. This prevents queries from
//    firing before cached data is hydrated — avoiding the scenario where a
//    rate-limit on a stale refetch blanks every tile even though we have
//    perfectly good persisted data sitting in IDB.
// 3. When any query surfaces a 401, hand off to `logout()` (spec §3.H). The
//    persister cleanup in (1) re-runs on the resulting login change and
//    detaches cleanly.

export function QueryCachePersister({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = useQueryClient();
  const login = useAuth().viewer?.login ?? null;
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (!login) return;

    const options = {
      queryClient,
      persister: createPersister(login),
      maxAge: GC_TIME,
      buster: `${CACHE_VERSION}.${login}`,
    };

    let cancelled = false;
    let unsubscribeWrite: (() => void) | undefined;

    setIsRestoring(true);
    persistQueryClientRestore(options)
      .finally(() => {
        if (!cancelled) {
          unsubscribeWrite = persistQueryClientSubscribe(options);
          setIsRestoring(false);
        }
      });

    return () => {
      cancelled = true;
      setIsRestoring(false);
      unsubscribeWrite?.();
    };
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

  return (
    <IsRestoringProvider value={isRestoring}>
      {children}
    </IsRestoringProvider>
  );
}
