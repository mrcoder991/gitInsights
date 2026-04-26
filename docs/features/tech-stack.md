# Feature — Tech Stack Inference

Top languages by weighted bytes across the user's owned + contributed repos within the configured window.

**Spec refs**: linked from `docs/spec.md §6 Data Model & Metric Definitions`.

## Definition

- Aggregate `repository.languages` weighted by bytes across the user's owned + contributed repos within the **Global Timeframe** (see [`global-timeframe.md`](./global-timeframe.md); defaults to the last 12 months).
- Top N languages displayed; long tail grouped as "Other".
- Repos with zero contributions in the resolved window drop out.

## Data source

- `repoLanguages(owner, name)`: GraphQL — top languages by bytes per repo.
- Repo set comes from the same source the rest of the dashboard uses (viewer-owned + contributed repos, public + private).

## Notes

- Tech Stack is unaffected by PTO and Public Holidays — those only filter time-based metrics.
- The "Other" bucket prevents a long thin tail from dominating the visual — final cutoff is a layout / design call.
