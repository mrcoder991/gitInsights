# Phase 1 — Vite Scaffolding & Theming

**Goal**: lay down the app shell, routes, the Mantine + Styled Components stack, and the dark/light/system theme system. After this phase, every later screen has a `<MantineProvider>` + nested `<ThemeProvider>` to mount inside, a route to live in, and a Primer-derived Mantine theme to consume.

**Spec refs**: `spec.md §2 Tech Stack`, `spec.md §4 App Sitemap`, `spec.md §4 Cross-cutting UI Requirements (Component policy + Theming)`, `spec.md §3.F Local User Data`, `spec.md §12 Phase 1`.

**Depends on**: Phase 0.

**Screens touched**: `/` (shell only), `/callback` (placeholder), `/dashboard` (placeholder), `/u/:username` (placeholder), `/settings` (theme picker working), `*` (basic in-app 404).

## Acceptance criteria

- Visiting `/`, `/callback`, `/dashboard`, `/u/:username`, `/settings`, and any unmatched route renders a corresponding placeholder page (no auth gate yet). Every placeholder is built from Mantine primitives (e.g., `Container`, `Title`, `Text`) — no raw HTML.
- The app respects `prefers-color-scheme` on first visit; user override in `/settings` to `dark` / `light` persists across reloads and reacts live to OS changes when set to `system`.
- No component contains a hard-coded hex / rgb color — everything resolves through the Mantine theme (which maps from `@primer/primitives`).
- A single Mantine theme drives both `<MantineProvider>` *and* the nested Styled Components `<ThemeProvider>`, so `styled(Card)`-style extensions read the same tokens as Mantine itself.
- Mantine's `colorScheme` is the single source for theme; switching it instantly re-renders every component (no flash, no reload).

## Tasks

### Routing
- [x] Install `react-router-dom` v6 and wire `<BrowserRouter>` with `basename` set from `import.meta.env.BASE_URL` so it works under `/gitInsights/` on GH Pages.
- [x] Define the route tree: `/`, `/callback`, `/dashboard`, `/u/:username`, `/settings`, `*` (in-app 404).
- [x] Each route renders a minimal placeholder page with the route name as `<h1>`. Phase 8 will polish the 404; this phase just ensures no blank screen.

### Mantine + Primer token mapping
- [x] Install `@mantine/core`, `@mantine/hooks`, and Mantine's peer styles. Mount one top-level `<MantineProvider>` in `main.tsx`.
- [x] Install `styled-components` and `@primer/primitives` (and `@primer/octicons-react` for icons per `spec.md §2`).
- [x] Build `src/theme/` that maps Primer's `dark` and `light` palettes (plus shared spacing / typography / radius / shadows) into a Mantine `theme` object. This `mantineTheme` is the single export consumed by both providers below.
- [x] Mount the provider stack: `<MantineProvider theme={mantineTheme} defaultColorScheme="auto"> → <ThemeProvider theme={mantineTheme}> → <App/>`. Styled Components reads `({ theme }) => theme...` from the same Mantine theme — one source of truth.
- [x] Replace any default Vite global CSS with a Mantine-driven baseline; pull resets/typography from Mantine + `Box` primitives. No `GlobalStyle` reaching for raw `body {}` selectors unless absolutely required (and only via Mantine's CSS variables).
- [x] Add lint rules / CI grep that fail the build on:
  - hard-coded `#xxxxxx` / `rgb(` / `hsl(` outside `src/theme/`,
  - `styled.div` / `styled.span` / `styled.button` / `styled.a` (raw HTML targets) — Styled Components must wrap a Mantine component or layout primitive (`styled(Box)`, `styled(Card)`, `styled(Group)`, …).

### Theme controller (system / dark / light)
- [x] Implement an app-level theme controller that:
  - reads `theme` (`'system' | 'dark' | 'light'`) from a temporary store (the real `gi.user-data` store lands in Phase 5; for now use a Zustand store backed by `localStorage` under `gi.theme.tmp`),
  - if `system`, resolves via `window.matchMedia('(prefers-color-scheme: dark)')` and subscribes to `change` events,
  - calls Mantine's `useMantineColorScheme().setColorScheme(...)` so Mantine and every `styled(MantineComponent)` repaint together.
- [x] Add `<meta name="color-scheme" content="dark light">` to `index.html`.
- [x] Verify cal-heatmap and Recharts color knobs accept theme-aware values from the Mantine theme / CSS variables (we don't render them yet; this is just verifying the API surface so Phase 4 isn't blocked).

### Settings page (theme only)
- [x] Build `/settings` with a single section: **Theme** — three radios using Mantine's `Radio.Group` / `SegmentedControl` (`system` (default), `dark`, `light`).
- [x] Selection persists, applies immediately via the theme controller, and reflects current OS preference when `system` is selected.
- [x] Voice: labels and helper copy follow `spec.md §10` (e.g. "system — match my OS. dark. light.").

### State & a11y baseline
- [x] Install Zustand; create a `usePreferencesStore` for the temporary theme key (will be replaced by `gi.user-data` in Phase 5).
- [x] Verify keyboard nav across the routes and the theme radios; visible focus ring on every interactive element.

## Out of scope

- Auth, GitHub data, real `gi.user-data` IndexedDB store — Phase 2, 3, 5 respectively.
- Bento layout — Phase 4.
- Workweek / streak mode / PTO / holidays settings UI — Phase 5.
- Sync controls — Phase 5b.
