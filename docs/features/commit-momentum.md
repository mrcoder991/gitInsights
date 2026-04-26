# Feature — Commit Momentum (and future Diff Delta)

Recency-weighted score of pure non-merge commits attributed to the viewer. The Bento grid area is still labeled `EP` in code for layout stability.

**Spec refs**: linked from `docs/spec.md §6 Data Model & Metric Definitions`. Glossary in `spec.md §1`.

## Definition

`CommitMomentum = sum over commits in window of RecencyWeight(commit)`

- **Commits in scope**: same definition as the Consistency Map — pure non-merge commits attributed to the viewer (`GET /search/commits` with `merge:false`). Each commit contributes **one unit** scaled only by recency (no line-level diff size in v1).
- **Window**: the **Global Timeframe** (see [`global-timeframe.md`](./global-timeframe.md)). Default selection is "last 12 months" → rolling 365 days. Commits outside the resolved `{from, to}` have `RecencyWeight` 0 and are omitted.
- **`RecencyWeight`**: linear decay from 1.0 (now) to 0.25 (365 days ago) within the window; see implementation in `src/analytics/diffDelta.ts` (`recencyWeight`).
- Commits authored on off-days (PTO or Public Holiday) are included in the sum; off-days are excluded from any auxiliary "active days in window" used by momentum-derived UI.

## Diff Delta (future: diff-weighted momentum)

When the app hydrates per-commit additions/deletions/files (e.g. via `repos.getCommit`), Commit Momentum **may** be extended to weight each commit by diff size:

`CommitMomentum_diff = sum over commits in window of DiffDelta(commit) * RecencyWeight(commit)`

`DiffDelta = log2(1 + additions + deletions) + 0.5 * filesChanged − MergePenalty − VendorPenalty`

- `MergePenalty`: 5 if commit is a merge commit, else 0.
- `VendorPenalty`: 0.9 multiplier if > 80% of changed paths match vendor patterns (`node_modules/`, `vendor/`, `*.lock`, `dist/`).
- Floored at 0.

Until that mode ships, `DiffDelta` remains implemented as a pure function for tests and forward compatibility (`src/analytics/diffDelta.ts`).

## Compute placement

Commit Momentum runs in a Web Worker (`commitMomentum.worker.ts`) wrapped with Comlink. See `spec.md §3.E Heavy Compute`. Worker memoization keys include the resolved `{from, to}` plus the PTO / holidays / workweek versions so changes invalidate cleanly.
