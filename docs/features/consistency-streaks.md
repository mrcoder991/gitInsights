# Feature — Consistency Map & Streak Modes

53-week × 7-day grid visualization of pure non-merge commits across all repos (public + private), plus a configurable streak counter.

**Spec refs**: linked from `docs/spec.md §6 Data Model & Metric Definitions`. Heatmap engine notes in `spec.md §2 Tech Stack`.

## Definitions

- **Streak**: consecutive days with ≥ 1 contribution.
- **"Active day"** = any contribution type counted by GitHub's contribution calendar.
- The Consistency Map heatmap is **exempt from the Global Timeframe** (see [`global-timeframe.md`](./global-timeframe.md)) and always renders the trailing 53 weeks. Streak counters shown alongside it likewise read from the trailing year, not the global selection — a shorter custom window would defeat the purpose of a year-grid heatmap.

## Streak Modes (user setting)

The product is built for working professionals; resting outside of working days is healthy, not a streak-breaker. The Consistency tile exposes a streak mode toggle in `/settings`. All modes resolve "non-workday" through the user's configured workweek (see [`workweek.md`](./workweek.md)):

- `strict` — every calendar day must have ≥ 1 contribution. Non-workdays count and can break the streak. (Classic GitHub behavior.)
- `skip-non-workdays` (default for new accounts) — non-workdays are **ignored entirely**: they neither extend nor break the streak. A streak survives a "no commits" weekend (or whatever the user's off-days are), but a missed workday still breaks it.
- `workdays-only` — only workdays are evaluated. Contributions made on non-workdays are not counted toward the streak even if present (useful for users who want off-days to be truly off the books).

### Algorithm

For `skip-non-workdays`: walk back day-by-day from today; if a day is a non-workday **or an off-day (PTO or Public Holiday)**, skip without resetting the counter; if it's an evaluable workday with no contribution, the streak ends; otherwise increment. The `strict` and `workdays-only` modes apply the same off-day skip rule on top of their own workweek handling.

### Notes

- The chosen mode applies to **current streak**, **longest streak**, and the streak indicator on the Consistency Map.
- Off-days (PTO and Public Holidays — see [`pto.md`](./pto.md) and [`public-holidays.md`](./public-holidays.md)) always skip in every mode — they never extend or break a streak.
- The configured workweek determines what "non-workday" means; with the default Mon–Fri workweek this matches the prior Sat/Sun behavior.

## Rendering

Implemented as a custom CSS-grid component (no third-party heatmap library). 53-col × 7-row, `aspect-ratio: 1` cells, theme tokens for the intensity ramp (`--gi-heatmap-0..4`). Custom heatmap chosen over cal-heatmap to drop the d3 + cal-heatmap dependency (~270 kB), get pure-CSS responsive sizing, and own the PTO/holiday adornment seam directly.

The data source is `useViewerCommitsByDay({login, range})` on top of `GET /search/commits` (`merge:false`) — pure non-merge commits only. **Not** the GitHub contribution calendar (which counts PRs / issues / reviews / approvals).
