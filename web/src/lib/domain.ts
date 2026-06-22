/**
 * Pure domain helpers for EvalForge / TutorBench Local.
 *
 * These functions are framework- and database-free so they can be unit tested
 * in isolation. They encode two project invariants:
 *   1. The rubric has six 1-5 dimensions; `hallucinationRisk` is already on a
 *      "5 = good (lowest risk)" scale, so it is averaged alongside the others.
 *   2. Unavailable data is NEVER treated as zero. Absence yields `null`.
 */

export const RUBRIC_FIELDS = [
  "correctness",
  "clarity",
  "beginnerFriendliness",
  "minimalityOfFix",
  "hallucinationRisk",
  "offlineUsefulness",
] as const;

export type RubricField = (typeof RUBRIC_FIELDS)[number];

export type ManualScore = Record<RubricField, number>;

export type RubricAverages = Record<RubricField, number | null>;

/** Round to two decimals, matching the CLI report convention. */
export function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Average each rubric dimension across the provided scores.
 *
 * Returns `null` for a dimension when there are no scores to average — never 0.
 * `count` is the number of scored runs that contributed.
 */
export function aggregateManualScores(scores: ManualScore[]): {
  count: number;
  averages: RubricAverages;
} {
  const averages = Object.fromEntries(
    RUBRIC_FIELDS.map((field) => [field, null]),
  ) as RubricAverages;

  if (scores.length === 0) {
    return { count: 0, averages };
  }

  for (const field of RUBRIC_FIELDS) {
    const values = scores
      .map((score) => score[field])
      .filter((value): value is number => typeof value === "number");
    averages[field] =
      values.length === 0
        ? null
        : roundTo2(values.reduce((sum, v) => sum + v, 0) / values.length);
  }

  return { count: scores.length, averages };
}

export interface ProjectSummaryInput {
  name: string;
  taskCount: number;
  artifactCount: number;
  /** Total model runs across all artifacts. */
  runCount: number;
  /** Model runs that have a complete manual score. */
  scoredRunCount: number;
}

export interface ProjectSummary {
  name: string;
  taskCount: number;
  artifactCount: number;
  runCount: number;
  scoredRunCount: number;
  /** Fraction of runs scored, 0-1, or null when there are no runs. */
  scoredFraction: number | null;
}

/**
 * Build a small, display-ready summary for a project. `scoredFraction` is
 * `null` (not 0) when there are no runs, so the UI can show "no runs yet"
 * rather than implying 0% coverage of nothing.
 */
export function projectSummary(input: ProjectSummaryInput): ProjectSummary {
  const { runCount, scoredRunCount } = input;
  return {
    ...input,
    scoredFraction: runCount === 0 ? null : roundTo2(scoredRunCount / runCount),
  };
}
