import * as v from "valibot";

// ─── Primitive Schemas ───────────────────────────────────────────────────────

const NonNegativeNumber = v.pipe(v.number(), v.minValue(0));
const NonNegativeInteger = v.pipe(v.number(), v.integer(), v.minValue(0));
const ISODateString = v.pipe(v.string(), v.isoTimestamp());

// ─── Issue Classification ────────────────────────────────────────────────────

export const OpenIssueLabelSchema = v.picklist([
  "bug",
  "feature_request",
  "documentation",
  "question",
  "security",
  "other",
]);
export type OpenIssueLabel = v.InferOutput<typeof OpenIssueLabelSchema>;

export const ClosedIssueReasonSchema = v.picklist([
  "completed",
  "fixed",
  "wont_fix",
  "not_planned",
  "duplicate",
  "other",
]);
export type ClosedIssueReason = v.InferOutput<typeof ClosedIssueReasonSchema>;

// ─── Issue Schemas ───────────────────────────────────────────────────────────

export const OpenIssueSchema = v.object({
  label: OpenIssueLabelSchema,
  createdAt: ISODateString,
});
export type OpenIssue = v.InferOutput<typeof OpenIssueSchema>;

export const ClosedIssueSchema = v.object({
  originalLabel: OpenIssueLabelSchema,
  reason: ClosedIssueReasonSchema,
  createdAt: ISODateString,
  closedAt: ISODateString,
});
export type ClosedIssue = v.InferOutput<typeof ClosedIssueSchema>;

// ─── PR Schemas ──────────────────────────────────────────────────────────────

export const OpenPRSchema = v.object({
  createdAt: ISODateString,
});
export type OpenPR = v.InferOutput<typeof OpenPRSchema>;

export const ClosedPRSchema = v.object({
  createdAt: ISODateString,
  closedAt: ISODateString,
});
export type ClosedPR = v.InferOutput<typeof ClosedPRSchema>;

export const MergedPRSchema = v.object({
  createdAt: ISODateString,
  mergedAt: ISODateString,
});
export type MergedPR = v.InferOutput<typeof MergedPRSchema>;

// ─── Release Schema ──────────────────────────────────────────────────────────

export const ReleaseSchema = v.object({
  publishedAt: ISODateString,
  downloads: NonNegativeInteger,
});
export type Release = v.InferOutput<typeof ReleaseSchema>;

// ─── Ecosystem Percentile Data ───────────────────────────────────────────────

export const EcosystemPercentilesSchema = v.object({
  allDownloadsPerDay: v.pipe(v.array(NonNegativeNumber), v.minLength(1)),
  allStarRatios: v.pipe(v.array(NonNegativeNumber), v.minLength(1)),
});
export type EcosystemPercentiles = v.InferOutput<
  typeof EcosystemPercentilesSchema
>;

// ─── Main Plugin Input Schema ────────────────────────────────────────────────

export const PluginDataSchema = v.object({
  totalDownloads: NonNegativeInteger,
  stargazers: NonNegativeInteger,
  createdAt: ISODateString,
  latestReleaseAt: ISODateString,
  lastCommitDate: ISODateString,
  commitCountInLast24Months: NonNegativeInteger,
  totalReleases: NonNegativeInteger,
  releases: v.array(ReleaseSchema),
  openIssues: v.array(OpenIssueSchema),
  closedIssues: v.array(ClosedIssueSchema),
  openPRs: v.array(OpenPRSchema),
  closedPRs: v.array(ClosedPRSchema),
  mergedPRs: v.array(MergedPRSchema),
});
export type PluginData = v.InferOutput<typeof PluginDataSchema>;

// ─── Scoring Context (plugin data + ecosystem data + evaluation time) ────────

export const ScoringContextSchema = v.object({
  plugin: PluginDataSchema,
  ecosystem: EcosystemPercentilesSchema,
  now: ISODateString,
});
export type ScoringContext = v.InferOutput<typeof ScoringContextSchema>;

// ─── Dimension Score Result ──────────────────────────────────────────────────

export const DimensionBreakdownSchema = v.object({
  label: v.string(),
  score: NonNegativeNumber,
  maxScore: NonNegativeNumber,
  subsignals: v.record(
    v.string(),
    v.object({
      value: v.number(),
      score: NonNegativeNumber,
    })
  ),
});
export type DimensionBreakdown = v.InferOutput<typeof DimensionBreakdownSchema>;

// ─── Final Score ─────────────────────────────────────────────────────────────

export const FinalScoreLabelSchema = v.picklist([
  "Exceptional",
  "Excellent",
  "Good",
  "Fair",
  "Concerning",
  "Poor",
  "Critical",
]);
export type FinalScoreLabel = v.InferOutput<typeof FinalScoreLabelSchema>;

export const FinalScoreSchema = v.object({
  total: NonNegativeNumber,
  label: FinalScoreLabelSchema,
  dimensions: v.object({
    adoption: DimensionBreakdownSchema,
    maintenance: DimensionBreakdownSchema,
    stability: DimensionBreakdownSchema,
    maturity: DimensionBreakdownSchema,
    communityHealth: DimensionBreakdownSchema,
  }),
});
export type FinalScore = v.InferOutput<typeof FinalScoreSchema>;
