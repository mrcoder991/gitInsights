// Reads the comma-separated `X-OAuth-Scopes` header from a cheap REST call so
// we know which scopes the current token carries. Used by the sync engine
// (spec §3.G) to verify the user actually granted `gist` after the
// re-authorization round-trip, and to detect external revocation.

const GITHUB_USER_REST = 'https://api.github.com/user';

export async function fetchGrantedScopes(token: string): Promise<string[] | null> {
  const response = await fetch(GITHUB_USER_REST, {
    method: 'GET',
    headers: {
      Authorization: `bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`scope_fetch_failed_${response.status}`);
  }

  const header = response.headers.get('x-oauth-scopes') ?? '';
  return header
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function hasScope(scopes: readonly string[], scope: string): boolean {
  return scopes.includes(scope);
}
