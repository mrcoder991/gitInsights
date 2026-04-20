// Minimal GitHub GraphQL client surface used by Phase 2 only — just enough to
// run the cheap `viewer { login }` boot validation. Phase 3 swaps this for
// `@octokit/graphql` + TanStack Query (see docs/tasks/phase-03-github-data-layer.md);
// keeping this hand-rolled avoids pulling Octokit in just to make one call.

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

  // GraphQL surfaces 200-with-errors for some auth failures
  // (revoked tokens, scope downgrade). Treat anything that smells like
  // an unauthenticated state as a 401 for the purposes of the boot check.
  if (payload.errors?.some((e) => e.type === 'FORBIDDEN' || e.type === 'UNAUTHENTICATED')) {
    throw new GitHubAuthError();
  }

  if (!payload.data?.viewer) {
    throw new Error('viewer_missing');
  }

  return payload.data.viewer;
}
