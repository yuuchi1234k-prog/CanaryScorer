import type { PluginData, DimensionBreakdown, OpenIssue } from "./schemas.js";
import {
  daysBetween,
  monthsBetween,
  maxDate,
  median,
  scoreByThresholdAscending,
  scoreByThresholdDescending,
  sortReleasesByDate,
  clampScore,
  roundScore,
  type SortedRelease,
} from "./utils.js";

const DIMENSION_MAX = 2.0;

// ─── Edge Case Flags ─────────────────────────────────────────────────────────

interface MaintenanceFlags {
  readonly isComplete: boolean;
}

function detectMaintenanceFlags(plugin: PluginData, now: string): MaintenanceFlags {
  const openBugs = plugin.openIssues.filter((i: OpenIssue) => i.label === "bug").length;
  const pluginAgeMonths = monthsBetween(plugin.createdAt, now);

  return {
    isComplete:
      plugin.commitCountInLast24Months < 3 &&
      openBugs === 0 &&
      plugin.totalDownloads > 1000 &&
      pluginAgeMonths >= 12 &&
      plugin.totalReleases >= 3,
  };
}

// ─── 2a. Recency of Last Meaningful Activity (0–0.7) ─────────────────────────

const RECENCY_THRESHOLDS = [
  { threshold: 30, score: 0.7 },
  { threshold: 90, score: 0.55 },
  { threshold: 180, score: 0.4 },
  { threshold: 365, score: 0.2 },
] as const;

function computeRecency(
  plugin: PluginData,
  now: string
): { readonly value: number; readonly score: number } {
  const lastActivity = maxDate(plugin.latestReleaseAt, plugin.lastCommitDate);
  const daysSince = daysBetween(lastActivity, now);

  const score = scoreByThresholdAscending(daysSince, RECENCY_THRESHOLDS, 0.05);

  return { value: roundScore(daysSince, 1), score };
}

// ─── 2b. Commit Consistency (0–0.6) ──────────────────────────────────────────

const COMMIT_RATE_THRESHOLDS = [
  { threshold: 8, score: 0.6 },
  { threshold: 4, score: 0.5 },
  { threshold: 2, score: 0.4 },
  { threshold: 1, score: 0.25 },
  { threshold: 0.25, score: 0.1 },
] as const;

function computeCommitConsistency(
  plugin: PluginData,
  now: string
): { readonly value: number; readonly score: number } {
  const pluginAgeMonths = monthsBetween(plugin.createdAt, now);
  const effectiveMonths = Math.min(24, Math.max(1, pluginAgeMonths));
  
  let commitRate = plugin.commitCountInLast24Months / effectiveMonths;

  if (commitRate > 15) {
    commitRate = 15 + Math.log2(commitRate - 14);
  }

  const score = scoreByThresholdDescending(
    commitRate,
    COMMIT_RATE_THRESHOLDS,
    0.0
  );

  return { value: roundScore(commitRate, 2), score };
}

// ─── 2c. Release Cadence (0–0.7) ────────────────────────────────────────────

const MEDIAN_GAP_THRESHOLDS = [
  { threshold: 30, score: 0.7 },
  { threshold: 60, score: 0.55 },
  { threshold: 120, score: 0.4 },
  { threshold: 240, score: 0.25 },
] as const;

function computeReleaseCadence(
  plugin: PluginData,
  now: string
): { readonly value: number; readonly score: number } {
  const sorted = sortReleasesByDate(plugin.releases);
  const releaseDates = sorted.map((r: SortedRelease) => new Date(r.publishedAt).getTime());

  const gaps: number[] = [];
  for (let i = 1; i < releaseDates.length; i++) {
    const d1 = releaseDates[i];
    const d2 = releaseDates[i - 1];
    if (d1 !== undefined && d2 !== undefined) {
      gaps.push((d1 - d2) / 86_400_000);
    }
  }

  if (gaps.length === 0) {
    const firstRel = sorted[0];
    const daysSinceOnlyRelease = daysBetween(firstRel?.publishedAt ?? plugin.createdAt, now);
    const score = daysSinceOnlyRelease <= 90 ? 0.3 : 0.0;
    return { value: roundScore(daysSinceOnlyRelease, 1), score };
  }

  const meaningfulGaps = gaps.filter((g: number) => g >= 1);
  const daysSinceLastRelease = daysBetween(plugin.latestReleaseAt, now);
  
  const medianGapDays = meaningfulGaps.length === 0 ? daysSinceLastRelease : median(meaningfulGaps);

  let baseScore = scoreByThresholdAscending(
    medianGapDays,
    MEDIAN_GAP_THRESHOLDS,
    0.1
  );

  const cadenceRatio = daysSinceLastRelease / (medianGapDays + 1);

  if (cadenceRatio > 3.0) {
    baseScore *= 0.3;
  } else if (cadenceRatio > 2.0) {
    baseScore *= 0.6;
  } else if (cadenceRatio > 1.5) {
    baseScore *= 0.8;
  }

  return { value: roundScore(medianGapDays, 1), score: roundScore(baseScore) };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function computeMaintenance(
  plugin: PluginData,
  now: string
): DimensionBreakdown {
  const flags = detectMaintenanceFlags(plugin, now);
  const recency = computeRecency(plugin, now);
  const commitConsistency = computeCommitConsistency(plugin, now);
  const releaseCadence = computeReleaseCadence(plugin, now);

  const rawTotal = recency.score + commitConsistency.score + releaseCadence.score;
  const featureCompleteFloor = flags.isComplete ? 1.0 : 0.0;
  
  const finalScore = clampScore(Math.max(roundScore(rawTotal), featureCompleteFloor), DIMENSION_MAX);

  return {
    label: "Maintenance",
    score: finalScore,
    maxScore: DIMENSION_MAX,
    subsignals: {
      recency,
      commitConsistency,
      releaseCadence,
    },
  };
}
