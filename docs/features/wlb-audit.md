# Feature — WLB Audit

Work-Life-Balance audit. Bucketed analysis of commit timestamps and off-day discipline.

**Spec refs**: linked from `docs/spec.md §6 Data Model & Metric Definitions`. Glossary in `spec.md §1`.

## Metrics

For every commit's authored timestamp (in the user's local TZ), evaluated over the **Global Timeframe** (see [`global-timeframe.md`](./global-timeframe.md)):

- `LateNightRatio` = commits between 22:00–05:59 / total commits.
- `NonWorkdayRatio` = commits on non-workdays (per the user's configured workweek, see [`workweek.md`](./workweek.md)) / total commits. Replaces the prior "weekend"-only definition.
- `HourHistogram` = 24-bucket count.
- `LongestStreakDays` and `LongestBreakDays` from the contribution calendar.

## PTO-aware additions

- `PTODaysTaken` = count of PTO days in the window — a positive signal we celebrate in the tile copy.
- `PTOHonoredRatio` = `(PTODaysTaken − PTODaysWithCommits) / PTODaysTaken` — how often the user actually unplugged on declared off-days. Undefined when `PTODaysTaken === 0`.
- `PTOViolationCount` = number of PTO days that contained ≥ 1 commit, surfaced as a soft warning ("you committed on 3 of your 12 PTO days").
- `NonWorkdayRatio` and `LateNightRatio` denominators exclude commits made on off-days (PTO or Public Holiday), so a single "vacation hotfix" or "holiday push" doesn't skew the ongoing trend.

## Voice

Every metric on the WLB tile must ship with a one-liner verdict written in the voice defined in `spec.md §10` (blunt, anti-burnout, no moralizing). Examples:

- "12 nights past 22:00 last month. that's a lot. log off."
- "5 of 8 weekend days had commits. weekends are not a feature."
- "you committed on 3 of your 12 PTO days. close the laptop."

## Compute placement

WLB Audit runs in a Web Worker (`wlbAudit.worker.ts`) wrapped with Comlink. See `spec.md §3.E Heavy Compute`. Worker memoization keys include the resolved `{from, to}` plus the PTO / holidays / workweek versions so changes invalidate cleanly.
