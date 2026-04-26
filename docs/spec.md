# gitInsights - Technical Specification (OAuth + Client Side)

## 1. Vision

gitInsights is a zero-server developer identity dashboard built to feel like a native extension of GitHub. It uses OAuth to securely fetch user data and runs entirely in the browser to calculate deep analytics like Commit Momentum, future diff-weighted rollups, and WLB stats. 
Developers are often tracked by their employers for metrics like code contributions, code quality, and work-life balance. and most cases they don't get to see their own metrics. gitInsights helps developers understand their own metrics and make data-driven decisions to improve their work-life balance.

### Target Users

Working developers who spend most of their day inside private orgs and private repos. The product must be valuable for engineers whose entire commit history lives behind GitHub permissions, not just open-source contributors.

### Success Metrics

- Time-to-first-insight after login: < 10 seconds.
- Heatmap and Commit Momentum fully rendered for the last 12 months: < 5 seconds on cached load.
- Zero server-side persistence of user data or tokens.

### Non-Goals

- No team / org-wide analytics dashboards (single-user identity only).
- No paid tier, no billing.
- No server-side database. The Vercel function is for OAuth token exchange only.
- No write operations against the GitHub API (read-only product).

### Glossary

- **Commit Momentum**: rolling 365-day score: each qualifying commit contributes `RecencyWeight` only (recent work counts more). Computed from the same pure non-merge commit set as the Consistency Map — no per-commit diff hydration in v1. The Bento grid area is still labeled `EP` in code for layout stability.
- **Diff Delta**: a per-commit weight from additions, deletions, files touched, merge penalty, and vendor path ratio (see §6). Reserved for a **future** diff-weighted momentum mode; not multiplied into the shipped Commit Momentum total until per-commit stats are fetched.
- **WLB Audit**: Work-Life-Balance audit. Bucketed analysis of commit timestamps (hour-of-day, day-of-week, weekend ratio, late-night ratio).
- **Consistency Map**: 53-week × 7-day grid visualization of pure non-merge commits across all repos (public + private). Implemented as a custom CSS-grid component (no third-party heatmap library).
- **PTO (Paid Time Off)**: user-marked off-days. Excluded from all "expected work" denominators; rendered with a distinct color on the Consistency Map.
- **Public Holidays**: auto-imported off-days for the user's selected region(s) (e.g., US, IN, GB-ENG). Treated like PTO in every metric; differentiated only in tooltip / source.
- **Off-day**: any day excluded from "expected work" — i.e., a non-workday OR a PTO day OR a Public Holiday (minus user overrides). The single concept that drives streak skipping, Weekly Coding Days denominators, and WLB ratios.
- **Weekly Coding Days**: number of distinct days per ISO week with ≥ 1 contribution; off-days are excluded from both numerator and denominator.
- **Workweek**: the set of weekdays the user considers "working days". User-configurable; defaults to Mon–Fri. Drives weekend behavior across all time-based metrics.

## 2. Tech Stack (The GitHub-Native Stack)

- Language: TypeScript (strict mode).
- Framework: React 19 + Vite.
- Routing: React Router v6.
- Data layer: TanStack Query, persisted to IndexedDB via `@tanstack/query-async-storage-persister` + `idb-keyval`.
- GitHub client: `@octokit/graphql` and `@octokit/rest` (fallback for endpoints not in GraphQL).
- State: Zustand for UI state; TanStack Query owns server state.
- UI components: **Mantine** (`@mantine/core`, `@mantine/hooks`). All UI is built from Mantine primitives or thin wrappers/extensions of them. **No raw HTML components.** If a Mantine primitive doesn't quite fit, extend or compose Mantine — don't bypass it. Anything that smells like "should we add a Mantine sub-package?" or "should we drop down to a raw `<div>`?" gets raised for review before code lands.
- Component add-ons (pulled in as features land): `@mantine/dates` (PTO calendar, month-view picker, ranges), `@mantine/form` (settings forms), `@mantine/notifications` (toasts), `@mantine/modals` (confirm dialogs). All optional; add only when the owning feature ships.
- Custom styling: **Styled Components** sits *on top of* Mantine for the two narrow cases where Mantine's `style` / `classNames` / `styles` props aren't enough: (1) authoring app-specific custom CSS (animations, complex layout patterns, bespoke chart containers), and (2) extending a Mantine component into a domain primitive (e.g. `BentoTile = styled(Card)`, `StatNumber = styled(Text)`). Styled Components must always wrap a Mantine component or a Mantine layout primitive (`Box`, `Group`, `Stack`, `Paper`, `Card`, etc.) — never a raw `<div>` / `<span>` / `<button>`. All `styled(...)` definitions read from the Mantine theme (`({ theme }) => theme.colors...`); no hard-coded colors.
- Theming: Mantine's `MantineProvider` is configured from `@primer/primitives` — Primer's `dark` and `light` palettes, typography, and spacing tokens are mapped into Mantine's theme (`theme.colors`, `theme.spacing`, `theme.radius`, `theme.fontFamily`, …). Components inherit Primer-correct colors automatically; no hard-coded hex/rgb anywhere in the codebase. Styled Components share the same Mantine theme via `<ThemeProvider theme={mantineTheme}>` so `styled(Card)` definitions read the same tokens.
- Icons: GitHub Octicons via `@primer/octicons-react`. Mantine slots that accept icons (e.g. `Button leftSection`, `TextInput leftSection`, `ActionIcon`) take Octicon React nodes directly.
- Visuals: the Consistency Map ships as a custom CSS-grid component built on `styled(Box)` primitives (53-col × 7-row, `aspect-ratio: 1` cells, CSS variables `--gi-heatmap-0..4` for the intensity ramp). Light-mode empty-cell contrast vs Bento chrome is defined with `--gi-bento-tile-bg` (see **§4** Cross-cutting theming). Recharts (axes/tooltips driven by the Mantine theme; `@mantine/charts` is acceptable when it cleanly wraps the chart we need) handles the WLB histogram and other future charts.
- Date utilities: date-fns.
- Heavy compute: Web Workers (via Comlink) for Commit Momentum and WLB rollups.
- Authentication: GitHub OAuth 2.0 via Serverless Proxy (Vercel Function).
- Quality: ESLint, Prettier, Husky + lint-staged, TypeScript `--noEmit` in CI.
- Runtime: Node 22 LTS, npm.
- Deployment: GitHub Pages (app) + Vercel (token proxy).

## 3. Architecture Logic

### A. Authentication (The OAuth Flow)

To keep the app serverless while handling OAuth:

- User clicks Login: App redirects to GitHub OAuth authorize endpoint.
- Redirect Back: GitHub sends a code to our GH Pages URL.
- Token Exchange: The app sends this code to a tiny Token Proxy (hosted on Vercel/Netlify) to exchange it for an access_token.

Implementation Reference: See api/authenticate.js.

#### OAuth Scopes

Default (requested at first login):

- `read:user` — profile info.
- `user:email` — primary email for identity.
- `repo` — read access to private repos (commit history, diffs, metadata). Required; `public_repo` alone is insufficient for the product's value prop.
- `read:org` — discover the orgs the user belongs to so private contributions are countable.

Incremental (requested only when the user enables a feature that needs it):

- `gist` — required for cross-device settings sync (see §3.G). Requested via a re-authorization flow when the user toggles **Sync** on in `/settings`. Users who never enable sync never grant this scope.

The login screen must clearly explain why `repo` is requested and that data never leaves the browser. The sync opt-in must clearly explain that `gist` grants gitInsights read/write to **all** the user's gists (a GitHub OAuth limitation), and that gitInsights only reads/writes its own.

#### Token Lifecycle

- Access token is stored in `localStorage` under a single namespaced key (e.g. `gi.auth.token`).
- On boot, the app validates the token with a cheap `viewer { login }` query; on 401 it clears storage and redirects to `/`.
- Logout clears all `gi.*` keys plus the IndexedDB cache.
- We do not refresh tokens; GitHub user-to-server tokens for OAuth Apps are long-lived. (If we later migrate to a GitHub App, we'll add refresh handling.)

### B. SPA Routing Hack (GitHub Pages)

We use the redirection hack to handle the OAuth callback URL and nested paths:

- Link: https://github.com/rafgraph/spa-github-pages/blob/gh-pages/index.html
- 404.html: Catches callback routes and redirects to index.html with the code in query params.
- index.html: Restores the state for the React app.

### C. Token Proxy Contract (Vercel Function)

Reference implementation: `docs/oauth-token-proxy-example.js` (illustrative, not final).

- Hosting: Vercel, file at `/api/authenticate.ts` in a separate proxy repo (or same repo if we use Vercel for both).
- Method: `POST` only; all other methods → `405`.
- Request body: `{ "code": string }`.
- Success response: `{ "access_token": string, "token_type": "bearer", "scope": string }` from GitHub, returned as-is.
- Error response: `{ "error": string, "error_description"?: string }` with appropriate `4xx`/`5xx`.
- CORS: `Access-Control-Allow-Origin` restricted to the GH Pages origin (no `*`).
- Env vars (Vercel dashboard): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_ORIGIN`.
- Logging: no request bodies, no tokens, no PII. Only counters / status codes.
- Should be rewritten in TypeScript and add the CORS allowlist + a basic in-memory rate limit before production.

### D. Rate Limiting & Caching

- GitHub GraphQL: 5,000 points/hour authenticated. We treat this as a hard ceiling.
- TanStack Query is the single read path for all GitHub data.
- Persist the query cache to IndexedDB so repeat sessions don't re-spend the rate budget.
- Default `staleTime`: 1 hour for contribution/commit history, 24 hours for repo metadata, 5 minutes for `viewer`.
- On `403` rate-limit response: surface a non-blocking banner with the reset time and serve cached data.
- Pagination: cursor-based via GraphQL `pageInfo`; cap at a configurable max (e.g., 5,000 commits per repo per fetch) with a "load more" affordance.

### E. Heavy Compute (Web Workers)

Commit Momentum and WLB rollups can iterate over tens of thousands of commits. Run them off the main thread:

- One worker module per heavy job (`commitMomentum.worker.ts`, `wlbAudit.worker.ts`).
- Wrap with Comlink for ergonomic typed calls.
- Workers receive raw commit arrays and return summarized metrics; no network calls inside workers.
- Memoize results in IndexedDB keyed by `(userId, repoId, sha-range)`.

### F. Local User Data (PTO, Preferences)

Some product data is user-authored, not GitHub-derived (PTO calendar, streak mode, bento layout, tile toggles). It must persist locally without a backend:

- Storage: IndexedDB store `gi.user-data`, keyed by `viewer.login` so multiple GitHub accounts on the same browser stay isolated.
- Shape: a single versioned JSON document (`schemaVersion`, `preferences`, `pto`); migrations live alongside the schema.
- Cross-device sync: optional, opt-in, via a private GitHub Gist owned by the user. See §3.G for the full sync model.
- Export / Import: a JSON download/upload in `/settings` so users can move data between browsers manually (works regardless of whether sync is enabled).
- Lifecycle: cleared by "Clear local cache" and full logout. Never sent to any server (including the Vercel proxy).

### G. Cross-Device Sync (Optional, GitHub Gist)

For a consistent experience across machines, users can opt in to syncing their `gi.user-data` document via a **private GitHub Gist** in their own GitHub account. Off by default; enabling it is the only thing that triggers the `gist` OAuth scope grant.

#### What syncs

The entire `gi.user-data` document, which includes everything the user can configure:

- `theme` (`system` / `dark` / `light`).
- `workweek.workdays`.
- `streakMode` (`strict` / `skip-non-workdays` / `workdays-only`).
- `pto[]` (PTO calendar entries).
- `bento` (tile layout, toggles, ordering).
- `preferences` (any future user-tunable settings).

#### What does NOT sync

- Auth token (per-device by definition; never leaves the browser it was issued on).
- TanStack Query / IndexedDB cache of GitHub API responses (per-device performance cache, not user data).
- Any transient UI state (scroll position, last-viewed tab, dialog state).
- A per-device `deviceId` (random UUID generated on first run, used for conflict heuristics).

#### Storage shape

- One private Gist per GitHub account, with a stable description `gitinsights:user-data:v1` and a single file `gi.user-data.json`.
- The gist body is the same versioned JSON document used locally (`schemaVersion`, `updatedAt`, `lastWriterDeviceId`, plus the fields above).
- Discovery on a new device: `GET /gists` and find the one matching the description; if none exists, create it on first push.

#### Sync triggers

- **Pull**: on app boot (after auth), and when the user clicks **Sync now** in `/settings`.
- **Push**: debounced (≈ 2 s) after any local change to `gi.user-data`; also on explicit **Sync now**.
- All sync work runs in the background; the UI never blocks on it.

#### Conflict resolution

- Last-write-wins by `updatedAt` ISO timestamp embedded in the document.
- On pull: if remote `updatedAt` > local `updatedAt`, replace the local document (except for the local `deviceId`).
- On push: write local document with refreshed `updatedAt` and current `lastWriterDeviceId`. Use the gist API's `If-Match`/`updated_at` to detect a concurrent remote update; on mismatch, re-pull, re-merge using last-write-wins, and retry once.
- For the rare two-devices-edit-within-seconds case we accept losing one side's last edit; users can recover via the JSON export/import.

#### Failure & offline

- Sync failures are non-fatal: the local document is the source of truth on-device. A small status indicator in `/settings` shows last-sync time and any error.
- If the `gist` scope is revoked from outside the app, sync silently disables itself and the indicator shows "scope revoked, re-enable sync to continue."

#### Disable / wipe

- Toggling sync off in `/settings` stops all push/pull but **does not** delete the remote gist by default.
- A separate destructive action **Delete cloud copy** removes the gist; copy must be in the §10 voice and explicit ("delete the cloud copy. local data stays.").
- Logout and "Clear local cache" never touch the remote gist.

#### Privacy trade-off (must be disclosed in the opt-in dialog)

- The `gist` scope grants gitInsights read/write to **all** of the user's gists (GitHub OAuth limitation; we cannot scope to a single gist).
- The gist itself is **private** but stored on GitHub's servers — meaning settings (theme, workweek, PTO dates) leave the user's device. This is the one place the "all data stays in the browser" promise is relaxed, and the opt-in must say so plainly.
- Commit data, diffs, and computed analytics are never written to the gist — only user-authored settings.

### H. Error Handling Strategy

- Network / 5xx: retry with TanStack Query defaults (3 attempts, exponential backoff), then show inline error tile with retry button.
- 401 / token invalid: clear auth, redirect to `/`.
- 403 rate limit: banner with reset time, keep showing cached data.
- 403 SAML / SSO required: actionable message linking to the user's org SSO authorization page.
- Empty data (new account, no commits): friendly empty state per tile, never a blank screen.
- All error and empty-state strings are written in the voice defined in §10 — direct, blunt, never generic ("github rate-limited us. resets at 14:32." not "An error occurred.").

## 4. App Sitemap (The Pages)

### A. Landing / Login Page (/)

- Hero section explaining the "Main Character" dev energy with gitInsights branding.
- Large "Login with GitHub" button.
- Scope disclosure block: lists the OAuth scopes we request and a one-liner on why each is needed.

### B. OAuth Callback (/callback)

- Reads `?code=` from the URL, POSTs to the Vercel proxy, stores the resulting `access_token`, then redirects to `/dashboard`.
- Loading and error states only; not user-facing for long.

### C. Main Analytics Dashboard (/dashboard)

- The Bento Grid: Your private view of all stats.
- Features: Commit Momentum (Bento `EP`), Consistency Map, Weekly Coding Days, WLB Audit, and Tech Stack.
- The Consistency Map renders PTO days in a distinct color (see §6) so the user can visually separate "rested" from "missed".
- Each tile defines its own loading skeleton, empty state, and error state.

### D. Live Public Profile (/u/:username)

- The Showoff Page: A read-only, aesthetic version of the dashboard for public flex.
- _Implementation model TBD — revisit later._

### E. Customization & Settings (/settings)

- View Config: Toggle Bento tiles and manage privacy.
- Theme: pick `system` (default) / `dark` / `light`. `system` follows the OS preference live (responds to `prefers-color-scheme` changes without a reload).
- Workweek: pick which weekdays count as working days (default Mon–Fri). Presets for Mon–Fri, Sun–Thu, and Mon–Thu (4-day week), plus a custom multi-select of any weekday combination. The chosen workweek is what every "weekend" reference in §6 actually resolves to.
- Streak mode: pick `strict` / `skip-non-workdays` (default) / `workdays-only` — see §6 Consistency for semantics.
- PTO Calendar: a month-view picker to mark/unmark off-days. Supports single-day toggle, range selection (e.g., Dec 23 – Jan 2), an optional short label per entry ("Vacation", "Sick", "Public Holiday"), and a list view to bulk-edit/delete. Marked days update every dependent metric live.
- Public Holidays: a region multi-select (search + ISO 3166 codes; e.g., US, IN, GB-ENG). Off by default. Once enabled, the chosen region's holidays auto-fill as off-days across every metric and on the heatmap. A list view shows upcoming holidays for the year; each row has an "I worked that day" override that flips it back to a workday without disabling the whole feature. Voice copy in §10.
- Sync (cross-device): off by default. A toggle starts the `gist`-scope re-auth flow described in §3.G; once enabled, shows last-sync time, a **Sync now** button, and a destructive **Delete cloud copy** action. Status messages follow §10 voice ("synced 12 seconds ago", "couldn't reach github. local data is fine.").
- Data controls: "Clear local cache", "Logout", "Revoke GitHub authorization" (link to GitHub settings), "Export user data (JSON)", "Import user data (JSON)".

### F. Not Found (\*)

- Branded 404 inside the app for any unmatched route. Distinct from the GH Pages `public/404.html` SPA-redirect file.

### G. Global app header (shared `AppShell`)

- **Code:** `src/components/AppShell.tsx` — `MantineAppShell` wraps all routes: fixed-height header, main with landing vs padded `Container` layout, `RateLimitBanner` placement as implemented.
- **Signed-in — at `sm` and wider (Mantine `sm` = 48em):** A centered row of pill `Button`s + `RouterNavLink` for **dashboard**, **profile** (`/u/:login`), and **settings**. The row sits in a `Group` with `visibleFrom="sm"` so it does not occupy horizontal space on narrow phones (avoids clipped labels and crowding next to the cache pill and avatar).
- **Signed-in — below `sm`:** The pill row is hidden. **dashboard**, **profile**, and **settings** are listed in the **avatar** `Menu` instead: they render after the account identity block (`Menu.Label`), before **privacy**, with dividers separating blocks. Active route uses the same semantics as the pills (`menuNavItemStyles` + pathname checks). Whether those three items appear in the dropdown follows `useMediaQuery('(min-width: ${theme.breakpoints.sm})', …, { getInitialValueInEffect: false })` so it stays aligned with the pill row’s `visibleFrom="sm"`: at `sm+` the menu lists identity → **privacy** → **log out** only (primary routes stay in the header pills); below `sm` the same three routes are included after the identity block. Menu width is ~240px; choosing a link closes the menu via normal `Menu.Item` behavior.
- **Signed-in — right cluster:** Cache freshness pill (green status dot + `cache · …` copy; label text uses `visibleFrom="xs"`), then the avatar `Menu` target (`Avatar` with `aria-label` derived from `viewer.login`). Pill `Button`s use `headerNavPillStyles` so light-mode `subtle` + `gray` labels resolve to Primer foreground tokens (`--gi-fg-default`).
- **Signed-out:** A flex spacer plus inline **privacy** and **log in** (`Button`s); there is no hamburger or drawer for marketing/auth chrome.
- **Brand:** Favicon + lowercase **gitinsights** `Text` link to `/`.
- **A11y:** Avatar-triggered `Menu` follows Mantine’s menu keyboard model and dismisses on `Escape`. The avatar trigger exposes a descriptive `aria-label` (e.g. `{login} account menu`).

### Cross-cutting UI Requirements

- Responsive: works from 360px mobile up to ultra-wide desktop. Bento collapses to a single column on narrow viewports; the global header follows the responsive rules in **§4.G** so navigation stays usable without clipped labels.
- Accessibility: WCAG 2.1 AA. Keyboard navigable, visible focus rings, charts have text/table fallbacks, color is never the only signal.
- Component policy: **every UI element is a Mantine component or a thin extension of one.** We do not author raw HTML components for things Mantine already covers (buttons, inputs, modals, popovers, tooltips, tables, badges, menus, drawers, layout primitives, cards, etc.). When Mantine doesn't ship the exact primitive we need, extend or compose Mantine — Styled Components is the allowed extension mechanism, but `styled(...)` must wrap a Mantine component or layout primitive (`Box`, `Group`, `Stack`, `Paper`, `Card`, …), never a raw HTML element. Custom CSS (animations, bespoke layout, chart containers) is authored via Styled Components on top of those Mantine primitives. If even that feels wrong, raise it for review **before** writing custom HTML. Third-party charts (Recharts) are wrapped in a Mantine container and themed via the Mantine theme.
- Theming: ships with both dark and light themes, built on GitHub Primer color tokens (Primer Primitives `dark` + `light` palettes) and consumed through the Mantine theme. Default is `system`, following `prefers-color-scheme`; user can override to `dark` or `light` from `/settings`. The chosen mode persists in `gi.user-data` (see §3.F) and toggles Mantine's `colorScheme`. All themed surfaces — Bento tiles, the Consistency Map intensity scale (`--gi-heatmap-0..4`), Recharts axes/tooltips, focus rings, status colors — resolve through the Mantine theme; no hard-coded colors. `<meta name="color-scheme" content="dark light">` set in `index.html` so native form controls and scrollbars match.
- **Bento tile surface + heatmap level 0 (light mode):** `cssVariablesResolver` in `src/theme/mantine-theme.ts` defines `--gi-bento-tile-bg`: in **light** it maps to Primer `bgMuted` (off-white card), in **dark** to `bgSubtle` (same effective fill Bento used before the token split). `BentoTile` (`src/components/Bento/BentoTile.tsx`) uses `background: var(--gi-bento-tile-bg)`. **Light** `--gi-heatmap-0` is Primer `bgSubtle`, so empty Consistency Map cells are a slightly darker grey than the tile — a GitHub-style grid where level 0 is visible without looking washed out. **Dark** `--gi-heatmap-0` remains `bgMuted` on the dark bento surface. Levels **1–4** stay the Primer green ramp (`primerLight` / `primerDark` greens) as before. Other settings surfaces that still use `--gi-bg-subtle` are unchanged.

## 5. Security & Privacy

- Client Secret remains hidden in the proxy.
- All data processing happens locally in the browser.
- Access token lives only in the user's browser (`localStorage`); never sent anywhere except `api.github.com`.
- User-authored data (PTO calendar, preferences) lives only in IndexedDB on the user's device by default; the only exception is **opt-in cross-device sync** (§3.G), which writes the same document to a **private Gist in the user's own GitHub account** — and the opt-in dialog must say so plainly. Commit data, diffs, and computed analytics are never synced.
- Vercel proxy logs no bodies, no tokens, no PII; CORS is locked to the GH Pages origin.
- Public profile pages (when implemented) require explicit owner opt-in and never expose private repo data.
- No third-party analytics, trackers, or fonts loaded from external CDNs.
- `<meta http-equiv="Content-Security-Policy">` set in `index.html` to restrict script/style/connect sources to GitHub + the proxy origin.
- Logout clears `localStorage` and IndexedDB; settings page links the user to GitHub's "Authorized OAuth Apps" page to fully revoke.

## 6. Data Model & Metric Definitions

Formal definitions so two engineers implement the same thing.

### Workweek

User-authored set of weekdays considered "working days". Single source of truth for "the user was expected to work on this day-of-week".

- Data model: `Workweek = { workdays: number[] }` where each entry is `0..6` (`0 = Sunday`, `6 = Saturday`). Default: `[1, 2, 3, 4, 5]` (Mon–Fri). Stored under `gi.user-data` (see §3.F).
- Resolution: a date is a **workday** iff its local-TZ day-of-week is in `workdays`; otherwise it is a **non-workday** (replaces the previous hard-coded "weekend" concept).
- Effects across metrics: every `§6` reference to "weekend" / "Sat-Sun" resolves through this set. Examples:
  - WLB `WeekendRatio` is renamed conceptually to `NonWorkdayRatio` and uses `workdays` to decide what counts.
  - Streak modes use `workdays` to decide what's "evaluable".
  - Weekly Coding Days uses `workdays` to compute the denominator.
- Edge cases:
  - Empty `workdays` is rejected by the UI (must have ≥ 1 day).
  - `workdays = [0..6]` (every day) collapses `strict` and `skip-non-workdays` to the same behavior — that's fine and explicit.
- a11y: settings UI must label days by name, not just position, and respect the user's locale for first-day-of-week ordering.

### PTO (Paid Time Off)

User-authored set of off-days. Single source of truth for "the user was not expected to work".

- Data model: `Pto = { date: 'YYYY-MM-DD' (local TZ), label?: string, kind?: 'vacation' | 'sick' | 'holiday' | 'other' }[]`. Stored under `gi.user-data` (see §3.F).
- Resolution: a day is a PTO day iff its local-TZ `YYYY-MM-DD` appears in the set.
- Effects across metrics (single, consistent rule: **PTO days are excluded from any "expected work" denominator and do not break streaks**):
  - **Streak (Consistency)**: PTO days are skipped — they neither extend nor break the streak, in every streak mode.
  - **Weekly Coding Days**: PTO days are removed from both the count of active days and the weekly denominator (a 5-day work week with 1 PTO day is evaluated against 4 expected days).
  - **Commit Momentum**: commits authored on PTO days **still count** toward the score (the work is real), but PTO days are excluded from any "active days" or "consistency multiplier" used by momentum-derived UI.
  - **WLB Audit**: see WLB additions below — PTO surfaces both as a positive signal (days actually taken) and a violation signal (commits made on declared PTO).
  - **Tech Stack**: unaffected (PTO only filters time-based metrics).
- Heatmap rendering: PTO days are drawn with a distinct color/pattern on the Consistency Map regardless of commit count, so users can see rest at a glance. If a PTO day also has commits, the cell shows the PTO color with a small "violation" dot overlay. ("Commits" here means non-merge commits — see §7 for the exact data source.)
- a11y: PTO state must be exposed via tooltip text and the data-table fallback (color is never the only signal).

### Public Holidays

Auto-imported off-days for the user's selected region(s), so users don't have to mark national holidays manually. Treated identically to PTO at consumption time; differentiated only in source, settings UI, and tooltip copy.

#### Data source (build-time, not runtime)

- Holiday data is **bundled with the app** at build time as static JSON, sourced from an open-source dataset (e.g., the `nager/Nager.Date` GitHub repo, which is permissively licensed). No third-party API call at runtime — keeps the "no third-party trackers / runtime calls" promise from §5 intact and works offline.
- Build pipeline regenerates a sliding window: current year and current ± 1 year (3 years total). A scheduled GitHub Actions job rebuilds yearly so the bundled data stays current.
- Files live at `src/data/holidays/{ISO-3166-region}.json`, e.g., `US.json`, `IN.json`, `GB-ENG.json`. Each entry: `{ date: 'YYYY-MM-DD', name: string, regional?: boolean }`.
- v1 region granularity: country-level for all supported countries; sub-region (state/province) where the dataset provides it. Regions not covered surface "no holiday data for this region — use a custom .ics import (coming later) or mark days manually as PTO."

#### User settings

- `holidays.regions: string[]` — zero or more region codes (ISO 3166-1 alpha-2, optionally with a `-` subdivision). Default: `[]` (off). Multi-select supported for users who care about more than one (e.g., a US-based engineer working with an Indian team).
- `holidays.overrides: { date: 'YYYY-MM-DD', treatAs: 'workday' }[]` — per-date opt-out so a user who actually worked on Christmas can untick that single day without disabling holidays entirely. Override list is small and user-authored; never auto-populated.

#### Resolution (the single rule)

A date is a **holiday** iff:
- it appears in the union of bundled datasets for `holidays.regions` for that year, AND
- it is not present in `holidays.overrides` with `treatAs: 'workday'`.

Holidays count as **off-days** everywhere off-days are referenced (streak skip, Weekly Coding Days denominator, WLB ratio denominators). The implementation uses a single `isOffDay(date)` helper that returns true if the date is a non-workday OR a PTO day OR a holiday — every metric calls this one function.

#### Effects across metrics (mirrors PTO)

- **Streak (Consistency)**: holidays skip — they never extend or break the streak, in every streak mode.
- **Weekly Coding Days**: holidays are removed from both numerator and denominator (a 5-day workweek with one holiday is evaluated against 4 expected days; with one holiday + one PTO day, against 3).
- **Commit Momentum**: commits on holidays **still count** toward the score; holidays are excluded from any auxiliary "active days" calculations.
- **WLB Audit**: a "you committed on a public holiday" violation count is included in the existing PTO-violation framing — same vibe, different source label in the tooltip ("New Year's Day" vs "PTO: Vacation").
- **Tech Stack**: unaffected.

#### Heatmap rendering

- Holiday cells reuse the **PTO color** on the Consistency Map (off-day = off-day; one visual concept, less noise) but the tooltip and a11y label name the source: "Public Holiday: Christmas Day" vs "PTO: Vacation".
- Same "violation dot" overlay as PTO when commits exist on a holiday.
- An icon (Octicon) in the legend disambiguates PTO from Holiday for users who care.

#### Sync

- `holidays.regions` and `holidays.overrides` sync via §3.G (they're settings).
- The bundled holiday entries themselves do **not** sync — every device computes them locally from the same shipped dataset, keyed by region. This keeps the synced document tiny and version-stable.

#### Voice

- Settings copy: "pick your region. national holidays auto-mark as off-days. you can still untick any one if you actually worked."
- Override one-liner: "marked dec 25 as a workday. weird flex but ok."

### Commit Momentum

`CommitMomentum = sum over commits in window of RecencyWeight(commit)`

- **Commits in scope**: same definition as the Consistency Map — pure non-merge commits attributed to the viewer (`GET /search/commits` with `merge:false`). Each commit contributes **one unit** scaled only by recency (no line-level diff size in v1).
- **Window**: rolling 365 days (commits older than the window have `RecencyWeight` 0 and are omitted).
- **`RecencyWeight`**: linear decay from 1.0 (now) to 0.25 (365 days ago) within the window; see implementation in `src/analytics/diffDelta.ts` (`recencyWeight`).
- Commits authored on off-days (PTO or Public Holiday) are included in the sum; off-days are excluded from any auxiliary "active days in window" used by momentum-derived UI.

### Diff Delta (future: diff-weighted momentum)

When the app hydrates per-commit additions/deletions/files (e.g. via `repos.getCommit`), Commit Momentum **may** be extended to weight each commit by diff size:

`CommitMomentum_diff = sum over commits in window of DiffDelta(commit) * RecencyWeight(commit)`

`DiffDelta = log2(1 + additions + deletions) + 0.5 * filesChanged − MergePenalty − VendorPenalty`

- `MergePenalty`: 5 if commit is a merge commit, else 0.
- `VendorPenalty`: 0.9 multiplier if > 80% of changed paths match vendor patterns (`node_modules/`, `vendor/`, `*.lock`, `dist/`).
- Floored at 0.

Until that mode ships, `DiffDelta` remains implemented as a pure function for tests and forward compatibility (`src/analytics/diffDelta.ts`).

### WLB Audit

For every commit's authored timestamp (in user's local TZ):

- `LateNightRatio` = commits between 22:00–05:59 / total commits.
- `NonWorkdayRatio` = commits on non-workdays (per the user's configured workweek, see §6 Workweek) / total commits. Replaces the prior "weekend"-only definition.
- `HourHistogram` = 24-bucket count.
- `LongestStreakDays` and `LongestBreakDays` from the contribution calendar.

PTO-aware additions:

- `PTODaysTaken` = count of PTO days in the window — a positive signal we celebrate in the tile copy.
- `PTOHonoredRatio` = `(PTODaysTaken − PTODaysWithCommits) / PTODaysTaken` — how often the user actually unplugged on declared off-days. Undefined when `PTODaysTaken === 0`.
- `PTOViolationCount` = number of PTO days that contained ≥ 1 commit, surfaced as a soft warning ("you committed on 3 of your 12 PTO days").
- `NonWorkdayRatio` and `LateNightRatio` denominators exclude commits made on off-days (PTO or Public Holiday), so a single "vacation hotfix" or "holiday push" doesn't skew the ongoing trend.
- Every metric on the WLB tile must ship with a one-liner verdict written in the voice defined in §10 (blunt, anti-burnout, no moralizing).

### Weekly Coding Days

A per-ISO-week count of distinct days with ≥ 1 contribution, evaluated in the user's local TZ.

- `expectedDays(week)` = days in that week that are workdays (per §6 Workweek) AND are not off-days (i.e., not PTO and not a Public Holiday — see §6 PTO and §6 Public Holidays).
- `activeDays(week)` = `expectedDays(week)` ∩ days with ≥ 1 contribution.
- `WeeklyCodingDays(week)` = `|activeDays(week)|` (numerator) presented over `|expectedDays(week)|` (denominator), e.g. "4 / 5" for a Mon–Fri user with one PTO day → "x / 4".
- Tile shows: current week, previous week, 12-week sparkline trend, all-time best week.

### Consistency

- Streak: consecutive days with ≥ 1 contribution.
- "Active day" = any contribution type counted by GitHub's contribution calendar.

#### Streak Modes (user setting)

The product is built for working professionals; resting outside of working days is healthy, not a streak-breaker. The Consistency tile exposes a streak mode toggle in `/settings`. All modes resolve "non-workday" through the user's configured workweek (see §6 Workweek):

- `strict` — every calendar day must have ≥ 1 contribution. Non-workdays count and can break the streak. (Classic GitHub behavior.)
- `skip-non-workdays` (default for new accounts) — non-workdays are **ignored entirely**: they neither extend nor break the streak. A streak survives a "no commits" weekend (or whatever the user's off-days are), but a missed workday still breaks it.
- `workdays-only` — only workdays are evaluated. Contributions made on non-workdays are not counted toward the streak even if present (useful for users who want off-days to be truly off the books).

Algorithm (for `skip-non-workdays`): walk back day-by-day from today; if a day is a non-workday **or an off-day (PTO or Public Holiday)**, skip without resetting the counter; if it's an evaluable workday with no contribution, the streak ends; otherwise increment. The `strict` and `workdays-only` modes apply the same off-day skip rule on top of their own workweek handling.

Notes:
- The chosen mode applies to **current streak**, **longest streak**, and the streak indicator on the Consistency Map.
- Off-days (PTO and Public Holidays — see §6 PTO and §6 Public Holidays) always skip in every mode — they never extend or break a streak.
- The configured workweek determines what "non-workday" means; with the default Mon–Fri workweek this matches the prior Sat/Sun behavior.

### Tech Stack Inference

- Aggregate `repository.languages` weighted by bytes across the user's owned + contributed repos in the last 12 months.
- Top N languages displayed; long tail grouped as "Other".

## 7. GitHub API Surface

Primary GraphQL queries (names are illustrative):

- `viewerProfile`: `viewer { login, name, avatarUrl, createdAt }`.
- `viewerContributions(from, to)`: `viewer { contributionsCollection(from, to) { contributionCalendar { totalContributions, weeks { contributionDays { date, contributionCount } } }, commitContributionsByRepository { repository { nameWithOwner, isPrivate }, contributions { totalCount } } } }`. Used for "all activity" surfaces only — **not** the Consistency Map (`contributionCount` includes PRs, issues, reviews, comments, approvals; the heatmap wants pure commits).
- `viewerOrgs`: `viewer { organizations(first: 50) { nodes { login } } }`.
- `repoCommitHistory(owner, name, since, until, after)`: paginated commit history with `additions`, `deletions`, `changedFilesIfAvailable`, `committedDate`, `author`.
- `repoLanguages(owner, name)`: top languages by bytes.

REST endpoints via `@octokit/rest`:

- `GET /search/commits` with `q=author:{login} author-date:{from}..{to} merge:false` — **the Consistency Map data source.** Returns pure non-merge commits authored by the viewer in the window, public + private. Adaptive pagination: try the whole window in one query, recursively bisect the date range when `total_count` exceeds GitHub's 1000-result cap. Aggregated client-side into `Record<isoDate, count>`. Note GitHub's contribution-graph caveat applies: only commits whose author email is one of the viewer's verified emails are attributed.
- `GET /user` — primary email if not exposed via GraphQL.
- `GET /repos/{owner}/{repo}/commits/{sha}` — file-level diff stats when GraphQL omits them.

Cache TTLs: see §3.D.

## 8. Folder Structure

```
gitInsights/
├── api/                          # Vercel function(s)
│   └── authenticate.ts
├── public/
│   ├── 404.html                  # SPA redirect hack
│   └── favicon.svg
├── src/
│   ├── analytics/                # pure functions: commitMomentum, diffDelta, wlb, consistency
│   ├── api/                      # octokit clients, query definitions
│   ├── components/               # presentational components
│   ├── hooks/                    # useAuth, useGitHub, useBentoConfig
│   ├── pages/                    # route components
│   ├── store/                    # zustand stores
│   ├── theme/                    # Mantine theme config + Primer token mapping (dark/light)
│   ├── workers/                  # commitMomentum.worker.ts, wlbAudit.worker.ts
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── unit/
│   └── e2e/
├── .env.example
├── .nvmrc
├── package.json
└── vite.config.ts
```

## 9. Environment Variables

Frontend (Vite, must be prefixed `VITE_`):

- `VITE_GITHUB_CLIENT_ID` — public OAuth App client ID.
- `VITE_PROXY_URL` — full URL to the Vercel token-exchange function.
- `VITE_OAUTH_REDIRECT_URI` — the GH Pages callback URL.

Proxy (Vercel, server-side only):

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `ALLOWED_ORIGIN` — exact origin allowed by CORS.

A committed `.env.example` mirrors the frontend keys with empty values.

## 10. Voice & Copy

gitInsights has a single, consistent voice across every user-facing string — UI labels, empty states, error messages, WLB audit summaries, scope disclosures, marketing copy. This is non-negotiable; engineers and designers must write to it.

### The Vibe

Brutalist, pro work-life balance, anti-burnout, anti-toxic-workplace, gen-z native. We're the friend who says "log off" when you've been at it for 11 hours. We don't sound like an HR portal, a corporate wellness app, or a productivity tracker for managers. We sound like the developer is the main character — because they are.

### Principles

- **Short and direct.** Brutalist means few words, no padding, no "we're sorry to inform you that". Lowercase is fine when it serves the vibe; full sentences not required for status copy.
- **Pro-rest, anti-grind.** Rest is a feature, not a failure. Streaks survive PTO and weekends. Long breaks are celebrated, not flagged. We never use "productivity", "output velocity", or "performance" — those are the boss's words.
- **Name the toxic patterns out loud.** Late-night commits, weekend work, PTO violations, 30-day no-rest streaks: we surface these directly, without softening into corporate "wellness check" tone. The user owns what they do with that info; we don't lecture.
- **The user is on their side.** Copy frames data as ammo against opaque manager dashboards, not material for one. Never imply the user should work more, harder, or longer.
- **No moralizing, no shame.** "you committed at 2am 4 nights this week" is fine. "you should be ashamed" or "this is bad for you" is not.
- **No emoji clutter.** Sparing use of GitHub-native iconography (Octicons) and small textual signals; no emoji-as-decoration. Adding emoji is opt-in via design review, never default.
- **Internet-native, not cringe.** We can be casual and direct. We don't reach for memes that will date the product in 6 months ("rizz", "gyatt", current trend slang) or speak in third-person AI voice ("as your insights companion…").
- **Accessibility is voice too.** Every string must work for a screen reader. No copy that depends on visual layout, color, or emoji to make sense.

### Don't / Do

- WLB audit, late nights:
  - Don't: "You worked late on 12 nights last month. Consider a healthier sleep schedule."
  - Do: "12 nights past 22:00 last month. that's a lot. log off."
- WLB audit, weekend work:
  - Don't: "Great hustle on weekends!"
  - Do: "5 of 8 weekend days had commits. weekends are not a feature."
- PTO violation:
  - Don't: "You committed during your scheduled time off. We hope everything is okay."
  - Do: "you marked dec 27 as PTO and pushed 3 commits. it's PTO. close the laptop."
- Healthy streak break (`skip-non-workdays`):
  - Don't: "Your streak ended."
  - Do: "took the weekend off. streak intact."
- Empty state, no commits in window:
  - Don't: "No data available."
  - Do: "nothing here yet. either you're new, on PTO, or actually resting. all valid."
- Scope disclosure, login:
  - Don't: "We require permissions to access your repositories to provide our services."
  - Do: "we read your private repos because that's where the work actually lives. nothing leaves your browser. promise."
- Rate-limit error:
  - Don't: "An error occurred. Please try again later."
  - Do: "github rate-limited us. resets at 14:32. cached data below."
- Auth expired:
  - Don't: "Your session has expired. Please log in again."
  - Do: "github logged you out. log back in to keep going."
- Long no-rest streak (anti-burnout nudge):
  - Don't: "Impressive consistency!"
  - Do: "47 workdays straight, 0 PTO. when's the last time you took a day?"
- Marketing / landing hero:
  - Don't: "Track your developer productivity and hit your goals."
  - Do: "your commits, your story. not your boss's dashboard."

### Forbidden Words

Avoid these in any user-facing string:

- productivity, output, velocity, performance, KPI, hustle, grind (positive framing)
- "we're sorry to inform you", "unfortunately", "please be advised"
- crush it, slay (as marketing verbs), boss up
- wellness journey, mindfulness moment, take care of yourself (saccharine)
- generic "Oops!" / "Something went wrong" — always say *what* went wrong

### Where This Applies

Every screen and string, including but not limited to:

- §3.H error handling (auth expired, rate limit, SAML, network, empty data).
- §4.A scope disclosure on the login page.
- §4.E settings labels, especially around PTO ("mark as PTO", "actually rest", etc.).
- §6 WLB Audit tile copy: every metric needs a one-liner verdict in this voice.
- §6 Streak Modes labels: prefer human phrasing ("strict", "skip non-workdays", "workdays only" → reasonable; UI may humanize further like "every day or it doesn't count" / "weekends don't break me" / "only workdays count" — design pass to finalize).
- 404 page, OG image / social preview, README.

When in doubt, ask: *would the developer's most direct friend say this, or would their manager's HR portal?* If it's the second, rewrite.

## 11. Open Questions / Decisions Log

- [ ] Public profile model (`/u/:username`) — visitor's token vs published JSON snapshot. _Owner decision pending._
- [ ] Migration path from OAuth App to GitHub App (better scoping, finer-grained permissions, refresh tokens).
- [ ] Public Holidays: optional custom .ics import for users in regions not covered by the bundled dataset.

## 12. Implementation Tasks

### Phase 0: Project Conventions & Tooling

- [ ] Initialize Vite + React + TypeScript (strict).
- [ ] Configure ESLint, Prettier, Husky, lint-staged.
- [ ] Set up Vitest + React Testing Library and Playwright.
- [ ] Add `.env.example` and document required vars.
- [ ] Pin Node 22 in `.nvmrc` and `package.json` `engines`.

### Phase 1: Vite + Mantine Scaffolding

- [ ] Initialize Vite project and install Mantine core (`@mantine/core`, `@mantine/hooks`) plus its peer styles. Mount a single top-level `<MantineProvider>`.
- [ ] Install `styled-components` for the custom-CSS / Mantine-extension cases. Mount a Styled Components `<ThemeProvider theme={mantineTheme}>` *inside* `<MantineProvider>` so `styled(Card)`-style definitions read the same Primer-derived tokens.
- [ ] Add `@primer/primitives` and build the token mapping for both **dark** and **light** Primer palettes into a Mantine theme (`theme.colors`, `theme.spacing`, `theme.radius`, `theme.fontFamily`, `theme.shadows`). No hard-coded colors anywhere — all surfaces (Mantine and Styled Components) resolve through this theme.
- [ ] Implement an app-level theme controller that reads `theme` (`system` | `dark` | `light`) from `gi.user-data`, resolves `system` via `matchMedia('(prefers-color-scheme: dark)')` (and reacts to changes), and toggles Mantine's `colorScheme` accordingly.
- [ ] Add `<meta name="color-scheme" content="dark light">` to `index.html`; ensure the Consistency Map (custom CSS-grid) and Recharts pull colors from the active Mantine theme (CSS variables / theme reads).
- [ ] Establish the component policy: **no raw HTML components**; every UI building block is a Mantine primitive or a `styled(MantineComponent)` extension. Add a lint rule (or CI grep) that flags `styled.div` / `styled.span` / `styled.button` etc. (raw HTML targets) and any JSX with hard-coded colors, so the policy is enforced on review.
- [ ] Set up React Router with `/`, `/callback`, `/dashboard`, `/u/:username`, `/settings`, `*`.

### Phase 2: Auth & Serverless Proxy

- [ ] Set up the Serverless Function (api/authenticate.ts) on Vercel for token exchange, with CORS allowlist and TS types.
- [ ] Configure GitHub OAuth App credentials in environment variables (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_ORIGIN`).
- [ ] Request scopes `read:user`, `user:email`, `repo`, `read:org` and surface scope rationale on the login page.
- [ ] Implement useAuth hook to manage access_token in LocalStorage (validate on boot, clear on 401).
- [ ] Implement `/callback` route handler.

### Phase 3: GitHub Data Layer (GraphQL + REST)

- [x] Build a useGitHub hook for authenticated GraphQL + REST communication using `@octokit/graphql` and `@octokit/rest`.
- [x] Implement queries for contribution history and repo metadata (including private repos and orgs).
- [x] Add a `useViewerCommitsByDay({login, range})` hook on top of `GET /search/commits` (`merge:false`) — the Consistency Map's data source. Adaptive bisection past the 1000-result cap.
- [x] Wire TanStack Query with IndexedDB persistence and the staleTime defaults from §3.D.
- [x] Handle SAML/SSO `403` errors with an actionable UI hint.

### Phase 4: Bento & Heatmap Implementation

- [x] Build the Bento layout from Mantine primitives (`styled(Box)` 12-column CSS Grid with `grid-template-areas`, `Card` extended into `BentoTile`) — responsive, a11y-friendly. No raw HTML for tile chrome.
- [x] Build a custom CSS-grid Consistency Map (53-col × 7-row, `aspect-ratio: 1` cells, theme tokens for the intensity ramp). Custom heatmap chosen over cal-heatmap to drop the d3 + cal-heatmap dependency (~270 kB), get pure-CSS responsive sizing, and own the PTO/holiday adornment seam directly.
- [x] Wire the Consistency Map to `useViewerCommitsByDay` (pure non-merge commits) — not the contribution calendar.
- [x] Implement loading skeletons, empty states, error tiles, and a "placeholder" state for tiles landing in Phase 5.
- [x] Cell tooltip + hidden a11y `<table>` of `date | commit count | adornment`.

### Phase 5: Analytics & WLB Logic

- [x] Implement Commit Momentum (recency-weighted non-merge commits, rolling 365d) in a Web Worker (`commitMomentum.worker.ts`).
- [ ] Optional: hydrate per-commit diffs and switch momentum to `DiffDelta * RecencyWeight` (see §6 Diff Delta).
- [ ] Build the WLB Audit tool (analyzing commit hour buckets) (in a Web Worker), including PTO-aware metrics (`PTODaysTaken`, `PTOHonoredRatio`, `PTOViolationCount`).
- [ ] Implement the Weekly Coding Days tile and PTO-aware streak modes.
- [ ] Implement the configurable Workweek setting (Mon–Fri / Sun–Thu / Mon–Thu presets + custom multi-select), threaded through every "non-workday" code path.
- [ ] Build the IndexedDB `gi.user-data` store (PTO calendar + workweek + theme + preferences) with schema versioning, migrations, and JSON export/import.
- [ ] Build the PTO Calendar UI in `/settings` (single-day toggle, range selection, optional label/kind, list view).
- [ ] Render PTO cells distinctly on the Consistency Map via the `cellAdornments(date) => { color?, overlayDot?, label? }` hook the Phase 4 grid already exposes; "violation" dot overlay when commits exist on a PTO day. Public Holiday cells reuse the PTO color; tooltip / a11y label disambiguates by source.
- [ ] Implement Public Holidays:
  - [ ] Build the build-time ingestion script that pulls from the open-source dataset (e.g., `nager/Nager.Date`) and emits `src/data/holidays/{region}.json` for the current year ± 1.
  - [ ] Add a yearly GitHub Actions cron to regenerate the bundled dataset and open a PR.
  - [ ] Implement region multi-select + override list in `/settings`.
  - [ ] Add the unified `isOffDay(date)` helper (non-workday OR PTO OR holiday-minus-overrides) and route every metric through it.
- [ ] Memoize worker results to IndexedDB, keyed to include both PTO-set version and Holidays-config version so changes invalidate cleanly.

### Phase 5b: Cross-Device Sync (GitHub Gist)

- [ ] Implement the incremental `gist`-scope re-authorization flow (triggered from `/settings` Sync toggle), reusing the OAuth callback path.
- [ ] Build the Gist sync client: discovery (find gist by description), create-on-first-push, GET/PATCH with `If-Match`/`updated_at` for conflict detection, retry-once on conflict.
- [ ] Wire the sync engine: pull on boot, debounced push on `gi.user-data` change (~2s), manual **Sync now**.
- [ ] Add `updatedAt`, `lastWriterDeviceId`, and a per-device `deviceId` (random UUID, local-only) to the user-data schema; bump `schemaVersion`.
- [ ] Build the Settings sync UI: toggle, last-sync indicator, **Sync now**, **Delete cloud copy** (destructive confirm), scope-revoked recovery message.
- [ ] Detect 401/403 from the Gist API and disable sync gracefully without affecting analytics auth.
- [ ] Update the sync opt-in dialog and copy strings to follow §10 voice; explicitly disclose the `gist` scope's all-gists access.

### Phase 6: GitHub Pages Deployment Hack

- [ ] Create public/404.html for the SPA redirect logic.
- [ ] Add route restoration script to index.html.

### Phase 7: CI/CD & Quality

- [ ] GitHub Actions: typecheck, lint, unit tests, e2e tests on every PR.
- [ ] GitHub Actions: build + deploy to GitHub Pages on merge to `main`.
- [ ] Lighthouse CI for performance & accessibility budgets.
- [ ] Separate Vercel deployment pipeline for the proxy.

### Phase 8: Polish & Launch

- [ ] Branded 404 page, OG image / social preview, favicon set.
- [ ] README with screenshots, scope rationale, and self-hosting instructions.
- [ ] Privacy page describing exactly what data is read and where it lives.
- [ ] A widget for achievements and badges. and dedicated page for the same, but need to come up with achievements and badges ideas.