// assemble.ts
// Single Responsibility: Assemble the final PluginData object from all fetched components.

import type { PluginData, Release } from "../schemas.js";
import type { RepoCoreData } from "./fetch-repo-core.js";
import type { ReleaseData } from "./fetch-releases.js";
import type { IssuesData } from "./fetch-issues.js";
import type { PullRequestsData } from "./fetch-pull-requests.js";

/**
 * Assembles a fully validated PluginData from the individually fetched components.
 * This is a pure transformation — no I/O, no side effects.
 */
export function assemblePluginData(
  core: RepoCoreData,
  releases: readonly ReleaseData[],
  issues: IssuesData,
  prs: PullRequestsData,
  totalDownloads: number
): PluginData {
  return {
    totalDownloads,
    stargazers: core.stargazerCount,
    createdAt: core.createdAt,
    latestReleaseAt: core.latestReleaseAt,
    lastCommitDate: core.lastCommitDate,
    commitCountInLast24Months: core.commitCountInLast24Months,
    totalReleases: core.totalReleases,
    releases: releases.map((r: ReleaseData): Release => ({
      publishedAt: r.publishedAt,
      downloads: r.downloads,
    })),
    openIssues: [...issues.openIssues],
    closedIssues: [...issues.closedIssues],
    openPRs: [...prs.openPRs],
    closedPRs: [...prs.closedPRs],
    mergedPRs: [...prs.mergedPRs],
  };
}
