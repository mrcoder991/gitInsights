import { create } from 'zustand';

import { clearAllQueryCache } from '../api/queryClient';
import {
  fetchViewer,
  GitHubAuthError,
  type Viewer,
} from '../lib/github';
import { clearAppIndexedDb, clearLocalStorageNamespace } from '../lib/storage';

// Phase 2 owns the auth lifecycle: token in localStorage under `gi.auth.token`,
// boot validation against `viewer { login }`, login redirect to GitHub's
// authorize endpoint, logout that wipes the world. Spec refs: §3.A, §3.H, §6.
//
// We hand-roll the persistence rather than going through Zustand's `persist`
// middleware because the token format is intentionally a single string under a
// well-known key (other code paths — analytics, future Octokit clients — read
// it directly without depending on a Zustand-shaped JSON envelope).

export const AUTH_TOKEN_STORAGE_KEY = 'gi.auth.token';

const DEFAULT_SCOPES = ['read:user', 'user:email', 'repo', 'read:org'] as const;
const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';

// Discriminated union so callers can switch on `status` without juggling
// "is the token nullish AND viewer non-null?" combinations.
//
// - `idle`            — no token, nothing in flight (logged out).
// - `validating`      — boot check or post-callback exchange in flight.
// - `authenticated`   — token validated, viewer loaded.
// - `error`           — last validation attempt failed (non-401 problem;
//                       401 transitions us straight back to `idle`).
export type AuthStatus = 'idle' | 'validating' | 'authenticated' | 'error';

type AuthState = {
  token: string | null;
  viewer: Viewer | null;
  status: AuthStatus;
  error: string | null;
  bootstrap: () => Promise<void>;
  setSession: (token: string) => Promise<Viewer>;
  login: () => void;
  logout: () => Promise<void>;
};

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

function writeToken(token: string): void {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

function dropToken(): void {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export function buildAuthorizeUrl(): string {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error(
      'OAuth env not configured: set VITE_GITHUB_CLIENT_ID and VITE_OAUTH_REDIRECT_URI in .env.local',
    );
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: DEFAULT_SCOPES.join(' '),
    // We don't yet implement state validation across the redirect (it would
    // require persisting a nonce in sessionStorage). Tracked as a follow-up
    // alongside the GitHub App migration noted in spec §3.A "Token Lifecycle".
  });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: readToken(),
  viewer: null,
  status: 'idle',
  error: null,

  // Called once from <App /> on mount. If a token is sitting in localStorage
  // from a prior session, validate it cheaply; on 401 we clear and route the
  // user back to `/` (the App-level effect handles the redirect — keeps this
  // store router-agnostic and easy to test).
  bootstrap: async () => {
    const token = readToken();
    if (!token) {
      set({ token: null, viewer: null, status: 'idle', error: null });
      return;
    }
    set({ token, status: 'validating', error: null });
    try {
      const viewer = await fetchViewer(token);
      set({ viewer, status: 'authenticated' });
    } catch (err) {
      if (err instanceof GitHubAuthError) {
        // Spec §3.H: 401 / token invalid → clear auth, redirect to `/`.
        // Silent — no scary banner (Phase 2 task §"Error handling").
        dropToken();
        set({ token: null, viewer: null, status: 'idle', error: null });
        return;
      }
      // Network blip or 5xx — keep the token (the user might just be offline)
      // but mark the boot as errored so the UI can decide whether to retry.
      set({ status: 'error', error: 'viewer_fetch_failed' });
    }
  },

  // Called by /callback after the proxy returns an access token. Persists,
  // validates, and resolves with the viewer so the callback can wait for a
  // confirmed session before navigating to /dashboard.
  setSession: async (token: string) => {
    writeToken(token);
    set({ token, status: 'validating', error: null });
    try {
      const viewer = await fetchViewer(token);
      set({ viewer, status: 'authenticated' });
      return viewer;
    } catch (err) {
      dropToken();
      set({ token: null, viewer: null, status: 'idle', error: null });
      throw err;
    }
  },

  login: () => {
    window.location.assign(buildAuthorizeUrl());
  },

  logout: async () => {
    // Order matters: clear storage BEFORE in-memory state so any other
    // store/effect that reads from localStorage during the same tick sees
    // the wiped values.
    clearLocalStorageNamespace();
    await clearAllQueryCache();
    await clearAppIndexedDb();
    set({ token: null, viewer: null, status: 'idle', error: null });
    void get;
  },
}));
