# Phase 8 — Polish & Launch

**Goal**: take everything from "feature complete" to "public link I'd share." Polish copy, ship the public-facing 404 / OG image / privacy page / launch README, and run the final QA pass.

**Spec refs**: `spec.md §4 App Sitemap` (404), `spec.md §6 Security & Privacy`, `spec.md §10 Voice & Copy`, `spec.md §12 Phase 8`.

**Depends on**: Phase 5 (analytics done), Phase 6 (deploy), Phase 7 (CI green).

**Screens touched**: `*` (in-app 404), `404.html` (GH Pages fallback), README, `/privacy` (new static route).

## Acceptance criteria

- 404 (in-app) is branded and on-voice.
- Open Graph + Twitter Card tags resolve to a real preview image when the URL is shared on Slack / X / iMessage.
- `README.md` at the repo root is publishable as the project's homepage on GitHub.
- A `/privacy` static page lists exactly what data the app stores, where, and how to wipe it (no template / boilerplate; on-voice).
- One end-to-end manual QA pass against the production URL with checklist below, all items signed off.

## Tasks

### In-app 404 + GH Pages 404 polish
- [ ] Brand the `*` route with §10-voice copy ("404. log off and try again.") and a single CTA back to `/dashboard` (or `/` if logged out).
- [ ] Make sure `public/404.html` (the SPA-routing one from Phase 6) **only** does the routing dance — never flashes a generic GH Pages error.

### Open Graph & favicon
- [ ] Generate a 1200×630 OG image with the app mark + tagline.
- [ ] Add `<meta property="og:*">` and `<meta name="twitter:*">` tags in `index.html`.
- [ ] Ship `favicon.svg`, `favicon.ico`, `apple-touch-icon.png` derived from the app mark.
- [ ] Verify with the Twitter Card validator and the Slack URL unfurler.

### Privacy page
- [ ] New route `/privacy` (no auth required).
- [ ] Content (in §10 voice):
  - what we ask GitHub for and why,
  - that the access token lives in `localStorage`,
  - that all analytics happen in your browser,
  - that opt-in sync writes a private gist to your account (and we never see it),
  - how to wipe everything (logout + clear local cache),
  - link to revoke at https://github.com/settings/applications.

### Repo `README.md`
- [ ] Replace the Phase 0 stub with a real README:
  - one-line pitch in §10 voice,
  - screenshot / GIF of the dashboard,
  - "what data we read" + "where it lives" table,
  - run-locally section (`nvm use`, `npm install`, `.env.local`, `npm run dev`),
  - link to `docs/spec.md` and `docs/tasks/`,
  - license + credits (Mantine, Styled Components, Recharts, Primer Primitives, Octicons, holidays dataset attribution).

### Final QA pass (production URL)
- [ ] Cold load `/` → login → `/dashboard` renders with real data.
- [ ] Refresh `/dashboard`, `/settings`, `/u/octocat` — none 404.
- [ ] Toggle theme between system / dark / light — instant, no flash.
- [ ] Settings round-trip: change workweek, streak mode, add PTO, add holidays region — all reflected on heatmap and tiles immediately.
- [ ] Export → wipe → import → state restored byte-identical.
- [ ] Enable sync from device A → log in on device B → settings appear within ~5 s.
- [ ] Disable sync — local data intact, cloud copy still present until "delete cloud copy" pressed.
- [ ] `Logout` clears all `gi.*` keys + IndexedDB cache; cloud gist untouched.
- [ ] Pull the network plug mid-fetch → cached dashboard still renders, error tile shows §10-voice retry.
- [ ] Trigger a rate-limit (use a throttled token) → banner appears, dashboard remains.
- [ ] Lighthouse on production passes the Phase 7 thresholds.
- [ ] Keyboard-only walkthrough: every action reachable, focus visible, no traps.
- [ ] `axe` clean on every route.

### Launch
- [ ] Tag `v0.1.0`. Write release notes in §10 voice.
- [ ] Soft launch: share with 5 friends, collect feedback, file follow-ups against `spec.md §11` open questions.

## Out of scope

- Public profile (`/u/:username`) launch — gated on the `spec.md §11` decision.
- Marketing site / blog post — outside this repo.
