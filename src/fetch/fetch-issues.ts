// fetch-issues.ts
// Single Responsibility: Fetch remaining issue pages and classify issues using native labels or a default fallback.

import type { Octokit } from "octokit";
import type { Result } from "neverthrow";
import type * as v from "valibot";
import type { RepoId, GitHubAPIError, DeadlineExceededError } from "./fetch-schemas.js";
import { GHIssueNodeSchema } from "./fetch-schemas.js";
import { OPEN_ISSUES_PAGE_QUERY, CLOSED_ISSUES_PAGE_QUERY } from "./graphql-queries.js";
import { paginateGraphQL } from "./paginate.js";
import type {
  OpenIssue,
  ClosedIssue,
  OpenIssueLabel,
  ClosedIssueReason,
} from "../schemas.js";

type GHIssueNode = v.InferOutput<typeof GHIssueNodeSchema>;

function mapClosedReason(
  stateReason: string | null
): ClosedIssueReason {
  if (!stateReason) {
    return "completed";
  }
  
  const sr = stateReason.toUpperCase();
  if (sr === "COMPLETED") {
    return "completed";
  }
  if (sr === "NOT_PLANNED") {
    return "not_planned";
  }
  if (sr === "DUPLICATE") {
    return "duplicate";
  }
  return "other";
}

function getIssueLabelFromGitHubLabels(labels?: GHIssueNode["labels"]): OpenIssueLabel | null {
  const nodes = labels?.nodes;
  if (!nodes || nodes.length === 0) {
    return null;
  }

  for (const node of nodes) {
    const lower = node.name.toLowerCase();
    if (lower.includes("bug")) {
      return "bug";
    }
    if (lower.includes("feature") || lower.includes("enhancement")) {
      return "feature_request";
    }
    if (lower.includes("doc")) {
      return "documentation";
    }
    if (lower.includes("question") || lower.includes("help")) {
      return "question";
    }
    if (lower.includes("security")) {
      return "security";
    }
  }
  
  return "other";
}

export interface IssuesData {
  readonly openIssues: readonly OpenIssue[];
  readonly closedIssues: readonly ClosedIssue[];
}

export function classifyIssues(
  openNodes: readonly GHIssueNode[],
  closedNodes: readonly GHIssueNode[]
): IssuesData {
  const openIssues: OpenIssue[] = openNodes.map((node: GHIssueNode) => {
    const finalLabel = getIssueLabelFromGitHubLabels(node.labels) ?? "bug";
    return {
      label: finalLabel,
      createdAt: node.createdAt,
    };
  });

  const closedIssues: ClosedIssue[] = closedNodes
    .filter((node: GHIssueNode): node is GHIssueNode & { closedAt: string } => node.closedAt !== null)
    .map((node: GHIssueNode & { closedAt: string }) => {
      const finalLabel = getIssueLabelFromGitHubLabels(node.labels) ?? "bug";
      return {
        originalLabel: finalLabel,
        reason: mapClosedReason(node.stateReason),
        createdAt: node.createdAt,
        closedAt: node.closedAt,
      };
    });

  return { openIssues, closedIssues };
}

export async function fetchRemainingIssues(
  client: Octokit,
  repo: RepoId,
  state: "OPEN" | "CLOSED",
  startCursor: string,
  deadline?: number
): Promise<Result<readonly GHIssueNode[], GitHubAPIError | DeadlineExceededError>> {
  const query = state === "OPEN" ? OPEN_ISSUES_PAGE_QUERY : CLOSED_ISSUES_PAGE_QUERY;
  
  return await paginateGraphQL<GHIssueNode>({
    client,
    query,
    variables: { owner: repo.owner, name: repo.name, cursor: startCursor },
    deadline,
    extractConnection: (data: Record<string, unknown>) => {
      const repository = data["repository"] as Record<string, unknown> | null;
      if (!repository) {
        throw new Error("Repository not found in issues pagination");
      }
      const issues = repository["issues"] as {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: readonly GHIssueNode[];
      };
      return issues;
    },
    nodeSchema: GHIssueNodeSchema,
  });
}
