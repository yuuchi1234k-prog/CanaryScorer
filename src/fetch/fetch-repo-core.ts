// src/fetch/fetch-repo-core.ts
// Single Responsibility: Fetch core repository metadata AND first pages of releases, issues, and PRs in a single GraphQL query with logging.

import type { Octokit } from "octokit";
import { ok, err, type Result } from "neverthrow";
import * as v from "valibot";
import { subMonths, parseISO } from "date-fns";
import type { RepoId, GitHubAPIError, DeadlineExceededError } from "./fetch-schemas.js";
import { GHReleaseNodeSchema, GHIssueNodeSchema, GHPRNodeSchema } from "./fetch-schemas.js";
import { REPO_CORE_QUERY } from "./graphql-queries.js";
import { graphqlWithRateLimitHandling } from "./paginate.js";

// ─── Response Schema ─────────────────────────────────────────────────────────

const PageInfoSchema = v.object({
  hasNextPage: v.boolean(),
  endCursor: v.nullable(v.string()),
});

const RepoCoreResponseSchema = v.object({
  repository: v.nullable(
    v.object({
      createdAt: v.string(),
      stargazerCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
      defaultBranchRef: v.nullable(
        v.object({
          target: v.nullable(
            v.object({
              history: v.optional(
                v.object({
                  totalCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
                })
              ),
            })
          ),
        })
      ),
      releases: v.object({
        totalCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
        pageInfo: PageInfoSchema,
        nodes: v.array(GHReleaseNodeSchema),
      }),
      latestRelease: v.nullable(
        v.object({
          publishedAt: v.nullable(v.string()),
        })
      ),
      pushedAt: v.nullable(v.string()),
      openIssues: v.object({
        pageInfo: PageInfoSchema,
        nodes: v.array(GHIssueNodeSchema),
      }),
      closedIssues: v.object({
        pageInfo: PageInfoSchema,
        nodes: v.array(GHIssueNodeSchema),
      }),
      openPRs: v.object({
        pageInfo: PageInfoSchema,
        nodes: v.array(GHPRNodeSchema),
      }),
      closedPRs: v.object({
        pageInfo: PageInfoSchema,
        nodes: v.array(GHPRNodeSchema),
      }),
      mergedPRs: v.object({
        pageInfo: PageInfoSchema,
        nodes: v.array(GHPRNodeSchema),
      }),
    })
  ),
});

// ─── Output Type ─────────────────────────────────────────────────────────────

export interface RepoCoreData {
  readonly createdAt: string;
  readonly stargazerCount: number;
  readonly commitCountInLast24Months: number;
  readonly lastCommitDate: string;
  readonly latestReleaseAt: string;
  readonly totalReleases: number;

  readonly releasesFirstPage: readonly v.InferOutput<typeof GHReleaseNodeSchema>[];
  readonly releasesPageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };

  readonly openIssuesFirstPage: readonly v.InferOutput<typeof GHIssueNodeSchema>[];
  readonly openIssuesPageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
  readonly closedIssuesFirstPage: readonly v.InferOutput<typeof GHIssueNodeSchema>[];
  readonly closedIssuesPageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };

  readonly openPRsFirstPage: readonly v.InferOutput<typeof GHPRNodeSchema>[];
  readonly openPRsPageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
  readonly closedPRsFirstPage: readonly v.InferOutput<typeof GHPRNodeSchema>[];
  readonly closedPRsPageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
  readonly mergedPRsFirstPage: readonly v.InferOutput<typeof GHPRNodeSchema>[];
  readonly mergedPRsPageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
}

// ─── Fetch Function ──────────────────────────────────────────────────────────

export async function fetchRepoCoreAndFirstPages(
  client: Octokit,
  repo: RepoId,
  now: string,
  deadline?: number
): Promise<Result<RepoCoreData, GitHubAPIError | DeadlineExceededError>> {
  const twentyFourMonthsAgo = subMonths(parseISO(now), 24).toISOString();

  // console.log(`🔍 [RepoCore] Fetching core metadata for ${repo.owner}/${repo.name} since ${twentyFourMonthsAgo}`);

  const result = await graphqlWithRateLimitHandling(
    client, 
    REPO_CORE_QUERY, 
    { owner: repo.owner, name: repo.name, since: twentyFourMonthsAgo }, 
    3, 
    deadline
  );

  if (result.isErr()) {
    // console.error(`❌ [RepoCore] GraphQL request failed: ${result.error.message}`);
    return err(result.error);
  }

  const rawData = result.value;

  const parsed = v.safeParse(RepoCoreResponseSchema, rawData);
  if (!parsed.success) {
    console.error(`❌ [RepoCore] Schema validation failed for ${repo.owner}/${repo.name}`);
    // console.error(JSON.stringify(parsed.issues, null, 2));
    return err({
      kind: "GitHubAPIError",
      message: `Invalid repo core response: ${parsed.issues.map((i: v.BaseIssue<unknown>) => i.message).join(", ")}`,
    });
  }

  const r = parsed.output.repository;
  if (!r) {
    console.warn(`⚠️ [RepoCore] Repository ${repo.owner}/${repo.name} returned null (Not Found or No Access).`);
    return err({
      kind: "GitHubAPIError",
      message: "Repository not found (null)",
      status: 404
    });
  }

  const commitCount = r.defaultBranchRef?.target?.history?.totalCount ?? 0;
  const lastCommitDate = r.pushedAt ?? r.createdAt;
  const latestReleaseAt = r.latestRelease?.publishedAt ?? r.createdAt;

  return ok({
    createdAt: r.createdAt,
    stargazerCount: r.stargazerCount,
    commitCountInLast24Months: commitCount,
    lastCommitDate,
    latestReleaseAt,
    totalReleases: r.releases.totalCount,

    releasesFirstPage: r.releases.nodes,
    releasesPageInfo: r.releases.pageInfo,

    openIssuesFirstPage: r.openIssues.nodes,
    openIssuesPageInfo: r.openIssues.pageInfo,
    closedIssuesFirstPage: r.closedIssues.nodes,
    closedIssuesPageInfo: r.closedIssues.pageInfo,

    openPRsFirstPage: r.openPRs.nodes,
    openPRsPageInfo: r.openPRs.pageInfo,
    closedPRsFirstPage: r.closedPRs.nodes,
    closedPRsPageInfo: r.closedPRs.pageInfo,
    mergedPRsFirstPage: r.mergedPRs.nodes,
    mergedPRsPageInfo: r.mergedPRs.pageInfo,
  });
}
