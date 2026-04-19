# Phase 5 — Analytics, WLB, Off-days, and the User-Data Store

**Goal**: ship every number on the dashboard and every user-authored setting that drives them. After this phase, the product is feature-complete for the single-device experience: EP, Diff Delta, Weekly Coding Days, WLB Audit, Tech Stack, Workweek, Streak modes, PTO, Public Holidays, and the `gi.user-data` store with JSON export/import.

**Spec refs**:
- `spec.md §3.F Local User Data`
- `spec.md §3.E Heavy Compute (Web Workers)`
- `spec.md §4.E Settings`
- `spec.md §6 Data Model & Metric Definitions` (entire section — Workweek, PTO, Public Holidays, EP, Diff Delta, WLB Audit, Weekly Coding Days, Consistency, Tech Stack)
- `spec.md §10 Voice & Copy`
- `spec.md §12 Phase 5`

**Depends on**: Phase 1 (theme), Phase 3 (data), Phase 4 (Bento + heatmap shell).

**Screens touched**: `/dashboard` (all remaining tiles + heatmap PTO/holiday rendering), `/settings` (workweek, streak mode, PTO calendar, public holidays, data controls, export/import).

## Acceptance criteria

### Settings & user-data store
- [ ] `gi.user-data` lives in IndexedDB, keyed by `viewer.login`, schema-versioned, with at least one written migration test.
- [ ] Export downloads a JSON file; Import accepts the same file and replaces the live store atomically.
- [ ] All settings round-trip through the store and apply live across the app (no reload).

### Workweek
- [ ] Settings UI presents Mon–Fri (default), Sun–Thu, Mon–Thu (4-day) presets, plus a custom multi-select.
- [ ] Empty `workdays` is rejected by the UI; `workdays = [0..6]` is allowed.
- [ ] Day labels respect the user's locale and first-day-of-week convention.

### Streak modes
- [ ] Three modes wired: `strict`, `skip-non-workdays` (default), `workdays-only`.
- [ ] Algorithm matches `spec.md §6 Streak Modes` exactly, including the off-day skip rule.
- [ ] Current and longest streak both honor the chosen mode and show on the Consistency tile.

### PTO
- [ ] PTO Calendar in settings: month-view picker, single-day toggle, range selection, optional label + `kind`, list view to bulk edit / delete.
- [ ] Heatmap renders PTO days in the PTO color regardless of contribution count; commits-on-PTO get the "violation dot" overlay.
- [ ] Effects: PTO skips the streak in every mode, removes from Weekly Coding Days numerator + denominator, surfaces in WLB.

### Public Holidays
- [ ] Settings UI: region multi-select with search (ISO 3166), upcoming-holidays list, per-day "I worked that day" override.
- [ ] Bundled JSON datasets exist for at least an initial set of regions (e.g., US, IN, GB-ENG); files at `src/data/holidays/{region}.json` for current year ± 1.
- [ ] Holidays render on the heatmap with the **same** PTO color; tooltip and a11y label name the source ("Public Holiday: Christmas Day").
- [ ] Effects mirror PTO; everything routes through the unified `isOffDay(date)` helper.

### Metrics
- [ ] Diff Delta worker exists and matches the formula in `spec.md §6 Diff Delta` (additions/deletions log, file count, merge penalty, vendor penalty, floored at 0).
- [ ] EP worker exists and matches `spec.md §6 EP` (rolling 365 days, recency weight 1.0 → 0.25 linear).
- [ ] WLB Audit worker emits `LateNightRatio`, `NonWorkdayRatio`, `HourHistogram`, `LongestStreakDays`, `LongestBreakDays`, `PTODaysTaken`, `PTOHonoredRatio`, `PTOViolationCount`. Off-days excluded from `NonWorkdayRatio` and `LateNightRatio` denominators.
- [ ] Weekly Coding Days tile shows current week, previous week, 12-week sparkline, all-time best week — with PTO/holiday-aware denominator.
- [ ] Tech Stack tile shows top languages by bytes for the last 12 months, "Other" bucket for the long tail.

### Voice
- [ ] Every tile ships a one-liner verdict in `spec.md §10` voice. Examples: "12 nights past 22:00 last month. that's a lot. log off." / "took the weekend off. streak intact." / "47 workdays straight, 0 PTO. when's the last time you took a day?"

## Tasks

### `gi.user-data` IndexedDB store
- [ ] Define the schema (single versioned doc):
  ```ts
  type UserData = {
    schemaVersion: 1;
    theme: 'system' | 'dark' | 'light';
    workweek: { workdays: number[] };           // 0..6, default [1,2,3,4,5]
    streakMode: 'strict' | 'skip-non-workdays' | 'workdays-only';
    pto: { date: string; label?: string; kind?: 'vacation' | 'sick' | 'holiday' | 'other' }[];
    holidays: {
      regions: string[];                        // ISO 3166, e.g. ['US', 'IN']
      overrides: { date: string; treatAs: 'workday' }[];
    };
    bento: { tileOrder: string[]; hiddenTiles: string[] };
    preferences: Record<string, unknown>;       // future-tunable bag
  };
  ```
- [ ] Implement `userDataStore.ts` with `idb-keyval`, namespaced by `viewer.login` (`gi.user-data:${login}`).
- [ ] Migration scaffolding (no migrations yet, but the dispatch table must exist so v2 doesn't require a refactor).
- [ ] Migrate the temporary `gi.theme.tmp` from Phase 1 into `userData.theme`.
- [ ] Build `useUserData` (Zustand-backed mirror of the persisted doc) so React components subscribe by selector.
- [ ] Export / Import: settings page actions to download `gi.user-data.${login}.json` and load it back. Import validates `schemaVersion` and rejects mismatches with a §10-voice error.

### Workweek
- [ ] Implement `isWorkday(date, workdays)` pure function.
- [ ] Settings UI: preset chips + custom multi-select (locale-aware day names).
- [ ] Wire to `useUserData`; updates apply live to every metric.

### Streak modes
- [ ] Implement `currentStreak(days, { workdays, ptoSet, holidaySet, mode })` and `longestStreak(...)` pure functions; algorithm exactly per `spec.md §6 Streak Modes` (off-day skip is `mode`-independent and always applies).
- [ ] Settings UI: three radios + helper copy in §10 voice.
- [ ] Surface current + longest streak under the Consistency Map.

### Off-day unification
- [ ] Implement the unified `isOffDay(date, ctx)` helper: `true` if `!isWorkday(date)` OR PTO OR holiday-minus-overrides.
- [ ] Refactor every metric to call `isOffDay` — single source of truth.

### PTO calendar
- [ ] PTO data model and validators (date in local TZ, dedupe).
- [ ] Settings UI: month picker (Octicon-driven prev/next), single-day toggle, range selection (drag or click + shift-click), label + kind, list view with bulk delete.
- [ ] Heatmap: implement `cellAdornments(date)` from Phase 4 to return PTO color + (if `contributionCount > 0`) violation-dot overlay; tooltip names "PTO: Vacation" etc.
- [ ] Voice copy: "marked dec 23 – jan 2 as PTO. enjoy." / "you committed on a PTO day. it's PTO. close the laptop."

### Public Holidays
- [ ] Build the **build-time** ingestion script: pulls from an open-source dataset (e.g., `nager/Nager.Date`), emits `src/data/holidays/{region}.json` for current year ± 1. Script is idempotent; output is committed.
- [ ] Add a yearly GitHub Actions cron (configured in Phase 7) to rerun the script and open a PR.
- [ ] At runtime, lazy-load only the region JSONs the user has selected.
- [ ] Settings UI: region multi-select with search, upcoming-holidays list grouped by region, per-row "I worked that day" override toggle.
- [ ] Heatmap: holidays reuse PTO color but tooltip / a11y label disambiguate by source. Add an Octicon legend cue.
- [ ] Override list: small list view in settings to remove specific overrides without disabling holidays globally.
- [ ] Empty state when a region's data is missing: §10-voice copy pointing to the future custom-`.ics` import (tracked in `spec.md §11`).

### Web Workers
- [ ] Install `comlink`. Set up Vite worker bundling.
- [ ] `diffDelta.worker.ts`: pure function, no network. Tested against fixed commit fixtures.
- [ ] `wlbAudit.worker.ts`: produces all the metrics listed above; consumes `{ commits, workdays, ptoSet, holidaySet }`.
- [ ] Workers receive plain data and return summarized metrics; no React, no octokit.
- [ ] Memoize results in IndexedDB keyed by `(userId, repoId, sha-range, ptoVersion, holidaysVersion, workweekVersion)`. Bump versions on relevant settings change.

### Bento tiles (the rest)
- [ ] **EP tile**: number + 30-day sparkline.
- [ ] **Weekly Coding Days tile**: current week vs expected (e.g. "4 / 5"), previous week, 12-week sparkline, best week.
- [ ] **WLB Audit tile**: hour histogram (Recharts), late-night ratio, non-workday ratio, PTO honored ratio, plus the §10-voice verdicts.
- [ ] **Tech Stack tile**: stacked-bar of top languages over the last 12 months, "Other" bucket.
- [ ] All tiles theme-aware and reuse `BentoTile` from Phase 4 for state handling.

### Cache invalidation
- [ ] Bump worker memo keys when `pto`, `holidays.regions`, `holidays.overrides`, or `workweek.workdays` change.
- [ ] Verify with a unit test: changing PTO recomputes EP/WLB/Weekly Coding Days within one tick.

## Out of scope

- Cross-device sync — Phase 5b.
- Custom `.ics` holiday import — `spec.md §11`.
- Public profile (`/u/:username`) — `spec.md §11`.
- Sub-region holidays beyond what the bundled dataset provides — covered by future custom `.ics`.
