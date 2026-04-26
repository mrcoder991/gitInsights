# Phase 0 — Project Conventions & Tooling

**Goal**: lock in the build/lint/test/Node baseline so every later phase can move fast without bikeshedding tooling.

**Spec refs**: `spec.md §2 Tech Stack`, `spec.md §8 Folder Structure`, `spec.md §9 Environment Variables`, `spec.md §12 Phase 0`.

**Depends on**: nothing.

**Screens touched**: none.

## Acceptance criteria

- `npm install` from a fresh clone succeeds on Node 22.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e` all exist and pass on an empty project.
- A pre-commit hook runs ESLint + Prettier on staged files.
- `.env.example` documents every required key.

## Tasks

- [ ] Initialize project with `npm create vite@latest` (React + TypeScript template), strict TS (`"strict": true`, `"noUncheckedIndexedAccess": true`).
- [ ] Pin Node in `.nvmrc` (`22`) and in `package.json`'s `engines.node` (`>=22 <23`). Pin npm if the team wants reproducible installs.
- [ ] Install and configure ESLint (typescript-eslint, react, react-hooks, jsx-a11y) and Prettier; add `eslint-config-prettier` to disable conflicting rules.
- [ ] Install Husky + lint-staged; pre-commit runs Prettier + ESLint on staged files only.
- [ ] Install Vitest + React Testing Library + jsdom; one example unit test passes.
- [ ] Install Playwright; one example smoke test (loads `/`, asserts title) passes against `npm run dev`.
- [ ] Add npm scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `lint:fix`, `format`, `test`, `test:watch`, `test:e2e`.
- [ ] Create `.env.example` with the frontend keys from `spec.md §9` (`VITE_GITHUB_CLIENT_ID`, `VITE_PROXY_URL`, `VITE_OAUTH_REDIRECT_URI`), each with a comment.
- [ ] Add `.gitignore` covering `node_modules`, `dist`, `.env`, `.env.local`, Playwright report dirs, OS junk.
- [ ] Add a top-level `README.md` stub pointing to `docs/spec.md` and `docs/tasks/README.md`.

## Out of scope

- Folder structure beyond what Vite scaffolds — that lands gradually as features arrive (Phase 1+).
- CI integration — Phase 7.
