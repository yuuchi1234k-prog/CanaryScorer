import type {
  PluginData,
  DimensionBreakdown,
  ClosedIssue,
  OpenIssue,
} from "./schemas.js";
import {
  daysBetween,
  maxDate,
  scoreByThresholdAscending,
  scoreByThresholdDescending,
  clampScore,
  roundScore,
} from "./utils.js";

const DIMENSION_MAX = 2.0;

// ─── Shared Issue Helpers ────────────────────────────────────────────────────

function countOpenBugs(plugin: PluginData): number {
  return plugin.openIssues.filter((i: OpenIssue) => i.label === "bug").length;
}

function closedBugs(plugin: PluginData): readonly ClosedIssue[] {
  return plugin.closedIssues.filter((i: ClosedIssue) => i.originalLabel === "bug");
}

function closedBugsFixed(plugin: PluginData): readonly ClosedIssue[] {
  return closedBugs(plugin).filter(
    (i: ClosedIssue) => i.reason === "completed" || i.reason === "fixed"
  );
}

// ─── 3a. Bug Ratio (0–1.0) ──────────────────────────────────────────────────

const BUG_RATIO_THRESHOLDS = [
  { threshold: 0, score: 1.0 },
  { threshold: 0.05, score: 0.85 },
  { threshold: 0.1, score: 0.7 },
  { threshold: 0.2, score: 0.5 },
  { threshold: 0.35, score: 0.3 },
  { threshold: 0.5, score: 0.15 },
] as const;

function computeBugRatio(
  plugin: PluginData
): { readonly value: number; readonly score: number } {
  const totalIssues = plugin.openIssues.length + plugin.closedIssues.length;
  const openBugs = countOpenBugs(plugin);

  if (totalIssues === 0) {
    return { value: 0, score: 1.0 };
  }

  const bugRatio = openBugs / totalIssues;

  const score = scoreByThresholdAscending(bugRatio, BUG_RATIO_THRESHOLDS, 0.0);

  return { value: roundScore(bugRatio, 4), score };
}

// ─── 3b. Bug Resolution Effectiveness (0–0.6) ───────────────────────────────

const FIX_RATE_THRESHOLDS = [
  { threshold: 0.9, score: 0.6 },
  { threshold: 0.75, score: 0.45 },
  { threshold: 0.6, score: 0.3 },
  { threshold: 0.4, score: 0.15 },
] as const;

function computeBugResolution(
  plugin: PluginData
): { readonly value: number; readonly score: number } {
  const totalBugsEver = countOpenBugs(plugin) + closedBugs(plugin).length;

  if (totalBugsEver === 0) {
    return { value: 1.0, score: 0.6 };
  }

  const fixRate = closedBugsFixed(plugin).length / totalBugsEver;

  const score = scoreByThresholdDescending(fixRate, FIX_RATE_THRESHOLDS, 0.0);

  return { value: roundScore(fixRate, 4), score };
}

// ─── 3c. Bug Density (0–0.4) ────────────────────────────────────────────────

const BUGS_PER_10K_THRESHOLDS = [
  { threshold: 1, score: 0.4 },
  { threshold: 3, score: 0.3 },
  { threshold: 7, score: 0.2 },
  { threshold: 15, score: 0.1 },
] as const;

function computeIssueDownloadRatio(
  plugin: PluginData
): { readonly value: number; readonly score: number } {
  const openBugs = countOpenBugs(plugin);
  const bugsPer10k = (openBugs * 10000) / plugin.totalDownloads;

  const score = scoreByThresholdAscending(
    bugsPer10k,
    BUGS_PER_10K_THRESHOLDS,
    0.0
  );

  return { value: roundScore(bugsPer10k, 4), score };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function computeStability(plugin: PluginData, now: string): DimensionBreakdown {
  if (plugin.totalDownloads < 100) {
    return {
      label: "Stability",
      score: 1.0,
      maxScore: DIMENSION_MAX,
      subsignals: {
        insufficientData: { value: plugin.totalDownloads, score: 1.0 },
      },
    };
  }

  const daysSinceActivity = daysBetween(maxDate(plugin.latestReleaseAt, plugin.lastCommitDate), now);
  const totalIssuesEver = plugin.openIssues.length + plugin.closedIssues.length;
  const stabilityConfidenceCap = (daysSinceActivity > 365 && totalIssuesEver < 5) ? 1.2 : 2.0;

  const bugRatio = computeBugRatio(plugin);
  const bugResolution = computeBugResolution(plugin);
  const issueDownloadRatio = computeIssueDownloadRatio(plugin);

  const rawTotal = bugRatio.score + bugResolution.score + issueDownloadRatio.score;
  const finalScore = clampScore(Math.min(roundScore(rawTotal), stabilityConfidenceCap), DIMENSION_MAX);

  return {
    label: "Stability",
    score: finalScore,
    maxScore: DIMENSION_MAX,
    subsignals: {
      bugRatio,
      bugResolutionEffectiveness: bugResolution,
      issueToDownloadRatio: issueDownloadRatio,
    },
  };
}
