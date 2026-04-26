# Phase 4 — Bento Grid & Consistency Map

**Goal**: ship the visual scaffolding of `/dashboard` — the Bento layout that hosts every analytics tile, plus the first real tile (Consistency Map) wired to live GitHub data. Other tiles arrive in Phase 5.

**Spec refs**: `spec.md §4.C Dashboard`, `spec.md §4 Cross-cutting UI Requirements`, `spec.md §6 Consistency`, `spec.md §6 PTO` (heatmap rendering hooks), `spec.md §10 Voice & Copy`, `spec.md §12 Phase 4`.

**Depends on**: Phase 1 (theme), Phase 3 (data — including the Phase 4-driven `useViewerCommitsByDay` hook).

**Screens touched**: `/dashboard` (full layout + Consistency Map tile).

## Acceptance criteria

- `/dashboard` shows a responsive Bento grid that collapses cleanly from desktop → 360px (single column on narrow viewports).
- The Consistency Map renders the user's last 365 days of **pure non-merge commits** (public + private) as a 53-week × 7-day grid. Not the GitHub "contributions" superset (which counts PRs / issues / reviews / approvals).
- Heatmap intensity colors come from the Mantine theme (Primer-derived `--gi-heatmap-0..4`) and switch with theme; verified in both dark and light.
- Each tile slot defines and ships a loading skeleton, an empty state, and an error state — no blank tile, ever. Tiles awaiting Phase 5 ship as `placeholder`.
- Heatmap exposes hooks for Phase 5 to overlay PTO color and "violation" dot on a per-day basis (data API can be a no-op for now), with in-place re-application when the hook identity changes.
- All a11y baselines met: keyboard reachable, focus visible, the heatmap has a text/table fallback (`<table>` of date → commit count → adornment).

## Tasks

### Bento layout
- [x] Create `src/components/Bento/` with `BentoGrid` (`styled(Box)` 12-column CSS Grid using `grid-template-areas`) and `BentoTile` primitive (`styled(Card)` extension that handles loading / empty / error / loaded / placeholder states uniformly). No raw `<div>` tile chrome.
- [x] Define grid template areas for the spec'd tiles: `EP`, `Streak`, `WeeklyCodingDays`, `Consistency`, `WLB`, `TechStack`. Phase 4 ships only `Consistency` live; the rest get `<BentoTile state="placeholder">`. Layout matches the dashboard mock: row 1 = EP/Streak/WCD (4-4-4), row 2 = Consistency (12), row 3 = WLB/TechStack (7-5).
- [x] Responsive breakpoints driven by media queries inside the `styled(Box)` template: desktop ≥ 992px → mock layout; tablet ≥ 640px → EP/Streak side-by-side, all other tiles full-width; mobile < 640px → 1 column. No horizontal scroll at 360px.
- [x] Tiles never resize their own height past the grid track — content scrolls inside (Mantine `ScrollArea` for overflow).
- [x] `BentoHeader` (greeting + scope line) sits above the grid. Greeting reads "morning/afternoon/evening/late/still up, {first-name}." from `useAuth().viewer`; falls back to a `Skeleton` while auth boots. Repo/org count and last-sync timestamp deliberately omitted until Phase 5 wires the data sources.

### Tile primitives
- [x] `BentoTile = styled(Card)` accepts `{ title, state, children, footer?, icon?, emptyMessage?, errorMessage?, onRetry?, area? }` and renders the right subtree using Mantine primitives (`Card.Section`, `Group`, `Stack`, `Text`, `Skeleton`, `Alert`, `Center`).
- [x] Loading skeleton: Mantine `Skeleton` (theme-aware out of the box); respects `prefers-reduced-motion`.
- [x] Empty state: Octicon + one-line copy slot in `spec.md §10` voice, laid out with Mantine `Stack` / `Center`.
- [x] Error state: Mantine `Alert` (inline) + Mantine `Button` retry that calls TanStack Query `refetch`.
- [x] Placeholder state for Phase 5 tiles — keeps the grid visually anchored while the analytics land.

### Consistency Map (custom CSS-grid)
- [x] Build `ConsistencyMap` as a custom CSS-grid component (`styled(Box)` with `grid-template-columns: repeat(53, 1fr)`, `aspect-ratio: 1` cells, `min-width: 680px` floor + outer `overflow-x: auto` for narrow viewports). _Note: scoped out of cal-heatmap mid-build — see "Engine choice" below._
- [x] Render the rolling 365-day calendar, aligned so column 0 is the Sunday of the week containing `window.from` and column 52 is the current week.
- [x] Wire the heatmap to `useViewerCommitsByDay({login, range})` (Phase 3 layer) — pure non-merge commits per day. Build `HeatmapRow[]` via `commitsToHeatmapRows(byDate, window)` so days with no commits render as zero-cells.
- [x] Color scale: 5 buckets (`0 | 1–2 | 3–5 | 6–9 | 10+`), all sourced from `--gi-heatmap-0..4` CSS variables for the active color scheme.
- [x] Tooltip on cell shows date + commit count via Mantine `Tooltip` with structured `CellTooltipContent` JSX (e.g. **`mon, jan 14`** / `3 commits.` / optional adornment label). Out-of-range cells render their own tooltip too. The `TooltipFacts` shape is the seam Phase 5 extends with extra lines (streak position, weekly delta, PTO context, prior-year compare).
- [x] Expose a `cellAdornments(date) => { color?, overlayDot?, label? }` hook. Adornments apply via inline `background` + `data-gi-violation` attribute (CSS `::after` paints the violation dot). Phase 4 ships this as a no-op.
- [x] A11y: emit a hidden `<table>` containing `date | commit count | adornment` so screen readers and tests have something to read. Each in-range cell is also keyboard-focusable with a matching `aria-label`.

### Engine choice (cal-heatmap → custom grid)
- [x] Phase 4 originally specced cal-heatmap. Switched mid-build to a custom CSS-grid component because:
  - **Bundle size**: dropped ~270 kB (gzip ~100 kB) by removing cal-heatmap + d3 + plugins.
  - **Mock fidelity**: 1:1 with the `.hm` block in `docs/mocks/index.html`.
  - **Pure-CSS responsive sizing** (`aspect-ratio: 1` + `1fr`) — no `ResizeObserver`, no async paint, no StrictMode races.
  - **Direct ownership of the PTO/holiday adornment seam** without DOM-mutation hacks against a 3rd-party SVG.
  - Cost: native-tooltip → Mantine `Tooltip` per cell (acceptable; ~371 wrappers, framework handles lazy floating-element render).

### Dashboard wiring
- [x] `/dashboard` mounts `<BentoHeader />` + `<BentoGrid>` with all six tiles in mock order (`ConsistencyTile` live, the other five as placeholders).
- [x] `ConsistencyTile` resolves the user's commits via `useViewerCommitsByDay` (Phase 3 hook) keyed on `viewer.login`.
- [x] On boot with cached data, the heatmap renders instantly; a background refetch updates it without flicker.
- [x] On rate-limit `403`, the global banner from Phase 3 appears and the heatmap stays on the cached snapshot. State priority: `data` always wins over `isError` so `isError && !data` is the only path to the error tile (spec §3.D).

### Voice & copy
- [x] All strings in this phase ship in `spec.md §10` voice. Examples:
  - Tile title: "your year. one square per day."
  - Footer: "{N} commits, last 365 days. merges excluded." / "public + private."
  - Empty state: "no commits in the last 365 days. either you're new, on PTO, or actually resting. all valid."
  - Error state: "couldn't load your commits. github blinked. try again."
  - Tooltip body: "**mon, jan 14** / 3 commits."
  - Header greeting: "morning, uday." (time-of-day adaptive: morning / afternoon / evening / late / still up).

## Out of scope

- EP, Streak, Weekly Coding Days, WLB, Tech Stack tile contents — Phase 5.
- PTO and holiday data flowing into the heatmap — Phase 5 (the `cellAdornments` hook + `data-gi-adorned` reset path are ready here).
- Heatmap legend swatches (off-day / holiday / violation). The mock shows them; Phase 5 ships them alongside the actual PTO data.
- Bento tile reordering / toggle from settings — Phase 5.
- Sync controls — Phase 5b.
- Repo/org count and last-sync timestamp in `BentoHeader` — Phase 5 (need `useViewerOrgs` + cache metadata).
- Surfacing `CommitsByDay.truncated` (the >1000-commits-per-bisected-day flag) in the UI — add when it ever fires in production.
