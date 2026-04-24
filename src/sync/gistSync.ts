// Thin REST client for the cross-device sync gist (spec §3.G). Talks to the
// GitHub REST API directly — sync is background work, not a UI query, so it
// sits outside the TanStack Query layer. The conflict path reads remote
// `updated_at`, compares against the caller's cached snapshot, and only
// PATCHes if nothing has moved.

import { migrateUserData, MigrationError } from '../userData/migrations';
import type { UserData } from '../userData/schema';

const GISTS_BASE = 'https://api.github.com/gists';
export const GIST_DESCRIPTION = 'gitinsights:user-data:v1';
export const GIST_FILENAME = 'gi.user-data.json';

export type GistRef = {
  gistId: string;
  // Remote `updated_at`. If it shifts under us between snapshot and PATCH,
  // we throw `GistConflictError` and the caller re-pulls / merges / retries.
  updatedAt: string;
};

export class GistAuthError extends Error {
  readonly status: number;
  constructor(status: number, message = 'gist_unauthorized') {
    super(message);
    this.name = 'GistAuthError';
    this.status = status;
  }
}

export class GistConflictError extends Error {
  constructor(message = 'gist_conflict') {
    super(message);
    this.name = 'GistConflictError';
  }
}

type GistFile = { filename?: string; content?: string };
type GistMetadata = {
  id: string;
  description: string | null;
  updated_at: string;
  files: Record<string, GistFile>;
};

async function authedFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (response.status === 401 || response.status === 403) {
    throw new GistAuthError(response.status);
  }
  return response;
}

export async function discover(token: string): Promise<GistRef | null> {
  // First page only; once discovered the gistId is cached locally so the
  // > 100 gists case never re-runs discovery.
  const response = await authedFetch(token, `${GISTS_BASE}?per_page=100`);
  if (!response.ok) {
    throw new Error(`gist_list_failed_${response.status}`);
  }
  const list = (await response.json()) as Array<Pick<GistMetadata, 'id' | 'description' | 'updated_at'>>;
  const match = list.find((g) => g.description === GIST_DESCRIPTION);
  if (!match) return null;
  return { gistId: match.id, updatedAt: match.updated_at };
}

export async function pull(
  token: string,
  gistId: string,
): Promise<{ doc: UserData; ref: GistRef }> {
  const response = await authedFetch(token, `${GISTS_BASE}/${gistId}`);
  if (response.status === 404) {
    throw new Error('gist_not_found');
  }
  if (!response.ok) {
    throw new Error(`gist_get_failed_${response.status}`);
  }
  const meta = (await response.json()) as GistMetadata;
  const file = meta.files[GIST_FILENAME];
  if (!file?.content) {
    throw new Error('gist_payload_missing');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.content);
  } catch {
    throw new Error('gist_payload_invalid_json');
  }
  let doc: UserData;
  try {
    const result = migrateUserData(parsed);
    doc = result.data;
  } catch (err) {
    if (err instanceof MigrationError) throw err;
    throw new Error('gist_payload_unreadable');
  }
  return { doc, ref: { gistId, updatedAt: meta.updated_at } };
}

// Creates the sync gist on first push. Description is the discovery anchor.
export async function create(token: string, doc: UserData): Promise<GistRef> {
  const response = await authedFetch(token, GISTS_BASE, {
    method: 'POST',
    body: JSON.stringify({
      description: GIST_DESCRIPTION,
      public: false,
      files: {
        [GIST_FILENAME]: { content: serialize(doc) },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`gist_create_failed_${response.status}`);
  }
  const meta = (await response.json()) as GistMetadata;
  return { gistId: meta.id, updatedAt: meta.updated_at };
}

// GitHub's gist API doesn't honor `If-Match` on PATCH, so we approximate:
// GET the current metadata, compare `updated_at` against the cached
// snapshot, and PATCH only if they match. Mismatch → `GistConflictError`,
// caller re-pulls / merges / retries once.
export async function push(
  token: string,
  gistId: string,
  doc: UserData,
  expectedUpdatedAt: string,
): Promise<GistRef> {
  const head = await authedFetch(token, `${GISTS_BASE}/${gistId}`);
  if (head.status === 404) {
    throw new Error('gist_not_found');
  }
  if (!head.ok) {
    throw new Error(`gist_get_failed_${head.status}`);
  }
  const meta = (await head.json()) as GistMetadata;
  if (meta.updated_at !== expectedUpdatedAt) {
    throw new GistConflictError();
  }

  const response = await authedFetch(token, `${GISTS_BASE}/${gistId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      description: GIST_DESCRIPTION,
      files: { [GIST_FILENAME]: { content: serialize(doc) } },
    }),
  });
  if (response.status === 412 || response.status === 409) {
    throw new GistConflictError();
  }
  if (!response.ok) {
    throw new Error(`gist_patch_failed_${response.status}`);
  }
  const updated = (await response.json()) as GistMetadata;
  return { gistId, updatedAt: updated.updated_at };
}

export async function deleteGist(token: string, gistId: string): Promise<void> {
  const response = await authedFetch(token, `${GISTS_BASE}/${gistId}`, {
    method: 'DELETE',
  });
  if (response.status === 404) return;
  if (!response.ok) {
    throw new Error(`gist_delete_failed_${response.status}`);
  }
}

// Last-write-wins by ISO `updatedAt`. Single source of truth for both the
// sync engine and the unit tests.
export function resolveByUpdatedAt(local: UserData, remote: UserData): UserData {
  if (remote.updatedAt > local.updatedAt) return remote;
  return local;
}

function serialize(doc: UserData): string {
  return JSON.stringify(doc, null, 2);
}
