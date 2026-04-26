# Phase 2 — Auth & Serverless Token Proxy

**Goal**: ship the full GitHub OAuth flow — the user clicks login, lands back on `/callback`, and the rest of the app sees an `access_token` for `viewer`. Includes the production-ready Vercel proxy that holds the client secret.

**Spec refs**: `spec.md §3.A Authentication`, `spec.md §3.B SPA Routing Hack`, `spec.md §3.C Token Proxy Contract`, `spec.md §3.H Error Handling`, `spec.md §4.A Login`, `spec.md §4.B Callback`, `spec.md §6 Security & Privacy`, `spec.md §12 Phase 2`.

**Depends on**: Phase 1.

**Screens touched**: `/` (login button + scope disclosure), `/callback` (token-exchange handler).

## Acceptance criteria

- A logged-out user landing on a protected route is redirected to `/`.
- Clicking "Login with GitHub" hits the GitHub authorize URL with the right `client_id`, `redirect_uri`, and scope set.
- After GitHub redirects back with a `code`, `/callback` POSTs to the Vercel proxy and stores the resulting `access_token` in `localStorage` under `gi.auth.token`.
- On boot, an existing token is validated with a cheap `viewer { login }` call; on `401` the app clears storage and bounces to `/`.
- The Vercel proxy rejects all non-`POST` methods (`405`), enforces an exact CORS origin, and never logs request bodies or tokens.
- Login screen explains in `spec.md §10` voice why we need `repo` (and that data stays in the browser).
- Logout clears all `gi.*` keys and the IndexedDB cache.

## Tasks

### OAuth App registration (one-time, manual)
- [ ] Register a **dev** OAuth App on GitHub: callback URL `http://localhost:5173/callback`, homepage `http://localhost:5173`.
- [ ] Register a **prod** OAuth App: callback URL `https://<gh-user>.github.io/gitInsights/callback`, homepage same minus `/callback`.
- [ ] Drop the dev `VITE_GITHUB_CLIENT_ID` into `.env.local`; document in `.env.example`.

### Vercel token proxy (`api/authenticate.ts`)
- [ ] Port `docs/oauth-token-proxy-example.js` to TypeScript; live at `api/authenticate.ts` for Vercel's filesystem routing.
- [ ] Accept `POST` only — `OPTIONS` for CORS preflight, everything else `405`.
- [ ] Enforce CORS via `ALLOWED_ORIGIN` env var; do **not** wildcard.
- [ ] Read `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from process env; fail closed if either is missing.
- [ ] Forward `code` to `https://github.com/login/oauth/access_token`, return GitHub's response body unchanged.
- [ ] Add a basic in-memory rate limit (token bucket per IP) to deter abuse.
- [ ] Verify logs contain no body, no token, no `code`, no PII — only status counts.
- [ ] Configure on Vercel: env vars for both dev and prod environments; redeploy.

### Frontend auth flow
- [ ] Build the login button that constructs the GitHub authorize URL with scopes `read:user user:email repo read:org` (per `spec.md §3.A`). `gist` is **not** requested here — Phase 5b adds it incrementally.
- [ ] Build `useAuth` hook (Zustand-backed) that exposes `{ token, viewer, status, login(), logout() }`.
- [ ] Implement `/callback`: read `?code=`, POST to `VITE_PROXY_URL`, store `access_token` under `gi.auth.token`, then `navigate('/dashboard', { replace: true })`. Strip the `code` from history.
- [ ] On app boot, if a token exists, validate with `viewer { login }`; on `401` clear and redirect to `/`.
- [ ] Implement `logout()`: clear all `gi.*` `localStorage` keys + IndexedDB cache + redirect to `/`.
- [ ] Add a route guard: protected routes (`/dashboard`, `/settings`) bounce to `/` when `useAuth().status !== 'authenticated'`.

### Login screen content
- [ ] Hero copy in `spec.md §10` voice (keep "Main Character" framing per spec §4.A).
- [ ] Scope disclosure block: each scope listed with a one-liner *why*. Be explicit that `repo` includes private repos and that data never leaves the browser.

### Error handling
- [ ] `/callback` shows a clear error state if proxy returns a non-200 (string follows §10 voice; offer "try again" that re-routes to `/`).
- [ ] Token-validation failure on boot is silent — just routes to `/` (no scary banner).

## Out of scope

- `gist` scope re-auth (Phase 5b).
- Settings UI for revoke (link only; the actual revoke happens on github.com).
- Refresh tokens (we use long-lived OAuth App tokens; revisit if/when we migrate to GitHub App).
