# gitInsights — Features

Each file in this folder is the **deep specification for one product feature**. The top-level [`docs/spec.md`](../spec.md) carries the cross-cutting architecture, voice, and a high-level summary of every feature; the files in here are where two engineers go when they need to agree on the exact behavior, data model, edge cases, and metric semantics of a single feature.

## Features

| File | What it covers |
| --- | --- |
| [`commit-momentum.md`](./commit-momentum.md) | Recency-weighted commit score (Bento `EP` tile) and the future Diff Delta extension |
| [`consistency-streaks.md`](./consistency-streaks.md) | 53-week heatmap (Consistency Map) and the three streak modes |
| [`weekly-coding-days.md`](./weekly-coding-days.md) | Per-ISO-week coding days tile and its timeframe-aware bucketed histogram |
| [`wlb-audit.md`](./wlb-audit.md) | Late-night, non-workday, PTO-honored, hour histogram, longest break |
| [`tech-stack.md`](./tech-stack.md) | Top languages by weighted bytes |
| [`workweek.md`](./workweek.md) | User-authored "working days" set; drives every "non-workday" reference |
| [`pto.md`](./pto.md) | User-authored off-days; effects across every dependent metric |
| [`public-holidays.md`](./public-holidays.md) | Region-based bundled holiday data and the unified `isOffDay()` rule |
| [`global-timeframe.md`](./global-timeframe.md) | Dashboard-level timeframe filter (presets / month / quarter / custom, 365-day cap) |
| [`gist-sync.md`](./gist-sync.md) | Optional opt-in cross-device sync via a private GitHub Gist |

## Conventions

- Each feature file starts with a one-paragraph summary, then drills into data model, resolution rules, effects across metrics, edge cases, UI/settings, and voice.
- Feature files reference each other with relative links rather than restating shared concepts.
- The cross-cutting `gi.user-data` schema lives in [`../spec.md §3.F`](../spec.md); feature files assume it.
- Implementation plans live in [`../tasks/`](../tasks/) — feature files are the **what**, task files are the **how**.
