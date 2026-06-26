/**
 * Pure comparison/aggregation for a project's imported runs and manual scores.
 *
 * Framework- and database-free so it can be unit tested in isolation. It only
 * summarizes stored evidence:
 *   - Missing metrics stay `null` (unavailable), never counted as 0.
 *   - No winner is declared when there are no scored runs.
 *   - Small samples are flagged as limited evidence, not stated as fact.
 *   - hallucinationRisk stays reversed (5 = lowest risk); it is averaged as-is.
 */
import {
  aggregateManualScores,
  averageManualScore,
  roundTo2,
  type ManualScore,
  type RubricAverages,
} from "./domain";

/** Minimum scored runs before a comparison is treated as more than limited. */
export const MIN_RELIABLE_SCORED_RUNS = 4;
/** Minimum distinct scored variants before variants can be meaningfully ranked. */
export const MIN_VARIANTS_FOR_COMPARISON = 2;

export interface ComparisonRunInput {
  variant: string;
  matched: boolean;
  ok: boolean;
  elapsedSeconds: number | null;
  tokensPerSecond: number | null;
  /** Full rubric score, or null when the run is unscored. */
  score: ManualScore | null;
}

export interface VariantComparison {
  variant: string;
  runCount: number;
  scoredCount: number;
  /** Mean of per-run average scores within this variant, or null. */
  averageScore: number | null;
  rubricAverages: RubricAverages;
  /** Mean of available elapsed seconds (nulls ignored), or null. */
  averageElapsedSeconds: number | null;
  /** Mean of available tokens/sec (nulls ignored), or null. */
  averageTokensPerSecond: number | null;
}

export type EvidenceLevel = "none" | "limited" | "ok";

export interface ComparisonSummary {
  totalRuns: number;
  scoredRuns: number;
  unscoredRuns: number;
  matchedRuns: number;
  unmatchedRuns: number;
  /** Mean of per-run average scores across all scored runs, or null. */
  averageScore: number | null;
  variants: VariantComparison[];
  /** Highest-average variant; null when no scored runs exist. */
  bestVariant: { variant: string; averageScore: number } | null;
  evidence: EvidenceLevel;
}

/** Mean of finite numbers, rounded to 2 dp. Null when there is nothing to average. */
function meanOrNull(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return roundTo2(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function finite(values: Array<number | null>): number[] {
  return values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

function compareVariant(
  variant: string,
  runs: ComparisonRunInput[],
): VariantComparison {
  const scores = runs
    .map((run) => run.score)
    .filter((score): score is ManualScore => score !== null);
  const perRunAverages = finite(scores.map((score) => averageManualScore(score)));

  return {
    variant,
    runCount: runs.length,
    scoredCount: scores.length,
    averageScore: meanOrNull(perRunAverages),
    rubricAverages: aggregateManualScores(scores).averages,
    averageElapsedSeconds: meanOrNull(finite(runs.map((r) => r.elapsedSeconds))),
    averageTokensPerSecond: meanOrNull(finite(runs.map((r) => r.tokensPerSecond))),
  };
}

export function buildComparison(runs: ComparisonRunInput[]): ComparisonSummary {
  const byVariant = new Map<string, ComparisonRunInput[]>();
  for (const run of runs) {
    const list = byVariant.get(run.variant) ?? [];
    list.push(run);
    byVariant.set(run.variant, list);
  }

  const variants = [...byVariant.entries()]
    .map(([variant, variantRuns]) => compareVariant(variant, variantRuns))
    .sort((a, b) => a.variant.localeCompare(b.variant));

  const scoredRuns = runs.filter((run) => run.score !== null).length;
  const matchedRuns = runs.filter((run) => run.matched).length;
  const overallPerRun = finite(
    runs
      .map((run) => run.score)
      .filter((score): score is ManualScore => score !== null)
      .map((score) => averageManualScore(score)),
  );

  // Best variant: only among variants that actually have scored runs.
  const rankable = variants.filter(
    (v): v is VariantComparison & { averageScore: number } =>
      v.scoredCount > 0 && v.averageScore !== null,
  );
  const variantsWithScores = rankable.length;
  let bestVariant: ComparisonSummary["bestVariant"] = null;
  if (rankable.length > 0) {
    const best = [...rankable].sort(
      (a, b) =>
        b.averageScore - a.averageScore ||
        b.scoredCount - a.scoredCount ||
        a.variant.localeCompare(b.variant),
    )[0];
    bestVariant = { variant: best.variant, averageScore: best.averageScore };
  }

  let evidence: EvidenceLevel;
  if (scoredRuns === 0) {
    evidence = "none";
  } else if (
    scoredRuns >= MIN_RELIABLE_SCORED_RUNS &&
    variantsWithScores >= MIN_VARIANTS_FOR_COMPARISON
  ) {
    evidence = "ok";
  } else {
    evidence = "limited";
  }

  return {
    totalRuns: runs.length,
    scoredRuns,
    unscoredRuns: runs.length - scoredRuns,
    matchedRuns,
    unmatchedRuns: runs.length - matchedRuns,
    averageScore: meanOrNull(overallPerRun),
    variants,
    bestVariant,
    evidence,
  };
}
