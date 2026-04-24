import { graphql as octokitGraphql } from '@octokit/graphql';
import { Octokit } from '@octokit/rest';

import {
  classifyError,
  detectRateLimit,
  GitHubApiError,
  toGitHubApiError,
} from './errors';
import { emitRateLimit } from './events';
import {
  REPO_COMMIT_HISTORY_QUERY,
  REPO_LANGUAGES_QUERY,
  VIEWER_CONTRIBUTIONS_QUERY,
  VIEWER_ORGS_QUERY,
  VIEWER_PROFILE_QUERY,
  VIEWER_REPO_LANGUAGES_QUERY,
  type RepoCommitHistory,
  type RepoLanguages,
  type ViewerContributions,
  type ViewerOrgs,
  type ViewerProfile,
  type ViewerRepoLanguages,
} from './queries';

export type GitHubClients = {
  graphql: ReturnType<typeof octokitGraphql.defaults>;
  rest: Octokit;
};

const USER_AGENT = 'gitInsights (https://github.com/)';

export function createGitHubClients(token: string): GitHubClients {
  const graphql = octokitGraphql.defaults({
    headers: {
      authorization: `bearer ${token}`,
      'user-agent': USER_AGENT,
    },
  });

  const rest = new Octokit({
    auth: token,
    userAgent: USER_AGENT,
  });

  return { graphql, rest };
}

// Wrap any data-layer call so the global rate-limit banner sees 403 events and
// callers always receive a typed `GitHubApiError`. Keep this private — the
// typed wrappers below are the public surface.
async function callWithErrorMapping<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const info = classifyError(err);
    if (info.kind === 'rate-limit') emitRateLimit(info);
    throw new GitHubApiError(info, err instanceof Error ? err.message : undefined);
  }
}

export type ViewerContributionsArgs = {
  from: Date | string;
  to: Date | string;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export type RepoCommitHistoryArgs = {
  owner: string;
  name: string;
  since?: Date | string;
  until?: Date | string;
  after?: string;
  // Spec §3.D: 5,000 commits per fetch ceiling. GraphQL caps each page at
  // 100, so pagination still uses `pageInfo`; `first` is the per-call cap
  // when callers stitch pages themselves.
  first?: number;
};

export const COMMIT_PAGE_SIZE = 100;
export const COMMIT_HISTORY_DEFAULT_CAP = 5000;

export function makeViewerProfileFetcher(clients: GitHubClients) {
  return () =>
    callWithErrorMapping(async () => {
      const data = await clients.graphql<{ viewer: ViewerProfile }>(VIEWER_PROFILE_QUERY);
      return data.viewer;
    });
}

export function makeViewerContributionsFetcher(clients: GitHubClients) {
  return ({ from, to }: ViewerContributionsArgs) =>
    callWithErrorMapping(async () => {
      const data = await clients.graphql<ViewerContributions>(VIEWER_CONTRIBUTIONS_QUERY, {
        from: toIso(from),
        to: toIso(to),
      });
      return data.viewer.contributionsCollection;
    });
}

export function makeViewerOrgsFetcher(clients: GitHubClients) {
  return () =>
    callWithErrorMapping(async () => {
      const data = await clients.graphql<ViewerOrgs>(VIEWER_ORGS_QUERY);
      return data.viewer.organizations.nodes;
    });
}

export type CommitHistoryPage = {
  commits: NonNullable<
    NonNullable<NonNullable<RepoCommitHistory['repository']>['defaultBranchRef']>['target']
  >['history']['nodes'];
  totalCount: number;
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
};

export function makeRepoCommitHistoryFetcher(clients: GitHubClients) {
  return ({
    owner,
    name,
    since,
    until,
    after,
    first = COMMIT_PAGE_SIZE,
  }: RepoCommitHistoryArgs): Promise<CommitHistoryPage> =>
    callWithErrorMapping(async () => {
      const data = await clients.graphql<RepoCommitHistory>(REPO_COMMIT_HISTORY_QUERY, {
        owner,
        name,
        since: since ? toIso(since) : null,
        until: until ? toIso(until) : null,
        after: after ?? null,
        first: Math.min(first, COMMIT_PAGE_SIZE),
      });
      const history = data.repository?.defaultBranchRef?.target?.history;
      if (!history) {
        return {
          commits: [],
          totalCount: 0,
          pageInfo: { endCursor: null, hasNextPage: false },
        };
      }
      return {
        commits: history.nodes,
        totalCount: history.totalCount,
        pageInfo: history.pageInfo,
      };
    });
}

export function makeViewerRepoLanguagesFetcher(clients: GitHubClients) {
  return () =>
    callWithErrorMapping(async () => {
      const data = await clients.graphql<ViewerRepoLanguages>(VIEWER_REPO_LANGUAGES_QUERY);
      const seen = new Set<string>();
      const repos = [...data.viewer.repositories.nodes, ...data.viewer.repositoriesContributedTo.nodes].filter(
        (r) => {
          if (seen.has(r.nameWithOwner)) return false;
          seen.add(r.nameWithOwner);
          return true;
        },
      );
      return repos;
    });
}

export function makeRepoLanguagesFetcher(clients: GitHubClients) {
  return ({ owner, name }: { owner: string; name: string }) =>
    callWithErrorMapping(async () => {
      const data = await clients.graphql<RepoLanguages>(REPO_LANGUAGES_QUERY, {
        owner,
        name,
      });
      return data.repository?.languages ?? { totalSize: 0, edges: [] };
    });
}

export function makeUserRestFetcher(clients: GitHubClients) {
  return async () => {
    try {
      const { data } = await clients.rest.users.getAuthenticated();
      return data;
    } catch (err) {
      throw toGitHubApiError(err);
    }
  };
}

export function makeRepoCommitFetcher(clients: GitHubClients) {
  return async ({ owner, repo, ref }: { owner: string; repo: string; ref: string }) => {
    try {
      const response = await clients.rest.repos.getCommit({ owner, repo, ref });
      const headers = response.headers as Record<string, string | undefined>;
      const rateLimit = detectRateLimit(response.status, headers, undefined);
      if (rateLimit) emitRateLimit(rateLimit);
      return response.data;
    } catch (err) {
      throw toGitHubApiError(err);
    }
  };
}

// "Pure" commits per day for the contribution heatmap. Uses REST
// search/commits with the `merge:false` qualifier so merge commits are
// excluded server-side. The contributionCalendar endpoint we query elsewhere
// counts every contribution type (commits + PRs + issues + reviews +
// comments) — fine for an "activity" view, wrong for a "code I wrote" view.
//
// Pagination strategy: search/commits caps at 1000 results per query. We try
// the whole window in one go and bisect the date range only when we hit the
// cap, so 99% of users incur a single network round-trip per page (≤10 pages).

export type CommitsByDayArgs = {
  login: string;
  from: Date | string;
  to: Date | string;
};

export type CommitsByDay = {
  byDate: Record<string, number>;
  totalCommits: number;
  fromIso: string;
  toIso: string;
  truncated: boolean;
  // Raw per-commit author timestamps (ISO). Drives the WLB hour histogram +
  // late-night / non-workday ratios in Phase 5. Sized at most ~5K entries
  // (one year × the search-commits page cap), so persisting in IndexedDB is
  // cheap.
  timestamps: string[];
};

const COMMITS_PAGE_SIZE = 100;
const COMMITS_HARD_CAP = 1000;
const COMMITS_MAX_PAGES = COMMITS_HARD_CAP / COMMITS_PAGE_SIZE;

function isoDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function midpointDate(a: Date, b: Date): Date {
  return new Date(a.getTime() + Math.floor((b.getTime() - a.getTime()) / 2));
}

function addOneDay(d: Date): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  return next;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function makeViewerCommitsByDayFetcher(clients: GitHubClients) {
  return async ({ login, from, to }: CommitsByDayArgs): Promise<CommitsByDay> => {
    const fromDate = from instanceof Date ? new Date(from) : new Date(from);
    const toDate = to instanceof Date ? new Date(to) : new Date(to);
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(0, 0, 0, 0);

    const byDate: Record<string, number> = {};
    const timestamps: string[] = [];
    let totalCommits = 0;
    let truncated = false;

    const ingest = (items: Array<{ commit: { author: { date?: string | null } | null } }>) => {
      for (const item of items) {
        const date = item.commit.author?.date;
        if (!date) continue;
        const dateKey = date.slice(0, 10);
        byDate[dateKey] = (byDate[dateKey] ?? 0) + 1;
        timestamps.push(date);
        totalCommits += 1;
      }
    };

    const fetchRange = async (since: Date, until: Date): Promise<void> => {
      const sinceIso = isoDateOnly(since);
      const untilIso = isoDateOnly(until);
      const q = `author:${login} author-date:${sinceIso}..${untilIso} merge:false`;

      let firstPage;
      try {
        firstPage = await clients.rest.search.commits({
          q,
          per_page: COMMITS_PAGE_SIZE,
          page: 1,
          sort: 'author-date',
          order: 'desc',
        });
      } catch (err) {
        throw toGitHubApiError(err);
      }

      const totalCount = firstPage.data.total_count ?? 0;

      if (totalCount > COMMITS_HARD_CAP && !isSameDay(since, until)) {
        const mid = midpointDate(since, until);
        await fetchRange(since, mid);
        await fetchRange(addOneDay(mid), until);
        return;
      }

      if (totalCount > COMMITS_HARD_CAP) truncated = true;

      ingest(firstPage.data.items);
      const totalPages = Math.min(
        COMMITS_MAX_PAGES,
        Math.ceil(Math.min(totalCount, COMMITS_HARD_CAP) / COMMITS_PAGE_SIZE),
      );

      for (let page = 2; page <= totalPages; page += 1) {
        try {
          const next = await clients.rest.search.commits({
            q,
            per_page: COMMITS_PAGE_SIZE,
            page,
            sort: 'author-date',
            order: 'desc',
          });
          ingest(next.data.items);
        } catch (err) {
          throw toGitHubApiError(err);
        }
      }
    };

    await fetchRange(fromDate, toDate);

    return {
      byDate,
      totalCommits,
      fromIso: isoDateOnly(fromDate),
      toIso: isoDateOnly(toDate),
      truncated,
      timestamps,
    };
  };
}
