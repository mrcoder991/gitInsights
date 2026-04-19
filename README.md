# gitInsights

A zero-server developer identity dashboard. Read your own GitHub data, run analytics in the browser, and see your work the way you see it — not the way a manager dashboard does.

- Product spec: [`docs/spec.md`](./docs/spec.md)
- Phased implementation plan: [`docs/tasks/README.md`](./docs/tasks/README.md)

## Local dev

```bash
nvm use            # Node 22
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server. |
| `npm run build` | TS project-references typecheck + production build into `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run typecheck` | `tsc -b --noEmit` across all project references. |
| `npm run lint` | ESLint with the Phase 1 policy rules (no raw `styled.div`, no hard-coded colors). |
| `npm run lint:fix` | Same, with auto-fix. |
| `npm run format` | Prettier write across the repo. |

## Where things live

- `src/theme/` — Primer → Mantine token mapping (the *only* place hex/rgb literals are allowed).
- `src/components/` — shared chrome (e.g. `AppShell`).
- `src/pages/` — route components.
- `src/store/` — Zustand stores. Phase 1 ships only `usePreferencesStore` for the theme picker; the real `gi.user-data` IndexedDB store lands in Phase 5.
- `docs/` — spec + per-phase implementation plans.

## Deployment

App ships to GitHub Pages under `/gitInsights/`; the OAuth token-exchange function lives on Vercel. Both are wired up in Phases 6 and 2 respectively.
