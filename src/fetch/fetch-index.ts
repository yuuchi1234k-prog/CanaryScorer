// fetch-index.ts
// Single Responsibility: Clean public API surface for the fetching layer.

export { fetchPluginData } from "./fetch-all.js";
export { createGitHubClient } from "./github-client.js";
export { fetchRepoCoreAndFirstPages } from "./fetch-repo-core.js";
export { fetchRemainingReleases, computeDownloads } from "./fetch-releases.js";
export { fetchRemainingIssues, classifyIssues } from "./fetch-issues.js";
export { fetchRemainingPullRequests, classifyPRs } from "./fetch-pull-requests.js";
export { assemblePluginData } from "./assemble.js";

export type {
  FetchInput,
  RepoId,
  FetchError,
  FetchValidationError,
  GitHubAPIError,
  DataTransformError,
  DeadlineExceededError
} from "./fetch-schemas.js";

export type { RepoCoreData } from "./fetch-repo-core.js";
export type { ReleaseData } from "./fetch-releases.js";
export type { IssuesData } from "./fetch-issues.js";
export type { PullRequestsData } from "./fetch-pull-requests.js";
