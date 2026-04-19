# Phase 3 — GitHub Data Layer (GraphQL + Caching)

**Goal**: every GitHub read in the app goes through one typed, cached, rate-limit-aware path. After this phase, Phase 4/5 can request `viewer.contributionsCollection` (or any spec'd query) without thinking about HTTP, cache, or pagination.

**Spec refs**: `spec.md §3.D Rate Limiting & Caching`, `spec.md §3.H Error Handling`, `spec.md §6 PTO/etc references to data sources`, `spec.md §7 GitHub API Surface`, `spec.md §12 Phase 3`.

**Depends on**: Phase 2 (need a real `viewer` token).

**Screens touched**: none directly — pure infra. Light loading-state demo on `/dashboard` placeholder is fine for verification.

## Acceptance criteria

- A single `useGitHub` (or per-query) hook returns typed data for every query in `spec.md §7`.
- TanStack Query persists its cache to IndexedDB; on a cold reload, the dashboard renders from cache instantly while a background refetch runs.
- Hitting GitHub's `403` rate limit shows a non-blocking banner with the reset time and keeps showing cached data — never a blank screen.
- A SAML/SSO `403` shows an actionable message with a link to the user's org SSO authorization page.
- Network / 5xx errors retry with exponential backoff (TanStack Query defaults), then surface an inline error tile with a retry button.
- All error / empty / banner copy follows `spec.md §10` voice.

## Tasks

### Octokit client
- [ ] Install `@octokit/graphql`, `@octokit/rest`, and `graphql-tag` (or stick with template literals).
- [ ] Build `src/api/github.ts`: factory that returns `{ graphql, rest }` clients pre-configured with `Authorization: bearer <token>` from `useAuth`.
- [ ] Add typed wrappers for the `spec.md §7` queries: `viewerProfile`, `viewerContributions(from, to)`, `viewerOrgs`, `repoCommitHistory`, `repoLanguages`. Use TypeScript types generated from a hand-written GraphQL schema subset (no codegen tool in v1; revisit if drift becomes a problem).
- [ ] Add REST fallbacks: `GET /user`, `GET /repos/{owner}/{repo}/commits/{sha}` for commit-level diff stats when GraphQL omits them.

### TanStack Query setup
- [ ] Install `@tanstack/react-query` and `@tanstack/query-async-storage-persister` + `idb-keyval`.
- [ ] Configure a single `QueryClient` with the staleTime defaults from `spec.md §3.D`:
  - contribution / commit history → 1 hour,
  - repo metadata → 24 hours,
  - `viewer` → 5 minutes.
- [ ] Wire the IndexedDB persister with a key namespaced to `viewer.login` so multi-account switching doesn't cross-pollute.
- [ ] Set `gcTime` long enough to retain cache across sessions (e.g., 7 days).

### Pagination
- [ ] For `repoCommitHistory`, use cursor-based pagination via GraphQL `pageInfo`. Default cap: 5,000 commits per fetch with a "load more" affordance (real UI lands in Phase 5).
- [ ] Implement `useInfiniteQuery` wrappers for paginated queries.

### Rate-limit and error handling
- [ ] Detect `403` rate-limit responses (check `x-ratelimit-remaining` / `x-ratelimit-reset` headers and the body's `message`); emit a global `rate-limit` event consumed by a top-level banner component.
- [ ] Detect `403` SAML SSO required (`x-github-sso` header); surface the linked SSO URL in an actionable inline error.
- [ ] On `401`, hand off to `useAuth.logout()` (covered by Phase 2).
- [ ] All retry-then-fail surfaces render an inline error tile with a retry button — never a full-screen modal.

### Multi-account isolation
- [ ] Cache key prefix includes `viewer.login`. Switching accounts (logout → login as a different user) does not surface another user's cached data.
- [ ] On logout, `Clear local cache` (Phase 5 settings) wipes the entire IndexedDB persistence store.

### Verification
- [ ] Unit tests for the rate-limit detector and the SSO-error mapper.
- [ ] A throwaway demo on `/dashboard` showing `viewer.login` and `contributionsCollection.totalContributions` for the last year — confirms the full chain works end-to-end. Will be replaced in Phase 4/5.

## Out of scope

- The actual `gi.user-data` IndexedDB store (Phase 5). This phase only persists the **query cache**, not user-authored settings.
- Web Workers — Phase 5.
- Tile UI / loading skeletons / empty states — Phase 4.
