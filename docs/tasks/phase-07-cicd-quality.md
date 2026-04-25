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
- [x] Trigger on `pull_request` and `push` to `main`.
- [x] Node 22 via `.nvmrc` (single version).
- [x] Steps: checkout → `actions/setup-node@v4` (cache `npm`) → `npm ci` → `npm run typecheck` → `npm run lint` → `npm test` → `npm run build` → `npx size-limit` → `npx playwright install --with-deps` → Vercel smoke → `npm run test:e2e` (`test` = `vitest run`).
- [x] Upload Playwright HTML report on failure as an artifact.
- [x] Cache: `actions/setup-node` (npm) + `~/.cache/ms-playwright` for Playwright.

### Bundle-size budget
- [x] `size-limit` on `dist/assets/index-*.js` (gzip; 365 kB cap until the main chunk is under `spec` 250 kB after code-splitting).
- [x] CI fails if budget is exceeded.

### Deploy workflow (`.github/workflows/deploy.yml`)
- [x] Runs when **CI** succeeds for a `push` to `main` (`workflow_run`).
- [x] Build with `VITE_*` from Actions secrets.
- [x] Publish `dist/` with `peaceiris/actions-gh-pages@v4` and `GITHUB_TOKEN`.
- [x] Poll deploy URL (HTTP 200) then run Lighthouse (see below).

### Vercel proxy
- [x] Vercel side: import repo, set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_ORIGIN` in the Vercel dashboard (not in the repo). CI smoke is optional: set `VERCEL_PROXY_SMOKE_URL` + `VERCEL_PROXY_ALLOWED_ORIGIN` in GitHub secrets; otherwise the step exits 0 (skipped).
- [x] Smoke: `POST` invalid `code` with the production `Origin`, expect 400 and GitHub-style `{ "error": ... }` (`scripts/smoke-vercel-proxy.ts`).

### Lighthouse CI
- [x] `treosh/lighthouse-ci-action@v12` on the public GH Pages URL after deploy; mobile, assertions in `lighthouserc.json` (PWA at warn).
- [x] Assertions: performance ≥ 0.9, accessibility 1, best-practices ≥ 0.95.
- [x] Artifacts + temporary public storage; job step summary for links.

### Holidays auto-refresh
- [x] `schedule: 0 5 1 11 *` and `workflow_dispatch` → `fetch-holidays`, PR with title `chore(holidays): refresh dataset for <Y+1>`, body from `.github/holidays-refresh-pr-body.md`, assign `mrcoder991`.
- [x] (PR template: body file auto-filled by `peter-evans/create-pull-request`.)

### Branch protection / repo hygiene
- [x] (Manual) Protect `main`: require CI, optional review, no force-push — set in **GitHub → Settings** (self-merge allowed if you are admin).
- [x] `.github/CODEOWNERS` for `docs/`.

## Out of scope

- Preview deploys per PR (would require Cloudflare Pages or moving the app to Vercel; deferred).
- Visual regression tests — revisit if Phase 5 tile layouts churn.
