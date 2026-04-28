# Feature — PTO (Paid Time Off)

User-authored set of off-days. Single source of truth for "the user was not expected to work".

**Spec refs**: linked from `docs/spec.md §6 Data Model & Metric Definitions`.

## Data model

- `Pto = { date: 'YYYY-MM-DD' (local TZ), label?: string, kind?: 'vacation' | 'sick' | 'holiday' | 'other' }[]`.
- Stored under `gi.user-data` (see `spec.md §3.F Local User Data`).

## Resolution

- A day is a PTO day iff its local-TZ `YYYY-MM-DD` appears in the set.

## Effects across metrics

Single, consistent rule: **PTO days are excluded from any "expected work" denominator and do not break streaks.**

- **Streak (Consistency)**: PTO days are skipped — they neither extend nor break the streak, in every streak mode.
- **Weekly Coding Days**: PTO days are removed from both the count of active days and the weekly denominator (a 5-day work week with 1 PTO day has 4 Effective Working Days).
- **Commit Momentum**: commits authored on PTO days **still count** toward the score (the work is real), but PTO days are excluded from any "active days" or "consistency multiplier" used by momentum-derived UI.
- **WLB Audit**: PTO surfaces both as a positive signal (days actually taken) and a violation signal (commits made on declared PTO). See [`wlb-audit.md`](./wlb-audit.md) for `PTODaysTaken`, `PTOHonoredRatio`, `PTOViolationCount`.
- **Tech Stack**: unaffected (PTO only filters time-based metrics).

## Heatmap rendering

- PTO days are drawn with a distinct color/pattern on the Consistency Map regardless of commit count, so users can see rest at a glance.
- If a PTO day also has commits, the cell shows the PTO color with a small "violation" dot overlay. ("Commits" here means non-merge commits — see `spec.md §7` for the exact data source.)

## Settings UI

- PTO Calendar: a month-view picker to mark/unmark off-days.
- Supports single-day toggle, range selection (e.g., Dec 23 – Jan 2), an optional short label per entry ("Vacation", "Sick", "Public Holiday"), and a list view to bulk-edit/delete.
- Marked days update every dependent metric live.

## A11y

- PTO state must be exposed via tooltip text and the data-table fallback (color is never the only signal).
