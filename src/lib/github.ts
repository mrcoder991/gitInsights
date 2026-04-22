// Hand-rolled `viewer { login }` boot validation. Deliberately bypasses the
// Phase 3 TanStack Query layer (src/api/) because the persister is keyed on
// `viewer.login` — and this call is what tells us what `login` is. Once the
// store has a viewer, every other query goes through `useGitHub` / the typed
// hooks in src/hooks/useGitHubQueries.ts.

const GITHUB_GRAPHQL = 'https://api.github.com/graphql';

export type Viewer = {
  login: string;
  name: string | null;
  avatarUrl: string;
};

export class GitHubAuthError extends Error {
  constructor(message = 'github_unauthorized') {
    super(message);
    this.name = 'GitHubAuthError';
  }
}

const VIEWER_QUERY = /* GraphQL */ `
  query gitInsightsBootViewer {
    viewer {
      login
      name
      avatarUrl
    }
  }
`;

export async function fetchViewer(token: string): Promise<Viewer> {
  const response = await fetch(GITHUB_GRAPHQL, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query: VIEWER_QUERY }),
  });

  if (response.status === 401) {
    throw new GitHubAuthError();
  }

  if (!response.ok) {
    throw new Error(`viewer_fetch_failed_${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: { viewer?: Viewer };
    errors?: Array<{ type?: string; message: string }>;
  };

  // GraphQL returns 200-with-errors for revoked tokens and scope downgrades;
  // collapse those into a 401 for the boot check.
  if (payload.errors?.some((e) => e.type === 'FORBIDDEN' || e.type === 'UNAUTHENTICATED')) {
    throw new GitHubAuthError();
  }

  if (!payload.data?.viewer) {
    throw new Error('viewer_missing');
  }

  return payload.data.viewer;
}
