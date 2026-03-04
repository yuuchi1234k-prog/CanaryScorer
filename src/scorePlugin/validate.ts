import { err, ok, type Result } from "neverthrow";
import * as v from "valibot";
import {
  type ScoringContext,
  ScoringContextSchema,
  type PluginData,
  PluginDataSchema,
  type EcosystemPercentiles,
  EcosystemPercentilesSchema,
} from "./schemas.js";

// ─── Validation Error ────────────────────────────────────────────────────────

export interface ValidationError {
  readonly kind: "ValidationError";
  readonly message: string;
  readonly issues: readonly { readonly path: string; readonly message: string }[];
}

function formatIssues(
  issues: readonly v.BaseIssue<unknown>[]
): readonly { readonly path: string; readonly message: string }[] {
  return issues.map((issue: v.BaseIssue<unknown>) => ({
    path: issue.path?.map((p: v.IssuePathItem) => String(p.key)).join(".") ?? "<root>",
    message: issue.message,
  }));
}

function makeValidationError(
  issues: readonly v.BaseIssue<unknown>[]
): ValidationError {
  return {
    kind: "ValidationError",
    message: `Validation failed with ${issues.length} issue(s)`,
    issues: formatIssues(issues),
  };
}

// ─── Public Validators ───────────────────────────────────────────────────────

export function validateScoringContext(
  input: unknown
): Result<ScoringContext, ValidationError> {
  const result = v.safeParse(ScoringContextSchema, input);
  if (result.success) {
    return ok(result.output);
  }
  return err(makeValidationError(result.issues));
}

export function validatePluginData(
  input: unknown
): Result<PluginData, ValidationError> {
  const result = v.safeParse(PluginDataSchema, input);
  if (result.success) {
    return ok(result.output);
  }
  return err(makeValidationError(result.issues));
}

export function validateEcosystemPercentiles(
  input: unknown
): Result<EcosystemPercentiles, ValidationError> {
  const result = v.safeParse(EcosystemPercentilesSchema, input);
  if (result.success) {
    return ok(result.output);
  }
  return err(makeValidationError(result.issues));
}
