import type { PluginData, DimensionBreakdown, ClosedIssue, OpenPR, MergedPR, OpenIssue } from "./schemas.js";
import {
  daysBetween,
  median,
  percentile,
  scoreByThresholdAscending,
  scoreByThresholdDescending,
  clampScore,
  roundScore,
} from "./utils.js";

const DIMENSION_MAX = 2.0;
const NEW_PLUGIN_ISSUE_THRESHOLD = 5;

// ─── 5a. Issue Responsiveness (0–0.8) ────────────────────────────────────────

const CLOSE_TIME_THRESHOLDS = [
  { threshold: 7, score: 0.8 },
  { threshold: 14, score: 0.65 },
  { threshold: 30, score: 0.5 },
  { threshold: 60, score: 0.35 },
  { threshold: 120, score: 0.2 },
] as const;

function computeIssueResponsiveness(
  plugin: PluginData,
  now: string
): { readonly value: number; readonly score: number } {
  const closedCount = plugin.closedIssues.length;
  const openCount = plugin.openIssues.length;
  const totalCount = closedCount + openCount;

  if (totalCount < NEW_PLUGIN_ISSUE_THRESHOLD) {
    return { value: -1, score: 0.4 };
  }

  const allCloseTimeDays = plugin.closedIssues.map((i: ClosedIssue) =>
    daysBetween(i.createdAt, i.closedAt)
  );
  const bugCloseTimeDays = plugin.closedIssues
    .filter((i: ClosedIssue) => i.originalLabel === "bug")
    .map((i: ClosedIssue) => daysBetween(i.createdAt, i.closedAt));

  let score = 0;
  let effectiveCloseTime = 0;

  if (allCloseTimeDays.length === 0) {
    if (openCount === 0) {
      return { value: -1, score: 0.4 };
    }
    return { value: -1, score: 0.1 };
  }

  const p75CloseTime = percentile(allCloseTimeDays, 75);

  if (bugCloseTimeDays.length >= 3) {
    const bugP75 = percentile(bugCloseTimeDays, 75);
    effectiveCloseTime = (p75CloseTime + bugP75) / 2;
  } else {
    effectiveCloseTime = p75CloseTime;
  }

  score = scoreByThresholdAscending(effectiveCloseTime, CLOSE_TIME_THRESHOLDS, 0.1);

  const dismissCount = plugin.closedIssues.filter(
    (i: ClosedIssue) => i.reason === "wont_fix" || i.reason === "not_planned"
  ).length;
  const dismissRate = dismissCount / Math.max(closedCount, 1);

  if (dismissRate > 0.5) {
    score *= 0.6;
  } else if (dismissRate > 0.3) {
    score *= 0.8;
  }

  const oldOpenIssues = plugin.openIssues.filter(
    (i: OpenIssue) => daysBetween(i.createdAt, now) > 90
  ).length;

  if (openCount > 0) {
    const neglectRatio = oldOpenIssues / openCount;
    if (neglectRatio > 0.7 && oldOpenIssues >= 3) {
      score *= 0.7;
    } else if (neglectRatio > 0.5 && oldOpenIssues >= 3) {
      score *= 0.85;
    }
  }

  return { value: roundScore(effectiveCloseTime, 1), score: roundScore(score) };
}

// ─── 5b. PR Engagement (0–0.7) ──────────────────────────────────────────────

const MERGE_RATE_THRESHOLDS = [
  { threshold: 0.7, score: 0.7 },
  { threshold: 0.5, score: 0.55 },
  { threshold: 0.3, score: 0.4 },
  { threshold: 0.1, score: 0.25 },
] as const;

const SOLO_DEVELOPER_PR_NEUTRAL = 0.35;

function computePREngagement(
  plugin: PluginData,
  now: string
): { readonly value: number; readonly score: number } {
  const totalCommunityPRs =
    plugin.openPRs.length + plugin.closedPRs.length + plugin.mergedPRs.length;

  if (totalCommunityPRs === 0) {
    return { value: -1, score: SOLO_DEVELOPER_PR_NEUTRAL };
  }

  const mergeRate = plugin.mergedPRs.length / totalCommunityPRs;

  let baseScore = scoreByThresholdDescending(mergeRate, MERGE_RATE_THRESHOLDS, 0.2);

  if (mergeRate === 0 && totalCommunityPRs > 0) {
    baseScore = Math.max(0.2, baseScore);
  }

  const stalePRs = plugin.openPRs.filter(
    (pr: OpenPR) => daysBetween(pr.createdAt, now) > 90
  ).length;
  const staleRatio = stalePRs / Math.max(plugin.openPRs.length, 1);

  if (staleRatio > 0.5) {
    baseScore *= 0.5;
  } else if (staleRatio > 0.3) {
    baseScore *= 0.7;
  }

  if (plugin.mergedPRs.length > 0) {
    const mergeTimes = plugin.mergedPRs.map((pr: MergedPR) =>
      daysBetween(pr.createdAt, pr.mergedAt)
    );
    const medianMergeTime = median(mergeTimes);
    if (medianMergeTime > 60) {
      baseScore *= 0.85;
    }
  }

  return { value: roundScore(mergeRate, 4), score: roundScore(baseScore) };
}

// ─── 5c. Feature Request Balance (0–0.5) ────────────────────────────────────

const ADDRESS_RATE_THRESHOLDS = [
  { threshold: 0.8, score: 0.5 },
  { threshold: 0.6, score: 0.4 },
  { threshold: 0.4, score: 0.25 },
  { threshold: 0.2, score: 0.1 },
] as const;

function computeFeatureRequestBalance(
  plugin: PluginData
): { readonly value: number; readonly score: number } {
  const openFeatureRequests = plugin.openIssues.filter(
    (i: OpenIssue) => i.label === "feature_request"
  ).length;
  const closedFeatures = plugin.closedIssues.filter(
    (i: ClosedIssue) => i.originalLabel === "feature_request"
  );
  const totalFeatureRequests = openFeatureRequests + closedFeatures.length;

  if (totalFeatureRequests < 3) {
    return { value: -1, score: 0.25 };
  }

  const implementedFeatures = closedFeatures.filter(
    (i: ClosedIssue) => i.reason === "completed" || i.reason === "fixed"
  ).length;

  const addressRate = closedFeatures.length / totalFeatureRequests;
  const implementRate = closedFeatures.length > 0 ? implementedFeatures / closedFeatures.length : 0;

  const engagementScore = addressRate;
  const qualityAdjustedRate = (engagementScore * 0.6) + (implementRate * 0.4);

  const score = scoreByThresholdDescending(
    qualityAdjustedRate,
    ADDRESS_RATE_THRESHOLDS,
    0.0
  );

  return { value: roundScore(qualityAdjustedRate, 4), score };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function computeCommunityHealth(
  plugin: PluginData,
  now: string
): DimensionBreakdown {
  const issueResponsiveness = computeIssueResponsiveness(plugin, now);
  const prEngagement = computePREngagement(plugin, now);
  const featureRequestBalance = computeFeatureRequestBalance(plugin);

  const rawTotal =
    issueResponsiveness.score +
    prEngagement.score +
    featureRequestBalance.score;
  const finalScore = clampScore(roundScore(rawTotal), DIMENSION_MAX);

  return {
    label: "Community Health",
    score: finalScore,
    maxScore: DIMENSION_MAX,
    subsignals: {
      issueResponsiveness,
      prEngagement,
      featureRequestBalance,
    },
  };
}
