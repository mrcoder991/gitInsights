# Phase 7 — CI / CD & Quality Gates

**Goal**: every PR is automatically typechecked, linted, tested, and Lighthouse-scored. Every merge to `main` deploys the app to GH Pages and the proxy to Vercel. The bundled holidays dataset is auto-refreshed yearly.

**Spec refs**: `spec.md §2 Tech Stack (CI/CD)`, `spec.md §6 Public Holidays (build-time bundling)`, `spec.md §12 Phase 7`.

**Depends on**: Phase 0 (npm scripts), Phase 5 (holidays ingestion script), Phase 6 (deploy mechanics proven manually).

**Screens touched**: none directly.

## Acceptance criteria

- PR workflow runs typecheck + lint + unit tests + Playwright + bundle-size check; failing any blocks merge.
- Lighthouse CI runs on PR previews (or on `main` post-deploy); thresholds: PWA-light passing, Perf ≥ 90 mobile, A11y = 100, Best-Practices ≥ 95.
- `main` deploys the app to GH Pages.
- The Vercel proxy auto-deploys from `main` (Vercel's GitHub integration handles this; the workflow only validates env vars).
- A scheduled workflow refreshes `src/data/holidays/{region}.json` once a year and opens a PR.
- Secrets (`GITHUB_CLIENT_SECRET`, Vercel tokens, etc.) are managed in GitHub Actions / Vercel; never committed.

## Tasks

### PR workflow (`.github/workflows/ci.yml`)
- [ ] Trigger on `pull_request` and `push` to `main`.
- [ ] Matrix on Node 22 only.
- [ ] Steps: checkout → `actions/setup-node@v4` (uses `.nvmrc`) → `npm ci` → `npm run typecheck` → `npm run lint` → `npm run test -- --run` → `npm run build` → `npx playwright install --with-deps` → `npm run test:e2e`.
- [ ] Upload Playwright HTML report on failure as an artifact.
- [ ] Cache `~/.npm` and Playwright browsers between runs.

### Bundle-size budget
- [ ] Add `size-limit` (or `bundlesize`) configured for `dist/assets/*.js` budgets per `spec.md` perf goals (initial JS ≤ 250 KB gzipped is a reasonable starting point — adjust once Phase 5 lands).
- [ ] CI fails if budget is exceeded.

### Deploy workflow (`.github/workflows/deploy.yml`)
- [ ] Trigger on `push` to `main` (after CI passes).
- [ ] Build with `VITE_GITHUB_CLIENT_ID`, `VITE_PROXY_URL`, `VITE_OAUTH_REDIRECT_URI` injected from Actions secrets.
- [ ] Publish `dist/` to `gh-pages` branch via `peaceiris/actions-gh-pages@v3` (or use the GitHub Pages OIDC deployment action).
- [ ] Verify the deployed URL responds 200 within 60s.

### Vercel proxy
- [ ] Connect repo to Vercel; configure prod env vars (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_ORIGIN`).
- [ ] Add a smoke step in CI that POSTs the proxy with an obviously bad `code` and asserts it responds with GitHub's error JSON (proves the env wiring is alive without leaking real codes).

### Lighthouse CI
- [ ] Add `treosh/lighthouse-ci-action@v11` (or equivalent) running against the deployed GH Pages URL on `push` to `main`.
- [ ] Assertions per acceptance criteria (perf ≥ 90 mobile, a11y = 100, best-practices ≥ 95).
- [ ] Comment summary back to the commit / PR.

### Holidays auto-refresh
- [ ] Cron workflow (`schedule: '0 5 1 11 *'` — Nov 1 each year) runs the Phase 5 ingestion script, commits diffs, opens a PR titled `chore(holidays): refresh dataset for ${year + 1}`.
- [ ] PR template auto-assigns to a maintainer.

### Branch protection / repo hygiene
- [ ] Protect `main`: require CI green, 1 review, no force-push.
- [ ] Add CODEOWNERS pointing the spec / tasks folders to the maintainer.

## Out of scope

- Preview deploys per PR (would require Cloudflare Pages or moving the app to Vercel; deferred).
- Visual regression tests — revisit if Phase 5 tile layouts churn.
