# Phase 4 — Bento Grid & Consistency Map

**Goal**: ship the visual scaffolding of `/dashboard` — the Bento layout that hosts every analytics tile, plus the first real tile (Consistency Map / cal-heatmap) wired to live GitHub data. Other tiles arrive in Phase 5.

**Spec refs**: `spec.md §4.C Dashboard`, `spec.md §4 Cross-cutting UI Requirements`, `spec.md §6 Consistency`, `spec.md §6 PTO` (heatmap rendering hooks), `spec.md §10 Voice & Copy`, `spec.md §12 Phase 4`.

**Depends on**: Phase 1 (theme), Phase 3 (data).

**Screens touched**: `/dashboard` (full layout + Consistency Map tile).

## Acceptance criteria

- `/dashboard` shows a responsive Bento grid that collapses cleanly from ultra-wide → 360px (single column on narrow viewports).
- The Consistency Map renders the user's last 365 days of contributions (public + private) using cal-heatmap.
- Heatmap intensity colors come from the Mantine theme (Primer-derived) and switch with theme; verified in both dark and light.
- Each tile slot defines and ships a loading skeleton, an empty state, and an error state — no blank tile, ever.
- Heatmap exposes hooks for Phase 5 to overlay PTO color and "violation" dot on a per-day basis (data API can be a no-op for now).
- All a11y baselines met: keyboard reachable, focus visible, the heatmap has a text/table fallback (`<table>` of date → contribution count).

## Tasks

### Bento layout
- [ ] Create `src/components/Bento/` with `BentoGrid` (Mantine `SimpleGrid` / `Grid`, with a `styled(Grid)` wrapper if custom CSS Grid template areas are needed) and `BentoTile` primitive (a `styled(Card)` extension that handles loading / empty / error / loaded states uniformly). No raw `<div>` tile chrome.
- [ ] Define grid template areas for the spec'd tiles: `EP`, `Consistency`, `WeeklyCodingDays`, `WLB`, `TechStack`. Phase 4 ships only `Consistency`; the rest get placeholder `<BentoTile state="placeholder">`.
- [ ] Responsive breakpoints driven by Mantine's responsive props / breakpoints (or `theme.breakpoints` in the styled wrapper): ultra-wide → 4-col, desktop → 3-col, tablet → 2-col, mobile → 1-col. No horizontal scroll at 360px.
- [ ] Tiles never resize their own height past the grid track — content scrolls inside (Mantine `ScrollArea` for overflow).

### Tile primitives
- [ ] `BentoTile = styled(Card)` accepts `{ title, state, error?, isEmpty?, children, footer? }` and renders the right subtree using Mantine primitives (`Card.Section`, `Group`, `Stack`, `Text`, `ActionIcon`).
- [ ] Loading skeleton: Mantine `Skeleton` (theme-aware out of the box); respects `prefers-reduced-motion`.
- [ ] Empty state: Octicon + one-line copy slot in `spec.md §10` voice, laid out with Mantine `Stack` / `Center`.
- [ ] Error state: Mantine `Alert` (inline) + Mantine `Button` retry that calls TanStack Query `refetch`.

### Consistency Map (cal-heatmap)
- [ ] Install `cal-heatmap` and types.
- [ ] Render the rolling 365-day calendar from `viewer.contributionsCollection.contributionCalendar.weeks[].contributionDays[]`.
- [ ] Color scale: 5 buckets (no contribution → max), all sourced from the Mantine theme's green ramp (Primer-derived) for the active color scheme.
- [ ] Tooltip on cell shows date + contribution count in §10 voice ("3 commits on tue, jan 14.").
- [ ] Expose a `cellAdornments(date) => { color?, overlayDot? }` hook that Phase 5 will populate with PTO + Holiday data. Phase 4 ships this as a no-op.
- [ ] A11y: emit a hidden `<table>` containing `date | contribution count | adornment` so screen readers and tests have something to read.

### Dashboard wiring
- [ ] `/dashboard` mounts `<BentoGrid>` and resolves the user's contributions via the Phase 3 data hook.
- [ ] On boot with cached data, the heatmap renders instantly; a background refetch updates it without flicker.
- [ ] On rate-limit `403`, the global banner from Phase 3 appears and the heatmap stays on the cached snapshot.

### Voice & copy
- [ ] All strings in this phase (titles, empty states, errors) ship in `spec.md §10` voice. Examples: "your year. one square per day.", "no commits in the last 365 days. either you're new, on PTO, or actually resting. all valid."

## Out of scope

- EP, Weekly Coding Days, WLB, Tech Stack tile contents — Phase 5.
- PTO and holiday data flowing into the heatmap — Phase 5 (hooks ready here).
- Bento tile reordering / toggle from settings — Phase 5.
- Sync controls — Phase 5b.
