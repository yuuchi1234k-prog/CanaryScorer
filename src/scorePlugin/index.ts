import { err, ok, type Result } from "neverthrow";
import invariant from "tiny-invariant";
import type { FinalScore } from "./schemas.js";
import type { ValidationError } from "./validate.js";
import { validateScoringContext } from "./validate.js";
import { computeQualityScore } from "./score.js";

// ─── Error Types ─────────────────────────────────────────────────────────────

export interface ComputationError {
  readonly kind: "ComputationError";
  readonly message: string;
}

export type ScoringError = ValidationError | ComputationError;

// ─── Safe Public API ─────────────────────────────────────────────────────────

/**
 * Validates raw input and computes the full quality score.
 */
export function scorePlugin(
  rawInput: unknown
): Result<FinalScore, ScoringError> {
  const validated = validateScoringContext(rawInput);

  if (validated.isErr()) {
    return err(validated.error);
  }

  const ctx = validated.value;

  try {
    invariant(
      ctx.ecosystem.allDownloadsPerDay.length > 0,
      "Ecosystem downloads-per-day dataset must not be empty"
    );
    invariant(
      ctx.ecosystem.allStarRatios.length > 0,
      "Ecosystem star-ratios dataset must not be empty"
    );

    const score = computeQualityScore(ctx.plugin, ctx.ecosystem, ctx.now);
    return ok(score);
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Unknown computation error";
    return err({ kind: "ComputationError", message });
  }
}

// ─── Re-exports ──────────────────────────────────────────────────────────────

// Type-only re-exports
export type {
  FinalScore,
  FinalScoreLabel,
  DimensionBreakdown,
  PluginData,
  EcosystemPercentiles,
  ScoringContext,
  OpenIssue,
  ClosedIssue,
  OpenPR,
  ClosedPR,
  MergedPR,
  Release,
} from "./schemas.js";

// Value re-exports (Schemas and Logic)
export { 
  PluginDataSchema, 
  ScoringContextSchema, 
  EcosystemPercentilesSchema 
} from "./schemas.js";

export { computeQualityScore } from "./score.js";
export { computeAdoption } from "./adoption.js";
export { computeMaintenance } from "./maintenance.js";
export { computeStability } from "./stability.js";
export { computeMaturity } from "./maturity.js";
export { computeCommunityHealth } from "./community-health.js";
export { validateScoringContext, validatePluginData, validateEcosystemPercentiles } from "./validate.js";
