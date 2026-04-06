// fetch-pull-requests.ts
// Single Responsibility: Fetch remaining PR pages and classify PRs.

import type { Octokit } from "octokit";
import type { Result } from "neverthrow";
import type * as v from "valibot";
import type { RepoId, GitHubAPIError, DeadlineExceededError } from "./fetch-schemas.js";
import { GHPRNodeSchema } from "./fetch-schemas.js";
import { PRS_PAGE_QUERY } from "./graphql-queries.js";
import { paginateGraphQL } from "./paginate.js";
import type { OpenPR, ClosedPR, MergedPR } from "../scorePlugin/index.js";

type GHPRNode = v.InferOutput<typeof GHPRNodeSchema>;

const COMMUNITY_ASSOCIATIONS = new Set([
  "CONTRIBUTOR",
  "FIRST_TIMER",
  "FIRST_TIME_CONTRIBUTOR",
  "NONE",
]);

function isCommunityPR(node: GHPRNode): boolean {
  if (node.authorAssociation === "MANNEQUIN") {
    return false;
  }
  if (node.author?.login.toLowerCase().endsWith("[bot]")) {
    return false;
  }
  return COMMUNITY_ASSOCIATIONS.has(node.authorAssociation);
}

export interface PullRequestsData {
  readonly openPRs: readonly OpenPR[];
  readonly closedPRs: readonly ClosedPR[];
  readonly mergedPRs: readonly MergedPR[];
}

export function classifyPRs(
  openNodes: readonly GHPRNode[],
  closedNodes: readonly GHPRNode[],
  mergedNodes: readonly GHPRNode[]
): PullRequestsData {
  const openPRs: OpenPR[] = [];
  const closedPRs: ClosedPR[] = [];
  const mergedPRs: MergedPR[] = [];

  for (const pr of openNodes) {
    if (isCommunityPR(pr)) {
      openPRs.push({ createdAt: pr.createdAt });
    }
  }

  for (const pr of closedNodes) {
    if (isCommunityPR(pr) && pr.closedAt) {
      closedPRs.push({ createdAt: pr.createdAt, closedAt: pr.closedAt });
    }
  }

  for (const pr of mergedNodes) {
    if (isCommunityPR(pr) && pr.mergedAt) {
      mergedPRs.push({ createdAt: pr.createdAt, mergedAt: pr.mergedAt });
    }
  }

  return { openPRs, closedPRs, mergedPRs };
}

export async function fetchRemainingPullRequests(
  client: Octokit,
  repo: RepoId,
  state: "OPEN" | "CLOSED" | "MERGED",
  startCursor: string,
  deadline?: number
): Promise<Result<readonly GHPRNode[], GitHubAPIError | DeadlineExceededError>> {
  return await paginateGraphQL<GHPRNode>({
    client,
    query: PRS_PAGE_QUERY,
    variables: { owner: repo.owner, name: repo.name, states: [state], cursor: startCursor },
    deadline,
    extractConnection: (data: Record<string, unknown>) => {
      const repository = data["repository"] as Record<string, unknown> | null;
      if (!repository) {
        throw new Error("Repository not found in PRs pagination");
      }
      const prs = repository["pullRequests"] as {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: readonly GHPRNode[];
      };
      return prs;
    },
    nodeSchema: GHPRNodeSchema,
  });
}
