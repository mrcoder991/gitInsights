import { useEffect } from 'react';
import { create } from 'zustand';

import { fetchGrantedScopes } from '../lib/githubScopes';
import { useAuthStore, SYNC_SCOPE } from '../store/auth';
import {
  GistAuthError,
  GistConflictError,
  create as createGist,
  deleteGist,
  discover,
  pull as pullGist,
  push as pushGist,
  resolveByUpdatedAt,
  type GistRef,
} from './gistSync';
import {
  DEFAULT_SYNC_CONFIG,
  clearSyncConfig,
  consumeSyncIntent,
  loadSyncConfig,
  markSyncIntent,
  saveSyncConfig,
  type SyncConfig,
} from './syncConfig';
import {
  appendSyncEvent,
  clearSyncLog,
  getSyncLog,
  type SyncEvent,
} from './syncLog';
import { useUserDataStore } from '../userData/useUserData';
import type { UserData } from '../userData/schema';

// Phase 5b sync engine. Persistent config (enabled / gistId / lastSync) lives
// in localStorage; transient state (in-flight push, last error, log buffer)
// lives in this store. Pulls run on boot + on explicit "Sync now"; pushes
// are debounced by `PUSH_DEBOUNCE_MS` after any local write. Conflict path:
// last-write-wins, retry once.

const PUSH_DEBOUNCE_MS = 2000;

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'disabled';

type SyncState = {
  status: SyncStatus;
  enabled: boolean;
  gistId: string | null;
  lastSyncedAt: string | null;
  remoteUpdatedAt: string | null;
  error: string | null;
  log: SyncEvent[];
  hydrate: (login: string) => void;
  enable: () => Promise<void>;
  disable: () => void;
  syncNow: () => Promise<void>;
  deleteCloudCopy: () => Promise<void>;
  clearLog: () => void;
};

const initialState = {
  status: 'disabled' as SyncStatus,
  enabled: DEFAULT_SYNC_CONFIG.enabled,
  gistId: DEFAULT_SYNC_CONFIG.gistId,
  lastSyncedAt: DEFAULT_SYNC_CONFIG.lastSyncedAt,
  remoteUpdatedAt: DEFAULT_SYNC_CONFIG.remoteUpdatedAt,
  error: null as string | null,
  log: [] as SyncEvent[],
};

function syncMessage(err: unknown): string {
  if (err instanceof GistAuthError) {
    return err.status === 403
      ? 'github says we no longer have permission. re-enable sync to continue.'
      : 'scope revoked, re-enable sync to continue.';
  }
  if (err instanceof GistConflictError) {
    return "another device wrote at the same time. we'll try once more.";
  }
  if (err instanceof Error) {
    if (err.message.startsWith('gist_')) return "couldn't reach github. local data is fine.";
    return err.message;
  }
  return "couldn't reach github. local data is fine.";
}

export const useSyncStore = create<SyncState>((set, get) => {
  const log = (level: SyncEvent['level'], message: string) => {
    const next = appendSyncEvent({ level, message });
    set({ log: next });
  };

  const persist = (login: string, patch: Partial<SyncConfig>) => {
    const next = saveSyncConfig(login, patch);
    set({
      enabled: next.enabled,
      gistId: next.gistId,
      lastSyncedAt: next.lastSyncedAt,
      remoteUpdatedAt: next.remoteUpdatedAt,
    });
    return next;
  };

  // The single push/pull worker. Always runs through here so we can serialize
  // and short-circuit when sync is off.
  const performSync = async (mode: 'pull-then-push' | 'push' | 'pull'): Promise<void> => {
    const auth = useAuthStore.getState();
    const token = auth.token;
    const login = auth.viewer?.login;
    if (!token || !login || !get().enabled) return;

    set({ status: 'syncing', error: null });

    try {
      let gistId = get().gistId;

      if (!gistId) {
        const found = await discover(token);
        if (found) {
          gistId = found.gistId;
          persist(login, { gistId, remoteUpdatedAt: found.updatedAt });
        }
      }

      const localDoc = useUserDataStore.getState().data;

      if (mode !== 'push' && gistId) {
        const { doc: remoteDoc, ref } = await pullGist(token, gistId);
        const winner = resolveByUpdatedAt(localDoc, remoteDoc);
        if (winner === remoteDoc && remoteDoc.updatedAt !== localDoc.updatedAt) {
          await useUserDataStore.getState().replaceFromRemote(remoteDoc);
          log('info', 'pulled newer doc from cloud.');
        }
        persist(login, { remoteUpdatedAt: ref.updatedAt });
      }

      if (mode !== 'pull') {
        const docToPush = useUserDataStore.getState().data;
        const ref = gistId
          ? await pushOrRetry(token, gistId, docToPush, get().remoteUpdatedAt ?? '')
          : await createGist(token, docToPush);
        persist(login, {
          gistId: ref.gistId,
          remoteUpdatedAt: ref.updatedAt,
          lastSyncedAt: new Date().toISOString(),
        });
        log('info', mode === 'pull-then-push' ? 'sync complete.' : 'pushed local changes.');
      } else {
        persist(login, { lastSyncedAt: new Date().toISOString() });
        log('info', 'pulled.');
      }

      set({ status: 'idle', error: null });
    } catch (err) {
      const message = syncMessage(err);
      log('error', message);
      if (err instanceof GistAuthError) {
        // Spec §3.G: silently disable sync, leave analytics auth alone.
        persist(login, { enabled: false });
        set({ status: 'disabled', enabled: false, error: message });
      } else {
        set({ status: 'error', error: message });
      }
    }
  };

  // Inline helper for the "412 → repull → merge → retry once" flow.
  async function pushOrRetry(
    token: string,
    gistId: string,
    doc: UserData,
    expected: string,
  ): Promise<GistRef> {
    try {
      return await pushGist(token, gistId, doc, expected);
    } catch (err) {
      if (!(err instanceof GistConflictError)) throw err;
      log('warn', 'remote moved under us. merging.');
      const { doc: remoteDoc, ref } = await pullGist(token, gistId);
      const winner = resolveByUpdatedAt(doc, remoteDoc);
      if (winner === remoteDoc && remoteDoc.updatedAt !== doc.updatedAt) {
        await useUserDataStore.getState().replaceFromRemote(remoteDoc);
      }
      const finalDoc = useUserDataStore.getState().data;
      return await pushGist(token, gistId, finalDoc, ref.updatedAt);
    }
  }

  return {
    ...initialState,

    hydrate: (login) => {
      const cfg = loadSyncConfig(login);
      set({
        status: cfg.enabled ? 'idle' : 'disabled',
        enabled: cfg.enabled,
        gistId: cfg.gistId,
        lastSyncedAt: cfg.lastSyncedAt,
        remoteUpdatedAt: cfg.remoteUpdatedAt,
        error: null,
        log: getSyncLog(),
      });
    },

    enable: async () => {
      const auth = useAuthStore.getState();
      const token = auth.token;
      const login = auth.viewer?.login;
      if (!token || !login) return;

      // If the existing token already carries `gist`, skip the redirect.
      const scopes = await fetchGrantedScopes(token).catch(() => null);
      if (scopes && scopes.includes(SYNC_SCOPE)) {
        persist(login, { enabled: true });
        set({ status: 'idle', enabled: true, error: null });
        log('info', 'sync enabled.');
        await performSync('pull-then-push');
        return;
      }

      markSyncIntent(login);
      auth.reauthorize([SYNC_SCOPE]);
    },

    disable: () => {
      const login = useAuthStore.getState().viewer?.login;
      if (login) persist(login, { enabled: false });
      set({ status: 'disabled', enabled: false, error: null });
      log('info', 'sync disabled. cloud copy left in place.');
    },

    syncNow: async () => {
      await performSync('pull-then-push');
    },

    deleteCloudCopy: async () => {
      const auth = useAuthStore.getState();
      const token = auth.token;
      const login = auth.viewer?.login;
      const gistId = get().gistId;
      if (!token || !login || !gistId) return;
      try {
        await deleteGist(token, gistId);
        log('info', 'cloud copy deleted. local data still here.');
        persist(login, { gistId: null, remoteUpdatedAt: null, lastSyncedAt: null });
      } catch (err) {
        const message = syncMessage(err);
        log('error', message);
        set({ status: 'error', error: message });
      }
    },

    clearLog: () => {
      clearSyncLog();
      set({ log: [] });
    },
  };
});

// Mounts once at app startup. Hydrates per-account config, runs the boot
// pull, and wires the debounced push to local user-data writes.
export function SyncBoot(): null {
  const viewerLogin = useAuthStore((s) => s.viewer?.login ?? null);
  const authStatus = useAuthStore((s) => s.status);
  const hydrate = useSyncStore((s) => s.hydrate);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !viewerLogin) return;

    hydrate(viewerLogin);

    // Consume any pending re-auth intent now that the new token is in place.
    const intent = consumeSyncIntent();
    if (intent === viewerLogin) {
      void enableAfterReauth();
    } else if (useSyncStore.getState().enabled) {
      void useSyncStore.getState().syncNow();
    }
  }, [authStatus, viewerLogin, hydrate]);

  // Subscribe to local writes and debounce pushes.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastWriteId = useUserDataStore.getState().localWriteId;
    const unsubscribe = useUserDataStore.subscribe((state) => {
      if (state.localWriteId === lastWriteId) return;
      lastWriteId = state.localWriteId;
      if (!useSyncStore.getState().enabled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void useSyncStore.getState().syncNow();
      }, PUSH_DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}

async function enableAfterReauth(): Promise<void> {
  const auth = useAuthStore.getState();
  const token = auth.token;
  const login = auth.viewer?.login;
  if (!token || !login) return;
  const scopes = await fetchGrantedScopes(token).catch(() => null);
  if (!scopes || !scopes.includes(SYNC_SCOPE)) {
    appendSyncEvent({
      level: 'error',
      message: "github didn't grant the gist scope. sync stays off.",
    });
    useSyncStore.setState({ log: getSyncLog() });
    clearSyncConfig(login);
    return;
  }
  saveSyncConfig(login, { enabled: true });
  useSyncStore.getState().hydrate(login);
  appendSyncEvent({ level: 'info', message: 'sync enabled.' });
  useSyncStore.setState({ log: getSyncLog() });
  await useSyncStore.getState().syncNow();
}
