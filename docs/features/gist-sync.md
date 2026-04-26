# Feature — Cross-Device Sync (Optional, GitHub Gist)

For a consistent experience across machines, users can opt in to syncing their `gi.user-data` document via a **private GitHub Gist** in their own GitHub account. Off by default; enabling it is the only thing that triggers the `gist` OAuth scope grant.

**Spec refs**: linked from `docs/spec.md §3 Architecture` (cross-device sync) and `docs/spec.md §4.E Settings`. OAuth scope discussion in `spec.md §3.A`.

## What syncs

The entire `gi.user-data` document, which includes everything the user can configure:

- `theme` (`system` / `dark` / `light`).
- `workweek.workdays` (see [`workweek.md`](./workweek.md)).
- `streakMode` (`strict` / `skip-non-workdays` / `workdays-only`) (see [`consistency-streaks.md`](./consistency-streaks.md)).
- `pto[]` (PTO calendar entries; see [`pto.md`](./pto.md)).
- `holidays.regions` and `holidays.overrides` (see [`public-holidays.md`](./public-holidays.md)).
- `preferences.timeframe` (Global Timeframe selection; see [`global-timeframe.md`](./global-timeframe.md)).
- `bento` (tile layout, toggles, ordering).
- `preferences` (any future user-tunable settings).

## What does NOT sync

- Auth token (per-device by definition; never leaves the browser it was issued on).
- TanStack Query / IndexedDB cache of GitHub API responses (per-device performance cache, not user data).
- Any transient UI state (scroll position, last-viewed tab, dialog state).
- A per-device `deviceId` (random UUID generated on first run, used for conflict heuristics).

## Storage shape

- One private Gist per GitHub account, with a stable description `gitinsights:user-data:v1` and a single file `gi.user-data.json`.
- The gist body is the same versioned JSON document used locally (`schemaVersion`, `updatedAt`, `lastWriterDeviceId`, plus the fields above).
- Discovery on a new device: `GET /gists` and find the one matching the description; if none exists, create it on first push.

## Sync triggers

- **Pull**: on app boot (after auth), and when the user clicks **Sync now** in `/settings`.
- **Push**: debounced (≈ 2 s) after any local change to `gi.user-data`; also on explicit **Sync now**.
- All sync work runs in the background; the UI never blocks on it.

## Conflict resolution

- Last-write-wins by `updatedAt` ISO timestamp embedded in the document.
- On pull: if remote `updatedAt` > local `updatedAt`, replace the local document (except for the local `deviceId`).
- On push: write local document with refreshed `updatedAt` and current `lastWriterDeviceId`. Use the gist API's `If-Match`/`updated_at` to detect a concurrent remote update; on mismatch, re-pull, re-merge using last-write-wins, and retry once.
- For the rare two-devices-edit-within-seconds case we accept losing one side's last edit; users can recover via the JSON export/import.

## Failure & offline

- Sync failures are non-fatal: the local document is the source of truth on-device. A small status indicator in `/settings` shows last-sync time and any error.
- If the `gist` scope is revoked from outside the app, sync silently disables itself and the indicator shows "scope revoked, re-enable sync to continue."

## Disable / wipe

- Toggling sync off in `/settings` stops all push/pull but **does not** delete the remote gist by default.
- A separate destructive action **Delete cloud copy** removes the gist; copy must be in the `spec.md §10` voice and explicit ("delete the cloud copy. local data stays.").
- Logout and "Clear local cache" never touch the remote gist.

## Privacy trade-off (must be disclosed in the opt-in dialog)

- The `gist` scope grants gitInsights read/write to **all** of the user's gists (GitHub OAuth limitation; we cannot scope to a single gist).
- The gist itself is **private** but stored on GitHub's servers — meaning settings (theme, workweek, PTO dates) leave the user's device. This is the one place the "all data stays in the browser" promise is relaxed, and the opt-in must say so plainly.
- Commit data, diffs, and computed analytics are never written to the gist — only user-authored settings.
