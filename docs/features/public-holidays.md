# Feature — Public Holidays

Auto-imported off-days for the user's selected region(s), so users don't have to mark national holidays manually. Treated identically to PTO at consumption time; differentiated only in source, settings UI, and tooltip copy.

**Spec refs**: linked from `docs/spec.md §6 Data Model & Metric Definitions`.

## Data source (build-time, not runtime)

- Holiday data is **bundled with the app** at build time as static JSON, sourced from an open-source dataset (e.g., the `nager/Nager.Date` GitHub repo, which is permissively licensed). No third-party API call at runtime — keeps the "no third-party trackers / runtime calls" promise from `spec.md §5` intact and works offline.
- Build pipeline regenerates a sliding window: current year and current ± 1 year (3 years total). A scheduled GitHub Actions job rebuilds yearly so the bundled data stays current.
- Files live at `src/data/holidays/{ISO-3166-region}.json`, e.g., `US.json`, `IN.json`, `GB-ENG.json`. Each entry: `{ date: 'YYYY-MM-DD', name: string, regional?: boolean }`.
- v1 region granularity: country-level for all supported countries; sub-region (state/province) where the dataset provides it. Regions not covered surface "no holiday data for this region — use a custom .ics import (coming later) or mark days manually as PTO."

## User settings

- `holidays.regions: string[]` — zero or more region codes (ISO 3166-1 alpha-2, optionally with a `-` subdivision). Default: `[]` (off). Multi-select supported for users who care about more than one (e.g., a US-based engineer working with an Indian team).
- `holidays.overrides: { date: 'YYYY-MM-DD', treatAs: 'workday' }[]` — per-date opt-out so a user who actually worked on Christmas can untick that single day without disabling holidays entirely. Override list is small and user-authored; never auto-populated.

## Resolution (the single rule)

A date is a **holiday** iff:
- it appears in the union of bundled datasets for `holidays.regions` for that year, AND
- it is not present in `holidays.overrides` with `treatAs: 'workday'`.

Holidays count as **off-days** everywhere off-days are referenced (streak skip, Weekly Coding Days denominator, WLB ratio denominators). The implementation uses a single `isOffDay(date)` helper that returns true if the date is a non-workday OR a PTO day OR a holiday — every metric calls this one function.

## Effects across metrics (mirrors PTO)

- **Streak (Consistency)**: holidays skip — they never extend or break the streak, in every streak mode.
- **Weekly Coding Days**: holidays are removed from both numerator and denominator (a 5-day workweek with one holiday has 4 Effective Working Days; with one holiday + one PTO day, 3).
- **Commit Momentum**: commits on holidays **still count** toward the score; holidays are excluded from any auxiliary "active days" calculations.
- **WLB Audit**: a "you committed on a public holiday" violation count is included in the existing PTO-violation framing — same vibe, different source label in the tooltip ("New Year's Day" vs "PTO: Vacation").
- **Tech Stack**: unaffected.

## Heatmap rendering

- Holiday cells reuse the **PTO color** on the Consistency Map (off-day = off-day; one visual concept, less noise) but the tooltip and a11y label name the source: "Public Holiday: Christmas Day" vs "PTO: Vacation".
- Same "violation dot" overlay as PTO when commits exist on a holiday.
- An icon (Octicon) in the legend disambiguates PTO from Holiday for users who care.

## Sync

- `holidays.regions` and `holidays.overrides` sync via the gist sync feature (see [`gist-sync.md`](./gist-sync.md)).
- The bundled holiday entries themselves do **not** sync — every device computes them locally from the same shipped dataset, keyed by region. This keeps the synced document tiny and version-stable.

## Voice

- Settings copy: "pick your region. national holidays auto-mark as off-days. you can still untick any one if you actually worked."
- Override one-liner: "marked dec 25 as a workday. weird flex but ok."
