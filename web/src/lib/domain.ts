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

export type PartialManualScore = Partial<Record<RubricField, number>>;

export type RubricAverages = Record<RubricField, number | null>;

export const RUBRIC_DIMENSIONS: ReadonlyArray<{
  field: RubricField;
  label: string;
  helper: string;
}> = [
  {
    field: "correctness",
    label: "Correctness",
    helper: "Identifies the actual defect and proposes a fix that works.",
  },
  {
    field: "clarity",
    label: "Clarity",
    helper: "Clear, organized, and unambiguous for someone who knows the language.",
  },
  {
    field: "beginnerFriendliness",
    label: "Beginner friendliness",
    helper: "Explains the issue in a way a learner could act on offline.",
  },
  {
    field: "minimalityOfFix",
    label: "Minimality of fix",
    helper: "Keeps the fix focused on the smallest correct change.",
  },
  {
    field: "hallucinationRisk",
    label: "Hallucination risk",
    helper: "Reversed scale: 5 means lowest risk and 1 means highest risk.",
  },
  {
    field: "offlineUsefulness",
    label: "Offline usefulness",
    helper: "Useful as standalone debugging help without extra resources.",
  },
];

export type ManualScoreValidationData = ManualScore & { notes: string | null };

export type ManualScoreValidationResult =
  | { ok: true; data: ManualScoreValidationData }
  | { ok: false; fieldErrors: Record<string, string> };

/** Round to two decimals, matching the CLI report convention. */
export function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseRubricScore(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  const parsed = Number(text);
  return Number.isInteger(parsed) ? parsed : null;
}

/**
 * Validate manual rubric input. Every dimension is required and must be a whole
 * number from 1 to 5. Missing or invalid values are errors, never zeros.
 */
export function validateManualScoreInput(
  input: Record<string, unknown>,
): ManualScoreValidationResult {
  const fieldErrors: Record<string, string> = {};
  const data: Partial<ManualScore> = {};

  for (const field of RUBRIC_FIELDS) {
    const value = parseRubricScore(input[field]);
    if (value === null) {
      fieldErrors[field] = "Choose a whole-number score from 1 to 5.";
      continue;
    }
    if (value < 1 || value > 5) {
      fieldErrors[field] = "Score must be between 1 and 5.";
      continue;
    }
    data[field] = value;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  const notes =
    typeof input.notes === "string" && input.notes.trim().length > 0
      ? input.notes.trim()
      : null;

  return {
    ok: true,
    data: {
      correctness: data.correctness!,
      clarity: data.clarity!,
      beginnerFriendliness: data.beginnerFriendliness!,
      minimalityOfFix: data.minimalityOfFix!,
      hallucinationRisk: data.hallucinationRisk!,
      offlineUsefulness: data.offlineUsefulness!,
      notes,
    },
  };
}

/**
 * Average the score dimensions that are actually present. Missing dimensions
 * stay unavailable and are not counted as zero.
 */
export function averageManualScore(score: PartialManualScore): number | null {
  const values = RUBRIC_FIELDS.map((field) => score[field]).filter(
    (value): value is number => typeof value === "number",
  );
  if (values.length === 0) {
    return null;
  }
  return roundTo2(values.reduce((sum, value) => sum + value, 0) / values.length);
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
