import type { PluginData, DimensionBreakdown } from "./schemas.js";
import {
  daysBetween,
  monthsBetween,
  median,
  scoreByThresholdDescending,
  divideLifetimeIntoQuarters,
  clampScore,
  roundScore,
  type QuarterSummary,
} from "./utils.js";

const DIMENSION_MAX = 2.0;
const NEW_PLUGIN_THRESHOLD_DAYS = 90;

// ─── 4a. Age (0–0.5) ────────────────────────────────────────────────────────

const AGE_THRESHOLDS = [
  { threshold: 36, score: 0.5 },
  { threshold: 24, score: 0.4 },
  { threshold: 12, score: 0.3 },
  { threshold: 6, score: 0.2 },
  { threshold: 3, score: 0.1 },
] as const;

function computeAge(
  plugin: PluginData,
  now: string
): { readonly value: number; readonly score: number } {
  const ageMonths = monthsBetween(plugin.createdAt, now);

  const score = scoreByThresholdDescending(ageMonths, AGE_THRESHOLDS, 0.05);

  return { value: roundScore(ageMonths, 1), score };
}

// ─── 4b. Release Count (0–0.5) ──────────────────────────────────────────────

const RELEASE_COUNT_THRESHOLDS = [
  { threshold: 20, score: 0.5 },
  { threshold: 12, score: 0.4 },
  { threshold: 6, score: 0.3 },
  { threshold: 3, score: 0.2 },
  { threshold: 1, score: 0.1 },
] as const;

function computeReleaseCount(
  plugin: PluginData
): { readonly value: number; readonly score: number } {
  const score = scoreByThresholdDescending(
    plugin.totalReleases,
    RELEASE_COUNT_THRESHOLDS,
    0.0
  );

  return { value: plugin.totalReleases, score };
}

// ─── 4c. Sustained Adoption (0–1.0) ─────────────────────────────────────────

const SUSTAINED_FRACTION_THRESHOLDS = [
  { threshold: 0.8, score: 1.0 },
  { threshold: 0.6, score: 0.75 },
  { threshold: 0.4, score: 0.5 },
  { threshold: 0.2, score: 0.25 },
] as const;

const NEW_PLUGIN_SUSTAINED_NEUTRAL = 0.5;

function computeSustainedAdoption(
  plugin: PluginData,
  now: string
): { readonly value: number; readonly score: number } {
  const ageDays = daysBetween(plugin.createdAt, now);

  if (ageDays < NEW_PLUGIN_THRESHOLD_DAYS) {
    return { value: -1, score: NEW_PLUGIN_SUSTAINED_NEUTRAL };
  }

  const quarters = divideLifetimeIntoQuarters(plugin.createdAt, now, plugin.releases, 4);

  if (quarters.length < 2) {
    return { value: -1, score: NEW_PLUGIN_SUSTAINED_NEUTRAL };
  }

  const quarterRates = quarters.map((q: QuarterSummary) => q.downloads / Math.max(1, q.daySpan));
  const medianRate = median(quarterRates);

  if (medianRate === 0) {
    return { value: 0, score: 0.1 };
  }

  const sustainedQuarters = quarterRates.filter((r: number) => r >= medianRate * 0.5).length;
  const sustainedFraction = sustainedQuarters / quarters.length;

  const score = scoreByThresholdDescending(
    sustainedFraction,
    SUSTAINED_FRACTION_THRESHOLDS,
    0.1
  );

  return { value: roundScore(sustainedFraction, 4), score };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function computeMaturity(
  plugin: PluginData,
  now: string
): DimensionBreakdown {
  const age = computeAge(plugin, now);
  const releaseCount = computeReleaseCount(plugin);
  const sustainedAdoption = computeSustainedAdoption(plugin, now);

  const rawTotal = age.score + releaseCount.score + sustainedAdoption.score;
  const finalScore = clampScore(roundScore(rawTotal), DIMENSION_MAX);

  return {
    label: "Maturity",
    score: finalScore,
    maxScore: DIMENSION_MAX,
    subsignals: {
      age,
      releaseCount,
      sustainedAdoption,
    },
  };
}
