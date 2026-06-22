import { describe, expect, it } from "vitest";
import {
  aggregateManualScores,
  projectSummary,
  roundTo2,
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
