import { describe, expect, it } from "vitest";
import { buildComparison, type ComparisonRunInput } from "./comparison";
import { type ManualScore } from "./domain";

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

function run(overrides: Partial<ComparisonRunInput> = {}): ComparisonRunInput {
  return {
    variant: "baseline",
    matched: true,
    ok: true,
    elapsedSeconds: null,
    tokensPerSecond: null,
    score: null,
    ...overrides,
  };
}

describe("buildComparison", () => {
  it("handles no runs without dividing by zero", () => {
    const summary = buildComparison([]);
    expect(summary.totalRuns).toBe(0);
    expect(summary.scoredRuns).toBe(0);
    expect(summary.averageScore).toBeNull();
    expect(summary.bestVariant).toBeNull();
    expect(summary.evidence).toBe("none");
    expect(summary.variants).toEqual([]);
  });

  it("handles runs with no manual scores", () => {
    const summary = buildComparison([run(), run({ variant: "prompt_v2" })]);
    expect(summary.totalRuns).toBe(2);
    expect(summary.scoredRuns).toBe(0);
    expect(summary.unscoredRuns).toBe(2);
    expect(summary.averageScore).toBeNull();
    expect(summary.bestVariant).toBeNull();
    expect(summary.evidence).toBe("none");
  });

  it("treats one scored run as limited evidence but still picks a best", () => {
    const summary = buildComparison([
      run({ variant: "baseline", score: score({ correctness: 5 }) }),
      run({ variant: "baseline" }),
    ]);
    expect(summary.scoredRuns).toBe(1);
    expect(summary.evidence).toBe("limited");
    expect(summary.bestVariant?.variant).toBe("baseline");
  });

  it("does not declare a best variant when no scored runs exist", () => {
    const summary = buildComparison([run(), run({ variant: "prompt_v3" })]);
    expect(summary.bestVariant).toBeNull();
  });

  it("selects best variant by manual score and reports ok evidence", () => {
    // 2 variants, each with 2 scored runs => 4 scored, 2 variants => "ok".
    const summary = buildComparison([
      run({ variant: "baseline", score: score({ correctness: 2 }) }),
      run({ variant: "baseline", score: score({ correctness: 2 }) }),
      run({ variant: "prompt_v3", score: score({ correctness: 5 }) }),
      run({ variant: "prompt_v3", score: score({ correctness: 5 }) }),
    ]);
    expect(summary.evidence).toBe("ok");
    expect(summary.bestVariant?.variant).toBe("prompt_v3");
    const v3 = summary.variants.find((v) => v.variant === "prompt_v3")!;
    expect(v3.scoredCount).toBe(2);
    expect(v3.rubricAverages.correctness).toBe(5);
  });

  it("ignores missing elapsed_seconds instead of counting them as zero", () => {
    const summary = buildComparison([
      run({ variant: "baseline", elapsedSeconds: 10 }),
      run({ variant: "baseline", elapsedSeconds: null }),
    ]);
    const baseline = summary.variants[0];
    // Average of [10], not [10, 0].
    expect(baseline.averageElapsedSeconds).toBe(10);
  });

  it("ignores missing tokens_per_second instead of counting them as zero", () => {
    const summary = buildComparison([
      run({ variant: "baseline", tokensPerSecond: 20 }),
      run({ variant: "baseline", tokensPerSecond: null }),
    ]);
    expect(summary.variants[0].averageTokensPerSecond).toBe(20);
  });

  it("counts matched and unmatched runs correctly", () => {
    const summary = buildComparison([
      run({ matched: true }),
      run({ matched: false }),
      run({ matched: false }),
    ]);
    expect(summary.matchedRuns).toBe(1);
    expect(summary.unmatchedRuns).toBe(2);
  });

  it("keeps hallucinationRisk on its reversed scale (averaged, not inverted)", () => {
    const summary = buildComparison([
      run({ variant: "baseline", score: score({ hallucinationRisk: 5 }) }),
      run({ variant: "baseline", score: score({ hallucinationRisk: 1 }) }),
    ]);
    expect(summary.variants[0].rubricAverages.hallucinationRisk).toBe(3);
  });

  it("flags limited evidence when only one variant has scores", () => {
    // 4 scored runs but a single variant => cannot compare variants => limited.
    const summary = buildComparison([
      run({ variant: "baseline", score: score() }),
      run({ variant: "baseline", score: score() }),
      run({ variant: "baseline", score: score() }),
      run({ variant: "baseline", score: score() }),
    ]);
    expect(summary.scoredRuns).toBe(4);
    expect(summary.evidence).toBe("limited");
  });
});
