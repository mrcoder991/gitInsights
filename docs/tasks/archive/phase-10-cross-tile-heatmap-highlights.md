# Phase 10 — Cross-Tile Heatmap Highlights

**Goal**: connect the Bento chart affordances to the Consistency Map so hovering time-based summaries highlights the exact days they describe. Weekly Coding Days also gets the terminology and week-boundary cleanup needed for the highlighted days to match its denominator.

**Spec refs**:
- `spec.md §4.C Dashboard` — Bento grid, Consistency Map, Weekly Coding Days, Commit Momentum, and Streak surfaces live together on `/dashboard`.
- `spec.md §6 Consistency Map & Streak Modes` — heatmap remains the trailing 53-week visual reference.
- `spec.md §6 Weekly Coding Days` — Sunday-Saturday buckets and `activeDays / effectiveWorkingDays` semantics.
- `features/workweek.md` — workday resolution uses user-authored `workdays`, not hard-coded weekends.
- `features/weekly-coding-days.md` — Effective Working Days denominator and timeframe-aware histogram.
- `spec.md §4 Cross-cutting UI Requirements` — color is never the only signal; highlights must remain keyboard-friendly where applicable.

**Depends on**: Phase 4 (Consistency Map), Phase 5 (Weekly Coding Days, Streak, PTO/Public Holidays/Workweek), and Phase 9 (global timeframe + Weekly Coding Days histogram).

**Screens touched**: `/dashboard` only.

## Acceptance criteria

### Shared highlight infrastructure
- [x] Add transient UI state for cross-tile heatmap highlights without persisting it to `gi.user-data`.
- [x] Allow highlight sources to provide either a simple `{from, to}` range or an exact list of ISO dates when dates inside the range should be skipped.
- [x] Clear stale highlights when the source tile unmounts or loses hover/focus.

### Consistency Map rendering
- [x] Consistency Map subscribes to the shared highlight state and marks matching cells.
- [x] Add a theme-backed highlight token; no hard-coded highlight colors.
- [x] Provide a code-level boolean feature flag to switch between grouped range outlines and individual cell-ring highlights.
- [x] Grouped range mode draws only outer perimeter edges so a highlighted run reads as one shape instead of many separate boxes.
- [x] Highlight logic respects the heatmap's fixed trailing 53-week window and never lights out-of-range cells.

### Weekly Coding Days hover
- [x] Weekly Coding Days bars highlight the represented heatmap days on hover and keyboard focus.
- [x] Weekly Coding Days hover respects `features/workweek.md`: non-workdays configured by the user are excluded from the highlight.
- [x] Weekly Coding Days hover also excludes PTO and public holidays because those days are not Effective Working Days.
- [x] Rest-only buckets do not misleadingly highlight full calendar weeks.
- [x] Tooltips show the bucket's calendar range while the heatmap highlight reflects the Effective Working Days denominator.

### Weekly Coding Days semantics cleanup
- [x] Change user-facing weekly buckets from ISO/Monday weeks to Sunday-Saturday weeks.
- [x] Keep global timeframe behavior unchanged: presets remain rolling ranges; month/quarter/custom windows keep calendar boundaries.
- [x] Rename `expectedDays` terminology to `effectiveWorkingDays` / **Effective Working Days** in analytics, UI copy, hidden a11y table, and docs.
- [x] Keep compact `wNN` bar labels while showing concrete date ranges in tooltips.

### Other tile integrations
- [x] Commit Momentum sparkline hover highlights the matching heatmap day.
- [x] Streak dots highlight the matching heatmap day on hover and keyboard focus.
- [x] Other tile integrations reuse the same shared highlight state and respect the Consistency Map highlight feature flag.

## Tasks

### Highlight state
- [x] Add `src/store/hoverHighlight.ts` as a small Zustand store for transient highlight state.
- [x] Support optional `dates` on the highlight payload for sources that need exact-date highlighting.

### Heatmap
- [x] Wire `ConsistencyMap` to the highlight store.
- [x] Add `--gi-heatmap-highlight-ring` to the Mantine theme variable resolver for light and dark modes.
- [x] Add grouped range edge rendering with gap-bridging highlight segments.
- [x] Add `USE_GROUPED_RANGE_HIGHLIGHT` as a local code-level toggle between grouped outlines and per-cell rings.

### Weekly Coding Days
- [x] Replace ISO/Monday helpers with Sunday-Saturday week helpers for Weekly Coding Days rollups.
- [x] Clip edge weeks to the selected timeframe so month/quarter/custom windows stay on their calendar boundaries.
- [x] Rename analytics fields from `expected` / `totalExpected` to `effectiveWorkingDays` / `totalEffectiveWorkingDays`.
- [x] Update Weekly Coding Days tooltip, stat unit, verdict copy, and screen-reader table wording.
- [x] Pass only Effective Working Days to the heatmap highlight when a bucket is hovered.

### Commit Momentum and Streak
- [x] Add a per-day hover layer over the Commit Momentum sparkline so each day can drive heatmap highlighting.
- [x] Add hover/focus handlers to Streak dots to highlight their exact heatmap cell.

### Docs
- [x] Update `spec.md`, `features/weekly-coding-days.md`, `features/pto.md`, `features/public-holidays.md`, and supporting task docs for Sunday-Saturday weeks and Effective Working Days.
- [x] Keep `features/workweek.md` as the source of truth for workday resolution.

## Verification

- [x] TypeScript typecheck passes.
- [x] IDE lints are clean for touched TypeScript files.
- [x] Manual visual checks confirmed grouped vs. cell highlight modes and refined the grouped border behavior.

## Out of scope

- Public profile heatmap interactions.
- User-facing settings for the grouped-vs-cell highlight mode. The toggle is intentionally code-level for now.
- Reverse highlighting from heatmap cells back into source tiles.
- Changing the Consistency Map's fixed trailing 53-week window.
