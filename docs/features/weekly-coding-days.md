# Feature — Weekly Coding Days

A per-ISO-week count of distinct days with ≥ 1 contribution, evaluated in the user's local TZ.

**Spec refs**: linked from `docs/spec.md §6 Data Model & Metric Definitions`.

## Definition

- `expectedDays(week)` = days in that week that are workdays (per [`workweek.md`](./workweek.md)) AND are not off-days (i.e., not PTO and not a Public Holiday — see [`pto.md`](./pto.md) and [`public-holidays.md`](./public-holidays.md)).
- `activeDays(week)` = `expectedDays(week)` ∩ days with ≥ 1 contribution.
- `WeeklyCodingDays(week)` = `|activeDays(week)|` (numerator) presented over `|expectedDays(week)|` (denominator), e.g. "4 / 5" for a Mon–Fri user with one PTO day → "x / 4".
- Tile shows: current (or latest-in-window) week's `numerator / denominator`, a single-line caption for context, a **bucketed histogram** of average weekly coding days across the Global Timeframe, and an all-time best week.

## Histogram bucketing (timeframe-aware)

Showing one bar per ISO week works for ~12 weeks but breaks down for longer windows (52 bars on a year is unreadable). The bucket size adapts to the resolved Global Timeframe (see [`global-timeframe.md`](./global-timeframe.md)) so the histogram always lands in a readable 4–14 bar range:

| Window length         | Bucket                   | Bar count (typical) | Bar value                                                                                                         |
| --------------------- | ------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| ≤ 14 days             | per ISO week             | 1–2                 | that week's `activeDays / expectedDays`                                                                           |
| 15 days – 12 weeks    | per ISO week             | 3–12                | that week's `activeDays / expectedDays`                                                                           |
| > 12 weeks – 6 months | per ISO week, pairs of 2 | 7–13                | mean of the two weeks' `activeDays / expectedDays`                                                                |
| > 6 months – 365 days | per calendar month       | 7–12                | mean of `activeDays / expectedDays` across the month's weeks (weeks split by a month boundary contribute pro-rata) |

### Rules

- A bucket's value is the **mean weekly ratio** (`activeDays / expectedDays`) over the weeks it contains, not a sum — this keeps the y-axis stable as bucket size changes.
- Buckets with `expectedDays` summed to 0 (entirely off-days, e.g. a Dec 24–Jan 2 holiday block) render as a flat "rest" bar in the off-day color, not a zero bar — same vibe as the heatmap PTO cells.
- Partial buckets at the window edges (e.g. a half-month at `from`) are kept and labeled with the partial range; their value is still a mean over the weeks they actually contain.
- Tooltip on each bar shows: bucket label ("mar 2026", "feb 3 – feb 9"), the mean ratio, the count of weeks in the bucket, and the best/worst week inside it.
- Bar count is the single source of truth for layout — the tile sparkline container sizes itself to the bar count, no horizontal scroll.

The implementation lives in a single `bucketWeeklyCodingDays(weeks, timeframe)` helper so the picker, the tile, and tests all agree on the same buckets.
