// src/schemas.ts
// Single Responsibility: Define core domain models for PluginData and Discovery.

import * as v from "valibot";

export type OpenIssueLabel = "bug" | "feature_request" | "documentation" | "question" | "security" | "other";
export type ClosedIssueReason = "completed" | "fixed" | "wont_fix" | "not_planned" | "duplicate" | "other";

export interface OpenIssue {
  readonly label: OpenIssueLabel;
  readonly createdAt: string;
}

export interface ClosedIssue {
  readonly originalLabel: OpenIssueLabel;
  readonly reason: ClosedIssueReason;
  readonly createdAt: string;
  readonly closedAt: string;
}

export interface OpenPR {
  readonly createdAt: string;
}

export interface ClosedPR {
  readonly createdAt: string;
  readonly closedAt: string;
}

export interface MergedPR {
  readonly createdAt: string;
  readonly mergedAt: string;
}

export interface Release {
  readonly publishedAt: string;
  readonly downloads: number;
}

export interface PluginData {
  readonly totalDownloads: number;
  readonly stargazers: number;
  readonly createdAt: string;
  readonly latestReleaseAt: string;
  readonly lastCommitDate: string;
  readonly commitCountInLast24Months: number;
  readonly totalReleases: number;
  readonly releases: readonly Release[];
  readonly openIssues: readonly OpenIssue[];
  readonly closedIssues: readonly ClosedIssue[];
  readonly openPRs: readonly OpenPR[];
  readonly closedPRs: readonly ClosedPR[];
  readonly mergedPRs: readonly MergedPR[];
}

// ─── UI/Output Schemas ───────────────────────────────────────────────────────

/**
 * Schema for the final computed score output intended for the UI.
 * This aggregates metadata + calculated score.
 */
export const ScoreOutputItemSchema = v.object({
  id: v.string(),
  name: v.string(),
  description: v.string(),
  author: v.string(),
  repo: v.string(),
  score: v.number(),
  label: v.string(), // "Excellent", "Good", etc.
  downloads: v.number(),
  stars: v.number(),
  lastUpdate: v.string(), // latestReleaseAt or lastCommit
  scoreBreakdown: v.object({
    adoption: v.number(),
    maintenance: v.number(),
    stability: v.number(),
    maturity: v.number(),
    communityHealth: v.number(),
  }),
});

export type ScoreOutputItem = v.InferOutput<typeof ScoreOutputItemSchema>;

export const ScoreReportSchema = v.object({
  generatedAt: v.string(),
  plugins: v.array(ScoreOutputItemSchema)
});

export type ScoreReport = v.InferOutput<typeof ScoreReportSchema>;
