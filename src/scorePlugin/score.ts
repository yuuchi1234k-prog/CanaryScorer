import { match } from "ts-pattern";
import type {
  PluginData,
  EcosystemPercentiles,
  FinalScore,
  FinalScoreLabel,
} from "./schemas.js";
import { roundScore } from "./utils.js";
import { computeAdoption } from "./adoption.js";
import { computeMaintenance } from "./maintenance.js";
import { computeStability } from "./stability.js";
import { computeMaturity } from "./maturity.js";
import { computeCommunityHealth } from "./community-health.js";

// ─── Label Classification ────────────────────────────────────────────────────

function classifyScore(total: number): FinalScoreLabel {
  return match(true)
    .when(
      () => total >= 9.0,
      () => "Exceptional" as const
    )
    .when(
      () => total >= 7.5,
      () => "Excellent" as const
    )
    .when(
      () => total >= 6.0,
      () => "Good" as const
    )
    .when(
      () => total >= 4.5,
      () => "Fair" as const
    )
    .when(
      () => total >= 3.0,
      () => "Concerning" as const
    )
    .when(
      () => total >= 1.5,
      () => "Poor" as const
    )
    .otherwise(() => "Critical" as const);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Computes the full Obsidian Plugin Quality Score (0–10).
 *
 * This function is:
 * - **Stateless**: No side effects, no mutation, no external dependencies.
 * - **Idempotent**: Same inputs always produce the same output.
 * - **Type-safe**: All inputs and outputs are fully typed via Valibot schemas.
 *
 * @param plugin - Validated plugin data.
 * @param ecosystem - Validated ecosystem percentile data.
 * @param now - ISO timestamp representing the evaluation moment.
 * @returns The complete scored breakdown.
 */
export function computeQualityScore(
  plugin: PluginData,
  ecosystem: EcosystemPercentiles,
  now: string
): FinalScore {
  const adoption = computeAdoption(plugin, ecosystem, now);
  const maintenance = computeMaintenance(plugin, now);
  const stability = computeStability(plugin, now);
  const maturity = computeMaturity(plugin, now);
  const communityHealth = computeCommunityHealth(plugin, now);

  const total = roundScore(
    adoption.score +
      maintenance.score +
      stability.score +
      maturity.score +
      communityHealth.score
  );

  return {
    total,
    label: classifyScore(total),
    dimensions: {
      adoption,
      maintenance,
      stability,
      maturity,
      communityHealth,
    },
  };
}
