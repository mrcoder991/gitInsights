# gitInsights — Tasks

Implementation tasks broken out per build phase. Each file has a goal, the spec sections it implements, dependencies on prior phases, the screens / components it touches, an acceptance checklist, and a concrete task list. Source of truth for product behavior is always [`../spec.md`](../spec.md); these files describe **how** to build it, not **what** it should do.

## How to use

- Work phases roughly in order. Phase 0 → 1 → 2 → 3 → 4 → 5 / 5b → 6 → 7 → 8.
- `Phase 5b` (sync) is parallelizable with `Phase 6/7` and gated on Phase 5 shipping the `gi.user-data` store.
- Tick checkboxes in each phase file as work lands. When a phase is fully checked, move it under "Done" in the table below.
- Every PR should reference the phase file (e.g. `docs/tasks/phase-04-bento-and-heatmap.md`) and the spec section(s) it implements.

## Phases

| # | File | Goal | Status |
|---|---|---|---|
| 0 | [phase-00-tooling.md](./phase-00-tooling.md) | Project conventions, lint, test, Node pin | not started |
| 1 | [phase-01-scaffolding-and-theming.md](./phase-01-scaffolding-and-theming.md) | Vite + Router + Mantine + Primer→Mantine theme + dark/light/system | not started |
| 2 | [phase-02-auth-and-proxy.md](./phase-02-auth-and-proxy.md) | OAuth flow, Vercel token proxy, `useAuth` | not started |
| 3 | [phase-03-github-data-layer.md](./phase-03-github-data-layer.md) | Octokit + TanStack Query + IndexedDB cache | not started |
| 4 | [phase-04-bento-and-heatmap.md](./phase-04-bento-and-heatmap.md) | Bento grid + Consistency Map (cal-heatmap) | not started |
| 5 | [phase-05-analytics-wlb-pto-holidays.md](./phase-05-analytics-wlb-pto-holidays.md) | EP, WLB, Weekly Coding Days, Workweek, PTO, Public Holidays, `gi.user-data` store | not started |
| 5b | [phase-05b-cross-device-sync.md](./phase-05b-cross-device-sync.md) | Opt-in private-Gist sync of `gi.user-data` | not started |
| 6 | [phase-06-deployment.md](./phase-06-deployment.md) | GitHub Pages SPA hack + Vercel deploy | not started |
| 7 | [phase-07-cicd-quality.md](./phase-07-cicd-quality.md) | GitHub Actions CI, build, deploy, Lighthouse | not started |
| 8 | [phase-08-polish-and-launch.md](./phase-08-polish-and-launch.md) | 404, OG image, README, privacy page | not started |

## Screen → Phase matrix

Where each screen from `spec.md §4` actually gets built.

| Screen | First appears in | Final shape lands in |
|---|---|---|
| `/` Landing / Login | Phase 1 (shell) | Phase 2 (login button + scope disclosure) |
| `/callback` OAuth Callback | Phase 2 | Phase 2 |
| `/dashboard` (Bento) | Phase 4 (layout + Consistency Map) | Phase 5 (EP, Weekly Coding Days, WLB, Tech Stack, PTO/holiday rendering) |
| `/u/:username` Public Profile | _deferred — TBD per spec §4.D / §11_ | _deferred_ |
| `/settings` | Phase 1 (theme picker) | Phase 5 (workweek, streak mode, PTO calendar, holidays) → Phase 5b (sync controls) |
| `*` 404 (in-app) | Phase 1 (route exists) | Phase 8 (branded copy) |

## Cross-cutting concerns (apply to every phase)

- **Voice & copy**: every user-facing string follows `spec.md §10`. No "Oops!", no generic "An error occurred." See the Don't / Do examples there.
- **A11y**: WCAG 2.1 AA, keyboard nav, focus rings, color is never the only signal.
- **Component policy**: every UI element is a Mantine primitive or a `styled(MantineComponent)` extension. No raw HTML components — `styled.div` / `styled.span` / `styled.button` etc. are not allowed (lint enforced). See `spec.md §4 Cross-cutting UI Requirements`.
- **No hard-coded colors**: every surface (Mantine + Styled Components, including cal-heatmap and Recharts) resolves through the shared Mantine theme that's mapped from `@primer/primitives`.
- **No third-party runtime calls**: only `api.github.com` and the Vercel token proxy. Bundled assets only for things like the holidays dataset.
- **TypeScript strict**: every PR typechecks clean.
- **Cache invalidation**: any worker-memoized result must include the relevant settings version (PTO, holidays, workweek) in its key.

## Out of scope for v1 (see `spec.md §11`)

- Public profile model (`/u/:username`).
- GitHub App migration.
- Custom `.ics` import for holidays.
- Light theme tweaks beyond Primer defaults.
