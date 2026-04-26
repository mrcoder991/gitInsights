# Feature — Workweek

User-authored set of weekdays considered "working days". Single source of truth for "the user was expected to work on this day-of-week".

**Spec refs**: linked from `docs/spec.md §6 Data Model & Metric Definitions` (high-level summary). This file is the deep spec.

## Data model

- `Workweek = { workdays: number[] }` where each entry is `0..6` (`0 = Sunday`, `6 = Saturday`). Default: `[1, 2, 3, 4, 5]` (Mon–Fri).
- Stored under `gi.user-data` (see `spec.md §3.F Local User Data`).

## Resolution

- A date is a **workday** iff its local-TZ day-of-week is in `workdays`; otherwise it is a **non-workday** (replaces the previous hard-coded "weekend" concept).

## Effects across metrics

Every `§6` reference to "weekend" / "Sat-Sun" resolves through this set:

- **WLB Audit**: `WeekendRatio` is renamed conceptually to `NonWorkdayRatio` and uses `workdays` to decide what counts.
- **Streak modes** (see [`consistency-streaks.md`](./consistency-streaks.md)): use `workdays` to decide what's "evaluable".
- **Weekly Coding Days** (see [`weekly-coding-days.md`](./weekly-coding-days.md)): uses `workdays` to compute the denominator.

## Edge cases

- Empty `workdays` is rejected by the UI (must have ≥ 1 day).
- `workdays = [0..6]` (every day) collapses `strict` and `skip-non-workdays` to the same behavior — that's fine and explicit.

## Settings UI

- Presets: Mon–Fri (default), Sun–Thu, Mon–Thu (4-day), plus a custom multi-select.
- Day labels respect the user's locale and first-day-of-week ordering.

## A11y

- Settings UI must label days by name, not just position, and respect the user's locale for first-day-of-week ordering.
