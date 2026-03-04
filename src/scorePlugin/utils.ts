import invariant from "tiny-invariant";
import { 
  differenceInMilliseconds, 
  differenceInMonths, 
  parseISO, 
  max as dateMax, 
  isBefore,
  addMilliseconds
} from "date-fns";

// ─── Date Constants ──────────────────────────────────────────────────────────

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ─── Date Arithmetic ─────────────────────────────────────────────────────────

/**
 * Computes the number of days between two ISO date strings.
 * Returns 0 if `from` is after `to`.
 */
export function daysBetween(from: string, to: string): number {
  const diffMs = differenceInMilliseconds(parseISO(to), parseISO(from));
  return Math.max(0, diffMs / MS_PER_DAY);
}

/**
 * Computes the number of approximate months between two ISO date strings.
 * Returns 0 if `from` is after `to`.
 */
export function monthsBetween(from: string, to: string): number {
  const diff = differenceInMonths(parseISO(to), parseISO(from));
  return Math.max(0, diff);
}

/**
 * Returns the later of two ISO date strings.
 */
export function maxDate(a: string, b: string): string {
  const dateA = parseISO(a);
  const dateB = parseISO(b);
  return dateMax([dateA, dateB]).toISOString();
}

// ─── Statistical Helpers ─────────────────────────────────────────────────────

/**
 * Computes the median of a non-empty numeric array.
 * Returns 0 for an empty array (defensive).
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a: number, b: number) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? 0;
  }
  
  const lower = sorted[mid - 1] ?? 0;
  const upper = sorted[mid] ?? 0;
  
  return (lower + upper) / 2;
}

/**
 * Computes the p-th percentile (0-100) of a numeric array.
 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a: number, b: number) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  const vLower = sorted[lower];
  if (vLower === undefined) {
    return 0;
  }

  if (upper >= sorted.length) {
    return vLower;
  }

  const vUpper = sorted[upper];
  if (vUpper === undefined) {
    return vLower;
  }

  return vLower * (1 - weight) + vUpper * weight;
}

/**
 * Computes the percentile rank (0–1) of a value within a sorted dataset.
 * Uses the "percentage of values strictly less than" definition.
 */
export function percentileRank(
  value: number,
  dataset: readonly number[]
): number {
  invariant(dataset.length > 0, "percentileRank requires a non-empty dataset");

  let countBelow = 0;
  for (const v of dataset) {
    if (v < value) {
      countBelow++;
    }
  }
  return countBelow / dataset.length;
}

// ─── Threshold-based Scoring ─────────────────────────────────────────────────

export interface ThresholdEntry {
  readonly threshold: number;
  readonly score: number;
}

/**
 * Scores a value against a descending list of thresholds.
 */
export function scoreByThresholdDescending(
  value: number,
  thresholds: readonly ThresholdEntry[],
  defaultScore: number
): number {
  for (const entry of thresholds) {
    if (value >= entry.threshold) {
      return entry.score;
    }
  }
  return defaultScore;
}

/**
 * Scores a value against an ascending list of thresholds (for "lower is better" metrics).
 */
export function scoreByThresholdAscending(
  value: number,
  thresholds: readonly ThresholdEntry[],
  defaultScore: number
): number {
  for (const entry of thresholds) {
    if (value <= entry.threshold) {
      return entry.score;
    }
  }
  return defaultScore;
}

// ─── Clamping ────────────────────────────────────────────────────────────────

export function clampScore(score: number, max: number): number {
  return Math.max(0, Math.min(score, max));
}

export function roundScore(score: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round(score * factor) / factor;
}

// ─── Release Helpers ─────────────────────────────────────────────────────────

export interface SortedRelease {
  readonly publishedAt: string;
  readonly downloads: number;
}

export function sortReleasesByDate(
  releases: readonly SortedRelease[]
): readonly SortedRelease[] {
  return [...releases].sort((a: SortedRelease, b: SortedRelease) => {
    return differenceInMilliseconds(parseISO(a.publishedAt), parseISO(b.publishedAt));
  });
}

export interface QuarterSummary {
  readonly downloads: number;
  readonly daySpan: number;
}

/**
 * Divides the lifetime of the plugin [createdAt, now] into equal-length calendar quarters.
 * Interpolates downloads for quarters without direct releases based on the active release.
 */
export function divideLifetimeIntoQuarters(
  createdAt: string,
  now: string,
  releases: readonly SortedRelease[],
  numQuarters: number = 4
): readonly QuarterSummary[] {
  const start = parseISO(createdAt);
  const end = parseISO(now);
  const totalSpanMs = differenceInMilliseconds(end, start);

  if (totalSpanMs <= 0 || numQuarters <= 0) {
    return [];
  }

  const sorted = sortReleasesByDate(releases);
  const quarterSpanMs = totalSpanMs / numQuarters;
  const quarters: QuarterSummary[] = [];

  for (let q = 0; q < numQuarters; q++) {
    const qStart = addMilliseconds(start, q * quarterSpanMs);
    const qEnd = addMilliseconds(start, (q + 1) * quarterSpanMs);
    const daySpan = Math.max(1, differenceInMilliseconds(qEnd, qStart) / MS_PER_DAY);

    const releasesInQ = sorted.filter((r: SortedRelease) => {
      const t = parseISO(r.publishedAt);
      return !isBefore(t, qStart) && isBefore(t, qEnd);
    });

    if (releasesInQ.length > 0) {
      const downloads = releasesInQ.reduce((s: number, r: SortedRelease) => s + r.downloads, 0);
      quarters.push({ downloads, daySpan });
    } else {
      let currentReleaseIndex = -1;
      for (let i = sorted.length - 1; i >= 0; i--) {
        const rel = sorted[i];
        if (rel && isBefore(parseISO(rel.publishedAt), qStart)) {
          currentReleaseIndex = i;
          break;
        }
      }

      const currentRelease = currentReleaseIndex >= 0 ? sorted[currentReleaseIndex] : undefined;
      if (currentRelease) {
        const nextRelease = sorted[currentReleaseIndex + 1];
        
        const currentReleaseTime = parseISO(currentRelease.publishedAt);
        const nextReleaseTime = nextRelease ? parseISO(nextRelease.publishedAt) : end;
        
        const totalDaysAsCurrent = Math.max(1, differenceInMilliseconds(nextReleaseTime, currentReleaseTime) / MS_PER_DAY);
        
        const downloads = currentRelease.downloads * (daySpan / totalDaysAsCurrent);
        quarters.push({ downloads, daySpan });
      } else {
        quarters.push({ downloads: 0, daySpan });
      }
    }
  }

  return quarters;
}
