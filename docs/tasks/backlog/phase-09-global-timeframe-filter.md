# Phase 9 — Global Timeframe Filter

**Goal**: ship a single dashboard-level timeframe control that scopes every tile except the Consistency Map, and rework the Weekly Coding Days tile to render a timeframe-aware bucketed histogram. After this phase, the user can pick any window from "last week" up to a 365-day cap (presets, specific month, specific quarter, or a custom range) and every dependent tile recomputes from the same resolved `{from, to}`.

**Spec refs**:
- `spec.md §4.C Dashboard` — Global Timeframe Filter callout above the Bento grid.
- `spec.md §6 Global Timeframe` — data model, UI, scope, per-metric semantics, edge cases.
- `spec.md §6 Weekly Coding Days` — timeframe-aware histogram bucketing (per-week → bi-weekly → per-month).
- `spec.md §6 Commit Momentum`, `§6 Tech Stack Inference`, `§6 Consistency` — windows that follow (or explicitly do not follow) the global selection.
- `spec.md §3.F Local User Data` — `gi.user-data.preferences.timeframe` storage.
- `spec.md §3.G Cross-Device Sync` — the timeframe selection syncs.
- `spec.md §10 Voice & Copy` — picker copy, hint copy, error copy.

**Depends on**: Phase 5 (the `gi.user-data` store, Commit Momentum / WLB / Weekly Coding Days / Tech Stack tiles must already be live so this phase has something to thread `{from, to}` through).

**Screens touched**: `/dashboard` (timeframe picker in the header, every tile except Consistency Map reads from the resolved window, Weekly Coding Days tile gets a new histogram renderer).

## Acceptance criteria

### Picker behavior
- [ ] A single timeframe pill sits in the dashboard header above the Bento grid; sticky on wide viewports, compact on narrow.
- [ ] Picker is built from Mantine primitives (`Menu` / `Popover` + `@mantine/dates` `MonthPicker` and `DatePicker type="range"`); no raw HTML.
- [ ] Presets present: `last-week`, `last-30-days`, `last-3-months`, `last-6-months`, `last-year` (default).
- [ ] Month and quarter pickers offered for any month/quarter that fits inside the trailing 365 days; older months/quarters are disabled.
- [ ] Custom range is selectable on a calendar; ranges longer than 365 days are blocked at selection time (the calendar disables out-of-window dates) with a §10-voice hint shown in the picker body.
- [ ] Selected timeframe persists across reloads via `gi.user-data.preferences.timeframe` and syncs via Phase 5b when sync is on.
- [ ] Default for new users is `{ kind: 'preset', preset: 'last-year' }`.

### Resolution & metric wiring
- [ ] A single `resolveTimeframe(tf, now)` helper returns `{ from: Date, to: Date, label: string }` and is the only path tiles use to derive their window.
- [ ] A `useTimeframe()` hook exposes the current `Timeframe` and the resolved `{from, to, label}` to tiles.
- [ ] Commit Momentum reads its window from `useTimeframe()`; `RecencyWeight` decays linearly from 1.0 at `to` to 0.25 at `from`. Total + sparkline both reflect the selection.
- [ ] WLB Audit ratios (`LateNightRatio`, `NonWorkdayRatio`, `PTOHonoredRatio`, `PTOViolationCount`, `HourHistogram`, `LongestStreakDays`, `LongestBreakDays`) compute over commits in the resolved window. Off-day exclusion rules unchanged.
- [ ] Tech Stack Inference aggregates `repository.languages` over the resolved window; repos with zero contributions in the window drop out.
- [ ] Consistency Map heatmap and its streak counters stay pinned to the trailing 53 weeks regardless of selection (explicit carve-out, called out in the picker copy).

### Weekly Coding Days histogram (rebuild)
- [ ] Replace the fixed 12-week sparkline with a timeframe-aware bucketed histogram driven by `bucketWeeklyCodingDays(weeks, timeframe)` from `src/analytics/`.
- [ ] Bucket sizes match `spec.md §6 Weekly Coding Days` exactly:
  - ≤ 14 days → per ISO week (1–2 bars).
  - 15 days – 12 weeks → per ISO week (3–12 bars).
  - > 12 weeks – 6 months → per ISO week, pairs of 2 (7–13 bars).
  - > 6 months – 365 days → per calendar month (7–12 bars).
- [ ] Each bar's value is the **mean** weekly ratio (`activeDays / expectedDays`) over the weeks in the bucket — never a sum. Y-axis is stable across bucket sizes.
- [ ] Buckets where the summed `expectedDays` is 0 (entirely off-days) render as a flat "rest" bar in the off-day color, not a zero bar.
- [ ] Partial buckets at window edges keep their partial range and are labeled accordingly (e.g. "feb 17 – feb 28").
- [ ] Per-bar tooltip: bucket label ("mar 2026", "q1 2026", "feb 3 – feb 9"), mean ratio, count of weeks in the bucket, best and worst weeks inside it.
- [ ] Windows shorter than 7 days suppress the histogram and show a single last-week summary instead.
- [ ] Tile header shows the current/latest-in-window week's `numerator / denominator`, a one-line caption in §10 voice, and an all-time best week.

### Caching & perf
- [ ] TanStack Query keys for any data source consumed by these tiles include the resolved `{from, to}` ISO pair so switching timeframes is a cache lookup, not a refetch, on repeat selections.
- [ ] Worker memoization keys (Commit Momentum, WLB) include `{from, to}` plus the existing settings versions (PTO, holidays, workweek).
- [ ] Switching between two previously-selected timeframes is instantaneous (cache hit).

### Voice & copy
- [ ] Picker trigger label uses the resolved label ("last 12 months", "mar 2026", "q1 2026", "feb 3 – feb 28").
- [ ] Picker body copy ships in §10 voice: "pick a window. heatmap stays a year — that's the whole point of a heatmap."
- [ ] Custom-range max-length hint: "max window is a year. anything longer is just a heatmap."
- [ ] Reset action copy: "back to last 12 months."

### A11y
- [ ] Picker is fully keyboard-operable (Mantine `Menu` keyboard model). Trigger has a descriptive `aria-label` ("dashboard timeframe, currently {label}").
- [ ] Histogram exposes a hidden `<table>` of `bucket label | mean ratio | weeks in bucket | best week | worst week` for screen readers.
- [ ] Color is never the only signal: the off-day "rest" bar is differentiated by both color and a label/icon in the tooltip and the a11y table.

## Tasks

### Schema & store
- [ ] Add `Timeframe` discriminated union to the `gi.user-data.preferences` schema (`preset` | `month` | `quarter` | `custom`); default to `{ kind: 'preset', preset: 'last-year' }`.
- [ ] Bump `schemaVersion` and write a migration that fills the default for documents written before this phase.
- [ ] Add a Vitest migration test that round-trips a pre-Phase-9 document through the upgrade path.

### Resolution helper
- [ ] Implement `resolveTimeframe(tf, now): { from: Date, to: Date, label: string }` in `src/analytics/timeframe.ts`. Pure function, fully tested.
- [ ] Enforce the **365-day cap** inside the helper: any input that would resolve to a window > 365 days clamps `from` to `to - 365 days` and the label notes the clamp ("clamped to last 12 months"). Picker UI prevents this case from happening interactively, but the helper is the safety net.
- [ ] Reject `to < from` and `from > now` with a typed error.

### `useTimeframe` hook
- [ ] Implement `useTimeframe()` in `src/hooks/useTimeframe.ts`: reads `Timeframe` from the user-data store, calls `resolveTimeframe`, returns `{ timeframe, setTimeframe, from, to, label }`.
- [ ] Memoize the resolved range with a 1-minute clock granularity so "rolling" presets don't churn on every render.
- [ ] On `setTimeframe`, write through to `gi.user-data` (which triggers Phase 5b sync if enabled).

### Picker UI
- [ ] Build `<TimeframePicker />` in `src/components/Timeframe/`. Pill `Button` trigger + `Popover` body. No raw HTML.
- [ ] Body sections (in order): preset list (`Menu.Item`-style buttons), `MonthPicker` (year-bounded to the trailing 365 days), `QuarterPicker` (custom small grid built from Mantine `Button`s for `Q1..Q4` of the in-range year(s)), `DatePicker type="range"` for custom.
- [ ] Calendar disables dates outside `[now - 365 days, now]`; range selection blocks any pair whose span exceeds 365 days (highlight + hint).
- [ ] "Reset to default" affordance at the bottom of the body.
- [ ] Sticky placement in the dashboard header on `≥ md`; collapses to a compact pill in the existing header pill row on narrow viewports.

### Tile rewiring
- [ ] Update `EPTile` (Commit Momentum) to read `{from, to}` from `useTimeframe()` and pass it into the worker call + TanStack Query key.
- [ ] Update WLB Audit tile and worker to accept `{from, to}` and recompute every ratio over that window.
- [ ] Update Tech Stack tile to aggregate languages over `{from, to}` only.
- [ ] Make the Consistency Map and its streak counters explicitly **ignore** `useTimeframe()` — keep their own trailing-53-weeks window. Add an inline comment + test to lock this in.

### Weekly Coding Days rebuild
- [ ] Implement `bucketWeeklyCodingDays(weeks, timeframe): Bucket[]` in `src/analytics/weeklyCodingDays.ts` matching the bucket table in `spec.md §6 Weekly Coding Days`. Pure function, fully tested with one test per bucket size class plus partial-edge and all-off-day cases.
- [ ] Replace the existing 12-week sparkline renderer with a `<WeeklyCodingDaysHistogram />` that consumes `Bucket[]` and renders bars from Mantine + `styled(Box)` primitives. No raw HTML.
- [ ] Wire per-bar tooltip via Mantine `Tooltip` with the structured content (label / mean / week count / best / worst).
- [ ] Render off-day-only buckets in the off-day color (re-use the heatmap PTO/holiday color token); add the §10 footer copy: "{n} bars are entirely off-days. that's the point."
- [ ] Build the hidden a11y `<table>` next to the histogram.

### Cache keys
- [ ] Audit every TanStack Query key that backs the affected tiles; add the resolved `from`/`to` ISO strings to the key tuple.
- [ ] Audit Web Worker memoization keys (`commitMomentum.worker.ts`, `wlbAudit.worker.ts`) and add `from`/`to` alongside the existing PTO/holiday/workweek versions.
- [ ] Add a cache hit/miss test for switching between two previously selected timeframes (must be a hit).

### Voice & copy pass
- [ ] All picker, hint, reset, and histogram strings reviewed against `spec.md §10`.
- [ ] Examples to ship:
  - Picker trigger: `last 12 months`, `mar 2026`, `q1 2026`, `feb 3 – feb 28`.
  - Picker subhead: "pick a window. heatmap stays a year — that's the whole point of a heatmap."
  - Max-window hint: "max window is a year. anything longer is just a heatmap."
  - Reset: "back to last 12 months."
  - Weekly Coding Days short window: "less than a week selected. one bar isn't a histogram."

## Out of scope

- Adding the global timeframe to settings export/import payloads beyond the existing `gi.user-data` round-trip — it ships as part of `preferences` automatically.
- Per-tile timeframe overrides (e.g. WLB on a different window than Commit Momentum). One picker, one window, by design.
- Comparing two timeframes side-by-side ("vs previous period"). Future work.
- Surfacing the timeframe in the public profile page (`/u/:username`) — that page is still deferred per spec §4.D / §11.
- Changing the Consistency Map's window. Explicitly fixed at the trailing 53 weeks.
