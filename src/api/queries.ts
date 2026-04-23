// GraphQL query strings + response types for the spec §7 API surface. Hand-
// written types until codegen earns its keep (Phase 3 task list).

export type ViewerProfile = {
  login: string;
  name: string | null;
  avatarUrl: string;
  createdAt: string;
};

export const VIEWER_PROFILE_QUERY = /* GraphQL */ `
  query gitInsightsViewerProfile {
    viewer {
      login
      name
      avatarUrl
      createdAt
    }
  }
`;

export type ContributionDay = {
  date: string;
  contributionCount: number;
};

export type ContributionWeek = {
  contributionDays: ContributionDay[];
};

export type ViewerContributions = {
  viewer: {
    contributionsCollection: {
      contributionCalendar: {
        totalContributions: number;
        weeks: ContributionWeek[];
      };
      commitContributionsByRepository: Array<{
        repository: { nameWithOwner: string; isPrivate: boolean };
        contributions: { totalCount: number };
      }>;
    };
  };
};

export const VIEWER_CONTRIBUTIONS_QUERY = /* GraphQL */ `
  query gitInsightsViewerContributions($from: DateTime!, $to: DateTime!) {
    viewer {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
        commitContributionsByRepository(maxRepositories: 100) {
          repository {
            nameWithOwner
            isPrivate
          }
          contributions {
            totalCount
          }
        }
      }
    }
  }
`;

export type ViewerOrgs = {
  viewer: {
    organizations: {
      nodes: Array<{ login: string }>;
    };
  };
};

export const VIEWER_ORGS_QUERY = /* GraphQL */ `
  query gitInsightsViewerOrgs {
    viewer {
      organizations(first: 50) {
        nodes {
          login
        }
      }
    }
  }
`;

export type RepoCommit = {
  oid: string;
  committedDate: string;
  additions: number;
  deletions: number;
  changedFilesIfAvailable: number | null;
  author: {
    name: string | null;
    email: string | null;
    user: { login: string } | null;
  } | null;
};

export type RepoCommitHistory = {
  repository: {
    defaultBranchRef: {
      target: {
        history: {
          totalCount: number;
          pageInfo: { endCursor: string | null; hasNextPage: boolean };
          nodes: RepoCommit[];
        };
      };
    } | null;
  } | null;
};

export const REPO_COMMIT_HISTORY_QUERY = /* GraphQL */ `
  query gitInsightsRepoCommitHistory(
    $owner: String!
    $name: String!
    $since: GitTimestamp
    $until: GitTimestamp
    $after: String
    $first: Int!
  ) {
    repository(owner: $owner, name: $name) {
      defaultBranchRef {
        target {
          ... on Commit {
            history(since: $since, until: $until, after: $after, first: $first) {
              totalCount
              pageInfo {
                endCursor
                hasNextPage
              }
              nodes {
                oid
                committedDate
                additions
                deletions
                changedFilesIfAvailable
                author {
                  name
                  email
                  user {
                    login
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export type ViewerRepoLanguages = {
  viewer: {
    repositoriesContributedTo: {
      nodes: Array<{
        nameWithOwner: string;
        pushedAt: string;
        languages: {
          edges: Array<{
            size: number;
            node: { name: string; color: string | null };
          }>;
        };
      }>;
    };
    repositories: {
      nodes: Array<{
        nameWithOwner: string;
        pushedAt: string;
        languages: {
          edges: Array<{
            size: number;
            node: { name: string; color: string | null };
          }>;
        };
      }>;
    };
  };
};

export const VIEWER_REPO_LANGUAGES_QUERY = /* GraphQL */ `
  query gitInsightsViewerRepoLanguages {
    viewer {
      repositoriesContributedTo(
        first: 50
        contributionTypes: [COMMIT, PULL_REQUEST]
        includeUserRepositories: true
        privacy: null
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        nodes {
          nameWithOwner
          pushedAt
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
        }
      }
      repositories(
        first: 50
        affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        nodes {
          nameWithOwner
          pushedAt
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
        }
      }
    }
  }
`;

export type RepoLanguages = {
  repository: {
    languages: {
      totalSize: number;
      edges: Array<{
        size: number;
        node: { name: string; color: string | null };
      }>;
    };
  } | null;
};

export const REPO_LANGUAGES_QUERY = /* GraphQL */ `
  query gitInsightsRepoLanguages($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
        totalSize
        edges {
          size
          node {
            name
            color
          }
        }
      }
    }
  }
`;
