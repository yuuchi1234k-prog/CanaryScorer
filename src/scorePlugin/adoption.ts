import type { PluginData, EcosystemPercentiles, DimensionBreakdown } from "./schemas.js";
import {
  daysBetween,
  percentileRank,
  scoreByThresholdDescending,
  sortReleasesByDate,
  clampScore,
  roundScore,
  type SortedRelease,
} from "./utils.js";

const DIMENSION_MAX = 2.0;

// ─── 1a. Download Velocity (0–0.8) ──────────────────────────────────────────

const DOWNLOAD_VELOCITY_THRESHOLDS =[
  { threshold: 0.9, score: 0.8 },
  { threshold: 0.7, score: 0.6 },
  { threshold: 0.5, score: 0.4 },
  { threshold: 0.3, score: 0.2 },
] as const;

const DOWNLOAD_VELOCITY_FLOOR = 0.1;

function computeDownloadVelocity(
  plugin: PluginData,
  ecosystem: EcosystemPercentiles,
  now: string
): { readonly value: number; readonly score: number } {
  const ageDays = Math.max(1, daysBetween(plugin.createdAt, now));
  const downloadsPerDay = plugin.totalDownloads / ageDays;

  const pRank = percentileRank(downloadsPerDay, ecosystem.allDownloadsPerDay);

  const score = scoreByThresholdDescending(
    pRank,
    DOWNLOAD_VELOCITY_THRESHOLDS,
    DOWNLOAD_VELOCITY_FLOOR
  );

  return { value: roundScore(downloadsPerDay, 4), score };
}

// ─── 1b. Star-to-Download Ratio (0–0.4) ─────────────────────────────────────

const STAR_RATIO_THRESHOLDS =[
  { threshold: 0.8, score: 0.4 },
  { threshold: 0.6, score: 0.3 },
  { threshold: 0.4, score: 0.2 },
  { threshold: 0.2, score: 0.1 },
] as const;

function computeStarRatio(
  plugin: PluginData,
  ecosystem: EcosystemPercentiles
): { readonly value: number; readonly score: number } {
  const starRatio = plugin.stargazers / plugin.totalDownloads; // No +1 needed due to threshold
  const pRank = percentileRank(starRatio, ecosystem.allStarRatios);

  const score = scoreByThresholdDescending(pRank, STAR_RATIO_THRESHOLDS, 0.0);

  return { value: roundScore(starRatio, 6), score };
}

// ─── 1c. Recent Download Trend (0–0.8) ──────────────────────────────────────

const TREND_THRESHOLDS =[
  { threshold: 2.0, score: 0.8 },
  { threshold: 1.3, score: 0.6 },
  { threshold: 0.8, score: 0.4 },
  { threshold: 0.4, score: 0.2 },
] as const;

function computeDownloadTrend(
  plugin: PluginData,
  now: string
): { readonly value: number; readonly score: number } {
  const sorted = sortReleasesByDate(plugin.releases);

  if (sorted.length <= 1) {
    return { value: 1.0, score: 0.4 };
  }

  let recentSlice: typeof sorted;
  let olderSlice: typeof sorted;

  if (sorted.length >= 6) {
    recentSlice = sorted.slice(-3);
    olderSlice = sorted.slice(-6, -3);
  } else {
    const mid = Math.floor(sorted.length / 2);
    recentSlice = sorted.slice(mid);
    olderSlice = sorted.slice(0, mid);
  }

  const olderFirst = olderSlice[0]?.publishedAt;
  const recentFirst = recentSlice[0]?.publishedAt;

  if (!olderFirst || !recentFirst) {
    return { value: 1.0, score: 0.4 };
  }

  const olderSpan = Math.max(1, daysBetween(olderFirst, recentFirst));
  const recentSpan = Math.max(1, daysBetween(recentFirst, now));

  const olderDl = olderSlice.reduce((s: number, r: SortedRelease) => s + r.downloads, 0);
  const recentDl = recentSlice.reduce((s: number, r: SortedRelease) => s + r.downloads, 0);

  let olderRate = olderDl / olderSpan;
  const recentRate = recentDl / recentSpan;

  const pluginAgeDays = Math.max(1, daysBetween(plugin.createdAt, now));
  const lifetimeAvgDownloadsPerDay = plugin.totalDownloads / pluginAgeDays;

  // Spike dampening
  olderRate = Math.min(olderRate, lifetimeAvgDownloadsPerDay * 3);

  const trendRatio = recentRate / (olderRate + 0.1);

  const score = scoreByThresholdDescending(trendRatio, TREND_THRESHOLDS, 0.0);

  return { value: roundScore(trendRatio, 4), score };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function computeAdoption(
  plugin: PluginData,
  ecosystem: EcosystemPercentiles,
  now: string
): DimensionBreakdown {
  if (plugin.totalDownloads < 50) {
    return {
      label: "Adoption",
      score: 0.5,
      maxScore: DIMENSION_MAX,
      subsignals: {
        insufficientData: { value: plugin.totalDownloads, score: 0.5 },
      },
    };
  }

  const velocity = computeDownloadVelocity(plugin, ecosystem, now);
  const starRatio = computeStarRatio(plugin, ecosystem);
  const trend = computeDownloadTrend(plugin, now);

  const rawTotal = velocity.score + starRatio.score + trend.score;
  const finalScore = clampScore(roundScore(rawTotal), DIMENSION_MAX);

  return {
    label: "Adoption",
    score: finalScore,
    maxScore: DIMENSION_MAX,
    subsignals: {
      downloadVelocity: velocity,
      starToDownloadRatio: starRatio,
      recentDownloadTrend: trend,
    },
  };
}
