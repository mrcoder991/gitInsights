# Phase 6 — GitHub Pages SPA Deployment

**Goal**: ship the production build to GitHub Pages with a working SPA-routing fallback so deep links and the OAuth callback don't 404. Also confirm the Vercel proxy routing matches.

**Spec refs**: `spec.md §3.B SPA Routing Hack`, `spec.md §4.B OAuth Callback`, `spec.md §12 Phase 6`.

**Depends on**: Phase 1 (router), Phase 2 (callback handler).

**Screens touched**: all (deep-link refreshes must work).

## Acceptance criteria

- `npm run build` produces a Vite bundle that GH Pages can serve from a project subpath (e.g., `/gitInsights/`).
- Visiting `https://<user>.github.io/gitInsights/dashboard` directly (cold load, no SPA history) reaches the dashboard route, not a 404.
- The OAuth callback at `/gitInsights/callback?code=…` is handled by the React app, not GH Pages' raw 404.
- `index.html` contains the route-restoration script that pairs with `404.html`.
- The Vercel proxy is reachable from the production GH Pages origin (`ALLOWED_ORIGIN` matches exactly).

## Tasks

### Vite configuration
- [x] Set `base: '/gitInsights/'` in `vite.config.ts` (or read from env so dev still uses `/`).
- [x] Verify `<BrowserRouter basename={import.meta.env.BASE_URL}>` (from Phase 1) still works.

### SPA hack
- [x] Create `public/404.html` based on the rafgraph script linked in `spec.md §3.B`. Hard-code the path-segment count for `/gitInsights/`.
- [x] Add the matching restore script to `index.html` (also from rafgraph). Verify `?code=…` survives the round-trip so `/callback` still works.
- [ ] Test all deep links cold: `/dashboard`, `/settings`, `/u/octocat`, `/callback?code=demo` — none 404.

### GitHub Pages
- [x] Add `gh-pages` devDep + `npm run deploy` (`gh-pages -d dist -t`) so a manual deploy publishes to the `gh-pages` branch (incl. `.nojekyll`).
- [x] Enable Pages in repo settings; deploy from a `gh-pages` branch (or via Actions in Phase 7).
- [x] If `<gh-user>.github.io/gitInsights/` is the URL, register the **prod** OAuth App callback exactly as `https://<gh-user>.github.io/gitInsights/callback` (no trailing slash, no fragment).

### Vercel proxy
- [x] Confirm Vercel project is on its own domain (e.g., `gitinsights-proxy.vercel.app`).
- [x] `ALLOWED_ORIGIN` env var = `https://<gh-user>.github.io` (exact match — `Access-Control-Allow-Origin` reflection check).
- [x] Hit the proxy with a deliberately wrong `Origin`; verify it's rejected.

### Smoke test
- [x] From a fresh browser session: visit `https://<gh-user>.github.io/gitInsights/`, login, land on `/dashboard`, refresh — still on `/dashboard`. Logout — back to `/`.
- [x] Try `/gitInsights/u/torvalds` directly — does not 404, renders whatever placeholder the public profile has.

## Out of scope

- CI automation of the deploy — Phase 7 (this phase verifies a manual `npm run build && gh-pages -d dist` works; Phase 7 wires it to GitHub Actions on merge to `main`).
- Custom domain — not in v1.
