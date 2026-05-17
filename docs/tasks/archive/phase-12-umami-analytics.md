# Phase 12 — Umami Analytics

**Goal**: add cookie-free, privacy-first page-view analytics and lightweight feature-usage tracking via Umami Cloud. No cookies, no fingerprinting, no PII beyond the GitHub username the user already shared via OAuth. Analytics are stripped entirely from local dev builds.

**Spec refs**: `spec.md §10 Voice & Copy` (privacy disclosure tone), privacy page (`/privacy`).

**Depends on**: Phase 2 (OAuth / auth store), Phase 8 (privacy page).

**Screens touched**: `/privacy` (analytics disclosure update), all pages (Umami script tag in `index.html`).

---

## Acceptance criteria

- [ ] Umami Cloud script loads only in production builds (`VITE_UMAMI_WEBSITE_ID` present). Local dev emits no script tag and makes zero requests to `cloud.umami.is`.
- [ ] Page views are tracked automatically for all SPA route changes.
- [ ] Logged-in users are identified by GitHub username via `umami.identify()`.
- [ ] Custom events fire for: `login`, `dashboard-loaded`, `public-profile-viewed`, `api-rate-limited`.
- [ ] The `/privacy` page discloses Umami usage in the same voice as the rest of the page.
- [ ] TypeScript compiles clean (`npm run build`).
- [ ] DevTools network tab in local dev shows zero requests to `cloud.umami.is`.

---

## Tasks

### 1. Umami Cloud setup (manual)
- [ ] Sign up at [cloud.umami.is](https://cloud.umami.is) and create a website for `udaygirhepunje.github.io`.
- [ ] Copy the `data-website-id`.
- [ ] Add `VITE_UMAMI_WEBSITE_ID` as a GitHub Actions secret on the repo.
- [ ] Optionally enable the public share URL for the dashboard (transparency link on `/privacy`).

### 2. Script tag + Vite plugin
- [ ] Add `<script defer src="https://cloud.umami.is/script.js" data-website-id="%VITE_UMAMI_WEBSITE_ID%"></script>` to `index.html`.
- [ ] Extend the existing `htmlCanonicalOrigin` Vite plugin (or add a sibling) to strip the script tag when `VITE_UMAMI_WEBSITE_ID` is empty, and inject the real ID when present.
- [ ] Add `VITE_UMAMI_WEBSITE_ID=` to `.env.example` with a comment.
- [ ] Pass `VITE_UMAMI_WEBSITE_ID: ${{ secrets.VITE_UMAMI_WEBSITE_ID }}` in `.github/workflows/deploy.yml` build env.

### 3. TypeScript types
- [ ] Create `src/types/umami.d.ts` declaring the global `umami` object with `track()` and `identify()`.

### 4. Analytics wrapper
- [ ] Create `src/lib/analytics.ts` with `trackEvent()` and `identifyUser()` helpers that guard on `typeof umami !== 'undefined'`.

### 5. User identification on login
- [ ] In `src/store/auth.ts`, call `identifyUser()` after successful `bootstrap()` and `setSession()`.

### 6. Custom events
- [ ] `login` — fired in `setSession()` after successful token exchange.
- [ ] `dashboard-loaded` — fired in `DashboardPage` via `useEffect`.
- [ ] `public-profile-viewed` — fired in `PublicProfilePage` via `useEffect`.
- [ ] `api-rate-limited` — fired in `emitRateLimit()` in `src/api/events.ts`.

### 7. Privacy page update
- [ ] Replace the "we do not run one" analytics section in `src/pages/Privacy.tsx` with Umami disclosure.

### 8. Docs update
- [ ] Add phase 12 row to `docs/tasks/README.md` backlog table.
- [ ] Update the "No third-party runtime calls" cross-cutting concern to include `cloud.umami.is`.

---

## Out of scope

- Session replay, heatmaps, A/B testing (use PostHog if needed later).
- Server-side analytics or a custom tracking backend.
- Tracking settings changes or sync events (can be added incrementally).
- Consent banner (Umami is cookie-free and GDPR-compliant without one).
