// graphql-queries.ts
// Single Responsibility: Define all GraphQL query strings used to fetch data from GitHub.

/**
 * Single comprehensive query that fetches:
 * - Core repository metadata (stars, creation date, commit count, latest release, pushedAt)
 * - First page of releases (100 items) with asset names and download counts
 * - First page of open issues (100 items) with titles and labels
 * - First page of closed issues (100 items) with titles, state reasons, and labels
 * - First page of open PRs (100 items) with author info
 * - First page of closed PRs (100 items) with author info
 * - First page of merged PRs (100 items) with author info
 */
export const REPO_CORE_QUERY = `
  query RepoCore($owner: String!, $name: String!, $since: GitTimestamp!) {
    repository(owner: $owner, name: $name) {
      createdAt
      stargazerCount
      pushedAt
      defaultBranchRef {
        target {
          ... on Commit {
            history(since: $since) {
              totalCount
            }
          }
        }
      }
      latestRelease {
        publishedAt
      }
      releases(first: 100, orderBy: { field: CREATED_AT, direction: ASC }) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          publishedAt
          releaseAssets(first: 100) {
            nodes {
              name
              downloadCount
            }
          }
        }
      }
      openIssues: issues(first: 100, states: [OPEN]) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          title
          createdAt
          closedAt
          state
          stateReason
          labels(first: 5) {
            nodes {
              name
            }
          }
        }
      }
      closedIssues: issues(first: 100, states: [CLOSED]) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          title
          createdAt
          closedAt
          state
          stateReason
          labels(first: 5) {
            nodes {
              name
            }
          }
        }
      }
      openPRs: pullRequests(first: 100, states: [OPEN]) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          createdAt
          closedAt
          mergedAt
          state
          author {
            login
          }
          authorAssociation
        }
      }
      closedPRs: pullRequests(first: 100, states: [CLOSED]) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          createdAt
          closedAt
          mergedAt
          state
          author {
            login
          }
          authorAssociation
        }
      }
      mergedPRs: pullRequests(first: 100, states: [MERGED]) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          createdAt
          closedAt
          mergedAt
          state
          author {
            login
          }
          authorAssociation
        }
      }
    }
  }
`;

/**
 * Fetches subsequent pages of releases.
 */
export const RELEASES_PAGE_QUERY = `
  query ReleasesPage($owner: String!, $name: String!, $cursor: String!) {
    repository(owner: $owner, name: $name) {
      releases(first: 100, after: $cursor, orderBy: { field: CREATED_AT, direction: ASC }) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          publishedAt
          releaseAssets(first: 100) {
            nodes {
              name
              downloadCount
            }
          }
        }
      }
    }
  }
`;

/**
 * Fetches subsequent pages of open issues (includes labels).
 */
export const OPEN_ISSUES_PAGE_QUERY = `
  query OpenIssuesPage($owner: String!, $name: String!, $cursor: String!) {
    repository(owner: $owner, name: $name) {
      issues(first: 100, after: $cursor, states: [OPEN]) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          title
          createdAt
          closedAt
          state
          stateReason
          labels(first: 5) {
            nodes {
              name
            }
          }
        }
      }
    }
  }
`;

/**
 * Fetches subsequent pages of closed issues (includes labels).
 */
export const CLOSED_ISSUES_PAGE_QUERY = `
  query ClosedIssuesPage($owner: String!, $name: String!, $cursor: String!) {
    repository(owner: $owner, name: $name) {
      issues(first: 100, after: $cursor, states: [CLOSED]) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          title
          createdAt
          closedAt
          state
          stateReason
          labels(first: 5) {
            nodes {
              name
            }
          }
        }
      }
    }
  }
`;

/**
 * Fetches subsequent pages of pull requests (by state, controlled by $states variable).
 */
export const PRS_PAGE_QUERY = `
  query PRsPage($owner: String!, $name: String!, $states: [PullRequestState!]!, $cursor: String!) {
    repository(owner: $owner, name: $name) {
      pullRequests(first: 100, after: $cursor, states: $states) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          createdAt
          closedAt
          mergedAt
          state
          author {
            login
          }
          authorAssociation
        }
      }
    }
  }
`;
