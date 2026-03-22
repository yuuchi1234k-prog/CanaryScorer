// src/fetch/paginate.ts
// Single Responsibility: Generic paginated GraphQL fetching with rate limit and deadline handling, with verbose logging.

import type { Octokit } from "octokit";
import { ok, err, type Result } from "neverthrow";
import * as v from "valibot";
import type { GitHubAPIError, DeadlineExceededError } from "./fetch-schemas.js";

// ─── Rate Limit Handling ─────────────────────────────────────────────────────

interface RateLimitInfo {
  readonly retryAfterSeconds: number;
  readonly isPrimary: boolean;
  readonly remaining?: string | undefined;
  readonly reset?: string | undefined;
}

/**
 * Extracts rate limit information from a GitHub API error.
 */
function extractRateLimitInfo(error: unknown): RateLimitInfo | null {
  if (error == null || typeof error !== "object") {
    return null;
  }

  const errorObj = error as Record<string, unknown>;

  const message = typeof errorObj["message"] === "string" ? errorObj["message"] : "";
  const isSecondary =
    message.toLowerCase().includes("secondary rate limit") ||
    message.toLowerCase().includes("abuse detection");

  const headers = errorObj["headers"] as Record<string, string> | undefined;
  const response = errorObj["response"] as Record<string, unknown> | undefined;
  const responseHeaders = response?.["headers"] as Record<string, string> | undefined;

  const allHeaders = headers ?? responseHeaders;

  if (allHeaders) {
    const retryAfter = allHeaders["retry-after"];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds) && seconds > 0) {
        return { 
          retryAfterSeconds: seconds, 
          isPrimary: !isSecondary,
          remaining: allHeaders["x-ratelimit-remaining"],
          reset: allHeaders["x-ratelimit-reset"]
        };
      }
    }

    const resetTimestamp = allHeaders["x-ratelimit-reset"];
    const remaining = allHeaders["x-ratelimit-remaining"];
    if (remaining === "0" && resetTimestamp) {
      const resetTime = parseInt(resetTimestamp, 10) * 1000;
      const waitMs = Math.max(0, resetTime - Date.now());
      const waitSeconds = Math.ceil(waitMs / 1000) + 1; // +1s buffer
      return { 
        retryAfterSeconds: waitSeconds, 
        isPrimary: true,
        remaining,
        reset: resetTimestamp
      };
    }
  }

  const statusCode = typeof errorObj["status"] === "number" ? errorObj["status"] : 0;

  if (statusCode === 429 || (statusCode === 403 && isSecondary)) {
    return {
      retryAfterSeconds: isSecondary ? 60 : 30,
      isPrimary: !isSecondary,
    };
  }

  return null;
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve: () => void) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Executes a GraphQL request with proper rate limit detection, waiting, and deadline enforcement.
 */
export async function graphqlWithRateLimitHandling(
  client: Octokit,
  query: string,
  variables: Record<string, unknown>,
  maxRetries: number = 3,
  deadline?: number
): Promise<Result<Record<string, unknown>, GitHubAPIError | DeadlineExceededError>> {
  // Extract operation name for logging if possible
  const opRegex = /query\s+(\w+)/;
  const opMatch = opRegex.exec(query);
  const opName = opMatch ? opMatch[1] : "UnknownQuery";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`🔄 [GraphQL] Retry attempt ${attempt}/${maxRetries} for ${opName ?? "Unknown"}`);
      }
      
      // eslint-disable-next-line no-await-in-loop
      const data = await client.graphql<Record<string, unknown>>(query, variables);
      return ok(data);
    } catch (error: unknown) {
      const rateLimitInfo = extractRateLimitInfo(error);

      if (rateLimitInfo && attempt < maxRetries) {
        const waitSeconds = rateLimitInfo.retryAfterSeconds;
        const waitMs = waitSeconds * 1000;
        const limitType = rateLimitInfo.isPrimary ? "Primary" : "Secondary";

        console.warn(`🛑 [GraphQL] ${limitType} Rate Limit Hit!`);
        if (rateLimitInfo.remaining) {
          console.warn(`   Remaining: ${rateLimitInfo.remaining}`);
        }
        if (rateLimitInfo.reset) {
          console.warn(`   Reset At: ${new Date(parseInt(rateLimitInfo.reset, 10) * 1000).toISOString()}`);
        }
        console.warn(`   Action: Waiting ${waitSeconds}s before retry.`);

        if (deadline !== undefined && Date.now() + waitMs > deadline) {
          console.error(`⏳ [GraphQL] Deadline exceeded. Wait time ${waitSeconds}s pushes past deadline.`);
          return err({
            kind: "DeadlineExceededError",
            message: `Rate limit wait of ${waitSeconds}s exceeds the global deadline.`
          });
        }

        // eslint-disable-next-line no-await-in-loop
        await sleep(waitMs);
        continue;
      }

      const message = error instanceof Error ? error.message : "Unknown GraphQL error";
      const statusCode =
        error != null &&
        typeof error === "object" &&
        "status" in error &&
        typeof (error as Record<string, unknown>)["status"] === "number"
          ? ((error as Record<string, unknown>)["status"] as number)
          : undefined;
      
      const statusStr = statusCode !== undefined ? String(statusCode) : "N/A";
      console.error(`❌ [GraphQL] Error in ${opName ?? "Unknown"}: ${message} (Status: ${statusStr})`);
      
      const errObj: GitHubAPIError = statusCode !== undefined 
        ? { kind: "GitHubAPIError", message, status: statusCode } 
        : { kind: "GitHubAPIError", message };
      
      return err(errObj);
    }
  }

  return err({ kind: "GitHubAPIError", message: "Max retries exceeded" });
}

// ─── Paginated GraphQL Fetching ──────────────────────────────────────────────

interface PaginateConfig<TNode> {
  readonly client: Octokit;
  readonly query: string;
  readonly variables: Record<string, unknown>;
  readonly extractConnection: (
    data: Record<string, unknown>
  ) => {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: readonly TNode[];
  };
  readonly nodeSchema: v.BaseSchema<unknown, TNode, v.BaseIssue<unknown>>;
  readonly deadline?: number | undefined;
}

export async function paginateGraphQL<TNode>(
  config: PaginateConfig<TNode>
): Promise<Result<readonly TNode[], GitHubAPIError | DeadlineExceededError>> {
  const allNodes: TNode[] = [];
  let cursor: string | null = (config.variables["cursor"] as string | null) ?? null;
  let pageCount = 0;

  while (true) {
    pageCount++;
    if (pageCount > 1) {
      const cursorStr = cursor ? cursor.substring(0, 10) : "null";
      console.log(`📄 [Paginate] Fetching page ${pageCount}. Cursor: ${cursorStr}...`);
    }

    const variables = { ...config.variables, cursor };

    // eslint-disable-next-line no-await-in-loop
    const result = await graphqlWithRateLimitHandling(
      config.client,
      config.query,
      variables,
      3,
      config.deadline
    );

    if (result.isErr()) {
      return err(result.error);
    }

    const rawData = result.value;

    let connection: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: readonly TNode[];
    };
    try {
      connection = config.extractConnection(rawData);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to extract connection from response";
      console.error(`❌ [Paginate] Data extraction failed: ${message}`);
      return err({ kind: "GitHubAPIError", message });
    }

    for (const rawNode of connection.nodes) {
      const parsed = v.safeParse(config.nodeSchema, rawNode);
      if (parsed.success) {
        allNodes.push(parsed.output);
      }
    }

    if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) {
      break;
    }

    cursor = connection.pageInfo.endCursor;
  }

  return ok(allNodes);
}
