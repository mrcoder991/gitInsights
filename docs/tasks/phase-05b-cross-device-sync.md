# Phase 5b — Cross-Device Sync (Private GitHub Gist)

**Goal**: opt-in sync of the entire `gi.user-data` document via a private Gist in the user's own GitHub account, so settings (theme, workweek, streak mode, PTO, holidays, bento layout) follow the user across devices.

**Spec refs**: `spec.md §3.A OAuth Scopes (Incremental)`, `spec.md §3.G Cross-Device Sync`, `spec.md §4.E Settings (Sync)`, `spec.md §6 Security & Privacy`, `spec.md §10 Voice & Copy`, `spec.md §12 Phase 5b`.

**Depends on**: Phase 2 (auth), Phase 5 (`gi.user-data` store).

**Screens touched**: `/settings` (sync section + opt-in dialog), `/callback` (now also handles re-auth with `gist` scope).

## Acceptance criteria

- Sync is **off** by default; the `gist` scope is **never** requested at first login.
- Toggling sync on triggers a re-authorization flow that adds `gist` to the existing scopes; the opt-in dialog explicitly says `gist` grants read/write to **all** the user's gists (the GitHub limitation) and that we only touch ours.
- Once enabled: pull on app boot; debounced (~2 s) push on any `gi.user-data` change; manual **Sync now** button.
- Conflict resolution: last-write-wins by `updatedAt`; on `If-Match`/`updated_at` mismatch, re-pull, merge, retry once.
- Sync failures are non-fatal — the local document remains the source of truth; the settings indicator shows last-sync time and any error in §10 voice.
- Disabling sync does **not** delete the cloud copy. **Delete cloud copy** is a separate destructive action with explicit confirm copy.
- If the `gist` scope is revoked outside the app, sync silently disables and the indicator says "scope revoked, re-enable sync to continue."
- Logout / "Clear local cache" never touch the remote gist.

## Tasks

### Schema bump
- [x] Bump `userData.schemaVersion` and add `updatedAt: string (ISO)` and `lastWriterDeviceId: string` to the document.
- [x] Add a per-device `deviceId` (UUID) generated on first run, stored under `gi.device.id` in `localStorage` — **never** synced.
- [x] Write the migration from v1 → v2.

### Incremental scope re-auth
- [x] When the user toggles **Sync** on, redirect to GitHub authorize with the union scope set: `read:user user:email repo read:org gist`.
- [x] The existing `/callback` exchange runs; the new token replaces the old one in `localStorage`.
- [x] Detect the granted scopes (via `X-OAuth-Scopes` from `GET /user`) and verify `gist` is present before enabling sync; otherwise show a §10-voice error and revert.

### Gist sync client
- [x] `gistSync.ts` module with the contract:
  - `discover()` — `GET /gists`, find one matching description `gitinsights:user-data:v1`.
  - `pull()` — `GET /gists/:id`, parse the `gi.user-data.json` file.
  - `push()` — `PATCH /gists/:id` (or `create()` on first push) with `updated_at` snapshot check.
- [x] On version mismatch: pull, merge with last-write-wins, retry push once.
- [x] On 401/403 from the gist API: disable sync gracefully, leave analytics auth untouched.

### Sync engine
- [x] On app boot (post-auth): if sync is enabled, `pull()`. If remote `updatedAt > local.updatedAt`, replace local doc (preserve `deviceId`).
- [x] On any `gi.user-data` write: debounce ~2 s, then `push()` with refreshed `updatedAt` and current `lastWriterDeviceId`.
- [x] All sync work runs in the background; the UI never blocks. Status indicator shows "syncing…" / "synced N seconds ago".
- [x] Manual **Sync now** button forces an immediate pull-then-push.

### Settings UI
- [x] **Sync** section (off by default):
  - Toggle (triggers the opt-in dialog).
  - Last-sync timestamp.
  - **Sync now** button.
  - **Delete cloud copy** destructive action with §10-voice confirm.
  - Status row that surfaces error states.
- [x] Opt-in dialog copy explicitly mentions:
  - what gets synced (theme, workweek, streak mode, PTO, holidays, bento, preferences),
  - what does **not** sync (auth token, query cache, transient UI),
  - that the `gist` scope grants read/write to **all** user gists (GitHub limitation), and we only touch ours.

### Telemetry-free observability
- [x] Local-only sync log (last N events) viewable in settings ("show recent sync activity").

### Tests
- [x] Unit: conflict resolution (local newer / remote newer / equal timestamps).
- [x] Unit: graceful disable on 401/403 from gist API without affecting `useAuth`.
- [x] Unit: discovery picks the gist with the right description, ignores unrelated gists.
- [ ] e2e (mocked): toggle on → discover/create → push → toggle off → cloud copy persists; explicit delete removes it. _(no e2e harness wired in this repo yet — covered by unit tests for now.)_

## Out of scope

- Multi-account sync conflict beyond last-write-wins (acknowledged in `spec.md §3.G`).
- Encrypted-at-rest gist contents (data is plaintext JSON; users are warned via the opt-in dialog).
- Migration from OAuth App to GitHub App for finer-grained gist scoping — `spec.md §11`.
