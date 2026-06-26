import { describe, expect, it } from "vitest";
import {
  aggregateManualScores,
  averageManualScore,
  projectSummary,
  RUBRIC_DIMENSIONS,
  roundTo2,
  validateManualScoreInput,
  type ManualScore,
} from "./domain";

function score(overrides: Partial<ManualScore> = {}): ManualScore {
  return {
    correctness: 3,
    clarity: 3,
    beginnerFriendliness: 3,
    minimalityOfFix: 3,
    hallucinationRisk: 3,
    offlineUsefulness: 3,
    ...overrides,
  };
}

describe("roundTo2", () => {
  it("rounds to two decimals", () => {
    expect(roundTo2(1 / 3)).toBe(0.33);
    expect(roundTo2(3.14159)).toBe(3.14);
    expect(roundTo2(4)).toBe(4);
  });
});

describe("aggregateManualScores", () => {
  it("returns null averages and zero count when there are no scores", () => {
    const { count, averages } = aggregateManualScores([]);
    expect(count).toBe(0);
    // Unavailable must be null, never 0.
    expect(averages.correctness).toBeNull();
    expect(averages.hallucinationRisk).toBeNull();
  });

  it("averages each dimension across scored runs", () => {
    const { count, averages } = aggregateManualScores([
      score({ correctness: 2, hallucinationRisk: 2 }),
      score({ correctness: 5, hallucinationRisk: 4 }),
    ]);
    expect(count).toBe(2);
    expect(averages.correctness).toBe(3.5);
    // hallucinationRisk is already on a 5=good scale; averaged, not inverted.
    expect(averages.hallucinationRisk).toBe(3);
    expect(averages.clarity).toBe(3);
  });
});

describe("validateManualScoreInput", () => {
  const validInput = {
    correctness: "5",
    clarity: "4",
    beginnerFriendliness: "4",
    minimalityOfFix: "5",
    hallucinationRisk: "5",
    offlineUsefulness: "4",
    notes: "Correct and easy to use.",
  };

  it("accepts a valid complete manual score", () => {
    const result = validateManualScoreInput(validInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.correctness).toBe(5);
    expect(result.data.notes).toBe("Correct and easy to use.");
  });

  it("rejects a score below 1", () => {
    const result = validateManualScoreInput({ ...validInput, correctness: "0" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.correctness).toMatch(/between 1 and 5/i);
  });

  it("rejects a score above 5", () => {
    const result = validateManualScoreInput({ ...validInput, clarity: "6" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.clarity).toMatch(/between 1 and 5/i);
  });

  it("rejects a non-integer score", () => {
    const result = validateManualScoreInput({
      ...validInput,
      beginnerFriendliness: "3.5",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.beginnerFriendliness).toMatch(/whole-number/i);
  });

  it("rejects a missing score", () => {
    const result = validateManualScoreInput({
      ...validInput,
      offlineUsefulness: "",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.offlineUsefulness).toMatch(/whole-number/i);
  });
});

describe("averageManualScore", () => {
  it("does not treat unavailable dimensions as zero", () => {
    expect(averageManualScore({ correctness: 5 })).toBe(5);
    expect(averageManualScore({})).toBeNull();
  });
});

describe("rubric metadata", () => {
  it("documents hallucination risk as a reversed good-is-high scale", () => {
    const hallucinationRisk = RUBRIC_DIMENSIONS.find(
      (dimension) => dimension.field === "hallucinationRisk",
    );
    expect(hallucinationRisk?.helper).toMatch(/5 means lowest risk/i);
  });
});

describe("projectSummary", () => {
  it("reports scoredFraction as null when there are no runs", () => {
    const summary = projectSummary({
      name: "Empty",
      taskCount: 2,
      artifactCount: 0,
      runCount: 0,
      scoredRunCount: 0,
    });
    expect(summary.scoredFraction).toBeNull();
  });

  it("computes scored fraction when runs exist", () => {
    const summary = projectSummary({
      name: "Partial",
      taskCount: 2,
      artifactCount: 1,
      runCount: 4,
      scoredRunCount: 1,
    });
    expect(summary.scoredFraction).toBe(0.25);
  });
});
