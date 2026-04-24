import { afterEach, describe, expect, it, vi } from 'vitest';

import { cloneDefaultUserData } from '../../userData/schema';
import {
  GIST_DESCRIPTION,
  GIST_FILENAME,
  GistAuthError,
  GistConflictError,
  discover,
  pull,
  push,
  resolveByUpdatedAt,
} from '../gistSync';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('resolveByUpdatedAt', () => {
  it('keeps local when local.updatedAt is newer', () => {
    const local = { ...cloneDefaultUserData(), updatedAt: '2026-04-24T10:00:00.000Z' };
    const remote = { ...cloneDefaultUserData(), updatedAt: '2026-04-24T09:00:00.000Z' };
    expect(resolveByUpdatedAt(local, remote)).toBe(local);
  });

  it('takes remote when remote.updatedAt is newer', () => {
    const local = { ...cloneDefaultUserData(), updatedAt: '2026-04-24T09:00:00.000Z' };
    const remote = { ...cloneDefaultUserData(), updatedAt: '2026-04-24T10:00:00.000Z' };
    expect(resolveByUpdatedAt(local, remote)).toBe(remote);
  });

  it('keeps local on equal timestamps', () => {
    const t = '2026-04-24T10:00:00.000Z';
    const local = { ...cloneDefaultUserData(), updatedAt: t };
    const remote = { ...cloneDefaultUserData(), updatedAt: t };
    expect(resolveByUpdatedAt(local, remote)).toBe(local);
  });
});

describe('discover', () => {
  it('returns the gist matching the canonical description', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [
        { id: 'unrelated-1', description: 'my notes', updated_at: '2026-04-01T00:00:00Z' },
        { id: 'target', description: GIST_DESCRIPTION, updated_at: '2026-04-22T00:00:00Z' },
        { id: 'unrelated-2', description: null, updated_at: '2026-04-20T00:00:00Z' },
      ]),
    );

    const ref = await discover('tok');
    expect(ref).toEqual({ gistId: 'target', updatedAt: '2026-04-22T00:00:00Z' });
  });

  it('returns null when no matching gist exists', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [
        { id: 'a', description: 'something else', updated_at: '2026-04-01T00:00:00Z' },
      ]),
    );
    expect(await discover('tok')).toBeNull();
  });

  it('throws GistAuthError on 401 (graceful disable path)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: 'bad creds' }));
    await expect(discover('tok')).rejects.toBeInstanceOf(GistAuthError);
  });

  it('throws GistAuthError on 403 (scope revoked path)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { message: 'forbidden' }));
    await expect(discover('tok')).rejects.toBeInstanceOf(GistAuthError);
  });
});

describe('pull', () => {
  it('parses and migrates the gist payload', async () => {
    const doc = { ...cloneDefaultUserData(), updatedAt: '2026-04-24T11:00:00.000Z' };
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        id: 'g',
        description: GIST_DESCRIPTION,
        updated_at: '2026-04-24T11:00:01Z',
        files: { [GIST_FILENAME]: { filename: GIST_FILENAME, content: JSON.stringify(doc) } },
      }),
    );

    const out = await pull('tok', 'g');
    expect(out.doc.updatedAt).toBe('2026-04-24T11:00:00.000Z');
    expect(out.ref.updatedAt).toBe('2026-04-24T11:00:01Z');
  });
});

describe('push', () => {
  it('detects a remote-newer conflict before patching', async () => {
    const doc = { ...cloneDefaultUserData(), updatedAt: '2026-04-24T10:00:00.000Z' };
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        id: 'g',
        description: GIST_DESCRIPTION,
        updated_at: 'someone-else-wrote-this',
        files: { [GIST_FILENAME]: { content: '{}' } },
      }),
    );

    await expect(push('tok', 'g', doc, 'stale-snapshot')).rejects.toBeInstanceOf(
      GistConflictError,
    );
  });

  it('PATCHes the gist when remote matches the cached snapshot', async () => {
    const doc = { ...cloneDefaultUserData(), updatedAt: '2026-04-24T10:00:00.000Z' };
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'g',
          description: GIST_DESCRIPTION,
          updated_at: 'cached-snapshot',
          files: { [GIST_FILENAME]: { content: '{}' } },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'g',
          description: GIST_DESCRIPTION,
          updated_at: 'fresh-snapshot',
          files: { [GIST_FILENAME]: { content: '{}' } },
        }),
      );

    const ref = await push('tok', 'g', doc, 'cached-snapshot');
    expect(ref.updatedAt).toBe('fresh-snapshot');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const patchCall = fetchMock.mock.calls[1]!;
    expect((patchCall[1] as RequestInit).method).toBe('PATCH');
  });
});
