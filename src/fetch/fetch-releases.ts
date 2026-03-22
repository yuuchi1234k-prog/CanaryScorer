// fetch-releases.ts
// Single Responsibility: Fetch remaining release pages and compute download counts from manifest.json assets.

import type { Octokit } from "octokit";
import type { Result } from "neverthrow";
import type * as v from "valibot";
import type { RepoId, GitHubAPIError, DeadlineExceededError } from "./fetch-schemas.js";
import { GHReleaseNodeSchema } from "./fetch-schemas.js";
import { RELEASES_PAGE_QUERY } from "./graphql-queries.js";
import { paginateGraphQL } from "./paginate.js";

export interface ReleaseData {
  readonly publishedAt: string;
  readonly downloads: number;
}

type GHReleaseNode = v.InferOutput<typeof GHReleaseNodeSchema>;

function transformReleaseNode(node: GHReleaseNode): ReleaseData | null {
  if (!node.publishedAt) {
    return null;
  }

  const manifestAsset = node.releaseAssets.nodes.find(
    (asset: { name: string; downloadCount: number }) => asset.name.toLowerCase() === "manifest.json"
  );

  const downloads = manifestAsset?.downloadCount ?? 0;

  return {
    publishedAt: node.publishedAt,
    downloads,
  };
}

export function computeDownloads(
  nodes: readonly GHReleaseNode[]
): readonly ReleaseData[] {
  const releases: ReleaseData[] = [];
  for (const node of nodes) {
    const transformed = transformReleaseNode(node);
    if (transformed) {
      releases.push(transformed);
    }
  }
  return releases;
}

export async function fetchRemainingReleases(
  client: Octokit,
  repo: RepoId,
  startCursor: string,
  deadline?: number
): Promise<Result<readonly GHReleaseNode[], GitHubAPIError | DeadlineExceededError>> {
  return await paginateGraphQL<GHReleaseNode>({
    client,
    query: RELEASES_PAGE_QUERY,
    variables: {
      owner: repo.owner,
      name: repo.name,
      cursor: startCursor,
    },
    deadline,
    extractConnection: (data: Record<string, unknown>) => {
      const repository = data["repository"] as Record<string, unknown> | null;
      if (!repository) {
        throw new Error("Repository not found in releases pagination");
      }
      const releasesConn = repository["releases"] as {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: readonly GHReleaseNode[];
      };
      return releasesConn;
    },
    nodeSchema: GHReleaseNodeSchema,
  });
}
