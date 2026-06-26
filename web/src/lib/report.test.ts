import { describe, expect, it } from "vitest";
import { buildComparison, type ComparisonRunInput } from "./comparison";
import { type ManualScore } from "./domain";
import {
  generateReportMarkdown,
  type ReportInput,
  type ReportRun,
} from "./report";

const GENERATED_AT = new Date("2026-06-26T12:00:00.000Z");

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

function cmpRun(overrides: Partial<ComparisonRunInput> = {}): ComparisonRunInput {
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

function reportRun(overrides: Partial<ReportRun> = {}): ReportRun {
  return {
    promptId: "python-factorial-debug",
    taskTitle: "Python factorial",
    variant: "baseline",
    modelName: "Synthetic-Demo-Model.gguf",
    ok: true,
    elapsedSeconds: null,
    tokensPerSecond: null,
    scored: false,
    scoreAverage: null,
    ...overrides,
  };
}

function makeInput(
  cmpRuns: ComparisonRunInput[],
  runs: ReportRun[],
  artifacts: ReportInput["artifacts"] = [],
): ReportInput {
  return {
    projectName: "Demo project",
    generatedAt: GENERATED_AT,
    summary: buildComparison(cmpRuns),
    artifacts,
    runs,
  };
}

function noBadTokens(md: string) {
  expect(md).not.toMatch(/NaN/);
  expect(md).not.toMatch(/undefined/);
  expect(md).not.toMatch(/null/);
}

describe("generateReportMarkdown", () => {
  it("handles a project with no runs", () => {
    const md = generateReportMarkdown(makeInput([], []));
    expect(md).toContain("# EvalForge comparison report — Demo project");
    expect(md).toContain("Total imported runs: 0");
    expect(md).toContain("not determined (no scored runs)");
    expect(md).toContain("No runs to show.");
    noBadTokens(md);
  });

  it("reports unscored runs without inventing scores", () => {
    const md = generateReportMarkdown(
      makeInput([cmpRun()], [reportRun({ scored: false, scoreAverage: null })]),
    );
    expect(md).toContain("Scored runs: 0");
    expect(md).toContain("Average manual score: —");
    // Run row score column is "—" for unscored.
    expect(md).toMatch(/python-factorial-debug.*—\s*\|/);
    noBadTokens(md);
  });

  it("labels limited evidence and still names a tentative best", () => {
    const md = generateReportMarkdown(
      makeInput(
        [cmpRun({ score: score({ correctness: 5 }) })],
        [reportRun({ scored: true, scoreAverage: 3.33 })],
      ),
    );
    expect(md).toContain("Evidence level: **limited**");
    expect(md).toContain("Evidence is limited");
    expect(md).toContain("baseline");
    noBadTokens(md);
  });

  it("includes a best variant only when comparison provides one", () => {
    const none = generateReportMarkdown(makeInput([cmpRun()], [reportRun()]));
    expect(none).toContain("not determined (no scored runs)");

    const ok = generateReportMarkdown(
      makeInput(
        [
          cmpRun({ variant: "baseline", score: score({ correctness: 2 }) }),
          cmpRun({ variant: "baseline", score: score({ correctness: 2 }) }),
          cmpRun({ variant: "prompt_v3", score: score({ correctness: 5 }) }),
          cmpRun({ variant: "prompt_v3", score: score({ correctness: 5 }) }),
        ],
        [reportRun()],
      ),
    );
    expect(ok).toContain("Evidence level: **ok**");
    expect(ok).toContain("**prompt_v3** currently has the highest average score");
  });

  it("renders missing metrics and missing scores as —, never zero", () => {
    const md = generateReportMarkdown(
      makeInput(
        [cmpRun({ elapsedSeconds: null, tokensPerSecond: null })],
        [
          reportRun({
            elapsedSeconds: null,
            tokensPerSecond: null,
            scored: false,
            scoreAverage: null,
          }),
        ],
      ),
    );
    // The run row's metric + score cells must be "—" (not a fabricated 0).
    // Row shape: ... | OK | elapsed | tokens/s | score |
    expect(md).toMatch(/✓ \| — \| — \| — \|/);
    noBadTokens(md);
  });

  it("includes the reversed hallucination-risk note", () => {
    const md = generateReportMarkdown(makeInput([cmpRun()], [reportRun()]));
    expect(md).toContain("5 = lowest risk");
  });

  it("escapes pipe characters in table cells", () => {
    const md = generateReportMarkdown(
      makeInput(
        [cmpRun()],
        [reportRun({ taskTitle: "weird | title", modelName: "a|b.gguf" })],
      ),
    );
    expect(md).toContain("weird \\| title");
    expect(md).toContain("a\\|b.gguf");
  });

  it("never emits NaN/undefined even with mixed availability", () => {
    const md = generateReportMarkdown(
      makeInput(
        [
          cmpRun({ variant: "baseline", elapsedSeconds: 5, score: score() }),
          cmpRun({ variant: "prompt_v2", tokensPerSecond: 20, score: null }),
        ],
        [
          reportRun({ variant: "baseline", elapsedSeconds: 5, scored: true, scoreAverage: 3 }),
          reportRun({
            variant: "prompt_v2",
            promptId: "cpp-vector-bounds-debug",
            taskTitle: null,
            tokensPerSecond: 20,
          }),
        ],
        [
          {
            variant: "baseline",
            runCount: 1,
            matchedCount: 1,
            unmatchedCount: 0,
            benchmarkStatus: "completed",
            modelSha256: "abc123def456abc123",
            importedAt: "2026-06-20",
          },
        ],
      ),
    );
    noBadTokens(md);
    expect(md).toContain("unmatched");
  });
});
