// fetch-schemas.ts
// Single Responsibility: Define all types and validation schemas specific to the data-fetching layer.

import * as v from "valibot";

// ─── Input Schema ────────────────────────────────────────────────────────────

export const FetchInputSchema = v.object({
  pat: v.pipe(v.string(), v.minLength(1, "PAT must not be empty")),
  repo: v.pipe(
    v.string(),
    v.regex(
      /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/,
      "repo must be in 'owner/name' format"
    )
  ),
});
export type FetchInput = v.InferOutput<typeof FetchInputSchema>;

// ─── Parsed Repo Identifier ─────────────────────────────────────────────────

export interface RepoId {
  readonly owner: string;
  readonly name: string;
}

// ─── GitHub GraphQL Response Fragments ───────────────────────────────────────

export const GHPageInfoSchema = v.object({
  hasNextPage: v.boolean(),
  endCursor: v.nullable(v.string()),
});

// ─── Releases ────────────────────────────────────────────────────────────────

export const GHReleaseNodeSchema = v.object({
  publishedAt: v.nullable(v.string()),
  releaseAssets: v.object({
    nodes: v.array(
      v.object({
        name: v.string(),
        downloadCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
      })
    ),
  }),
});

// ─── Issues ──────────────────────────────────────────────────────────────────

export const GHIssueNodeSchema = v.object({
  title: v.string(),
  createdAt: v.string(),
  closedAt: v.nullable(v.string()),
  state: v.string(), // Relaxed from picklist to prevent failures on new GitHub enums
  stateReason: v.nullable(v.string()), // Relaxed from picklist
  labels: v.optional(
    v.nullable(
      v.object({
        nodes: v.array(
          v.object({
            name: v.string(),
          })
        ),
      })
    )
  ),
});

// ─── Pull Requests ───────────────────────────────────────────────────────────

export const GHPRNodeSchema = v.object({
  createdAt: v.string(),
  closedAt: v.nullable(v.string()),
  mergedAt: v.nullable(v.string()),
  state: v.string(), // Relaxed from picklist
  author: v.nullable(
    v.object({
      login: v.string(),
    })
  ),
  authorAssociation: v.string(), // Relaxed from picklist to handle undocumented bots/apps
});

// ─── Fetch Errors ────────────────────────────────────────────────────────────

export interface FetchValidationError {
  readonly kind: "FetchValidationError";
  readonly message: string;
  readonly issues: readonly {
    readonly path: string;
    readonly message: string;
  }[];
}

export interface GitHubAPIError {
  readonly kind: "GitHubAPIError";
  readonly message: string;
  readonly status?: number;
}

export interface DataTransformError {
  readonly kind: "DataTransformError";
  readonly message: string;
}

export interface DeadlineExceededError {
  readonly kind: "DeadlineExceededError";
  readonly message: string;
}

export type FetchError =
  | FetchValidationError
  | GitHubAPIError
  | DataTransformError
  | DeadlineExceededError;
