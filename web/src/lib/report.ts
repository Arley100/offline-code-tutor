/**
 * Pure Markdown report generation for a project's comparison evidence.
 *
 * Framework- and database-free: it accepts already-fetched data and returns a
 * Markdown string. It summarizes only stored evidence:
 *   - Missing metrics/scores render as "—", never as 0.
 *   - No winner is stated unless the comparison helper provides one.
 *   - Limited evidence is labeled; no statistical certainty is claimed.
 *   - hallucinationRisk stays reversed (5 = lowest risk).
 */
import { RUBRIC_DIMENSIONS } from "./domain";
import { type ComparisonSummary } from "./comparison";

export interface ReportArtifactSummary {
  variant: string;
  runCount: number;
  matchedCount: number;
  unmatchedCount: number;
  benchmarkStatus: string | null;
  modelSha256: string | null;
  importedAt: string; // YYYY-MM-DD
}

export interface ReportRun {
  promptId: string;
  taskTitle: string | null; // null => unmatched
  variant: string;
  modelName: string | null;
  ok: boolean;
  elapsedSeconds: number | null;
  tokensPerSecond: number | null;
  scored: boolean;
  scoreAverage: number | null;
}

export interface ReportInput {
  projectName: string;
  generatedAt: Date;
  summary: ComparisonSummary;
  artifacts: ReportArtifactSummary[];
  runs: ReportRun[];
}

/** Numeric value or "—". Never renders null/NaN/undefined as a number or 0. */
function dash(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "—";
}

/** Escape a string for a Markdown table cell. Empty/nullish becomes "—". */
function cell(value: string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const escaped = value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
  return escaped.length > 0 ? escaped : "—";
}

function evidenceSentence(summary: ComparisonSummary): string {
  if (summary.evidence === "none" || summary.bestVariant === null) {
    return "No manual scores have been recorded yet, so no variant comparison can be drawn. Score model runs to enable a comparison.";
  }
  if (summary.evidence === "limited") {
    return `Evidence is limited. So far, **${summary.bestVariant.variant}** has the highest average score (${summary.bestVariant.averageScore}/5), but score more runs across multiple variants before treating this as a reliable comparison.`;
  }
  return `Based on manually scored runs, **${summary.bestVariant.variant}** currently has the highest average score (${summary.bestVariant.averageScore}/5). This is a small-sample summary, not statistical certainty.`;
}

export function generateReportMarkdown(input: ReportInput): string {
  const { projectName, generatedAt, summary, artifacts, runs } = input;
  const lines: string[] = [];

  // Title + provenance
  lines.push(`# EvalForge comparison report — ${projectName}`);
  lines.push("");
  lines.push(`_Generated ${generatedAt.toISOString()}_`);
  lines.push("");
  lines.push(
    "> This report summarizes only stored evidence in EvalForge. Manual scores " +
      "are human-assigned; nothing here is AI-generated or auto-scored. Imported " +
      "artifacts are never modified. Missing or unavailable values are shown as " +
      '"—", never as zero. Comparisons use only the runs that have been scored.',
  );
  lines.push("");

  // Evidence status
  lines.push("## Evidence status");
  lines.push("");
  lines.push(`- Evidence level: **${summary.evidence}**`);
  lines.push(evidenceSentence(summary));
  lines.push("");

  // Overall summary
  lines.push("## Overall summary");
  lines.push("");
  lines.push(`- Total imported runs: ${summary.totalRuns}`);
  lines.push(`- Scored runs: ${summary.scoredRuns}`);
  lines.push(`- Unscored runs: ${summary.unscoredRuns}`);
  lines.push(`- Matched runs: ${summary.matchedRuns}`);
  lines.push(`- Unmatched runs: ${summary.unmatchedRuns}`);
  lines.push(`- Average manual score: ${dash(summary.averageScore)}${summary.averageScore === null ? "" : "/5"}`);
  lines.push(
    `- Best variant: ${
      summary.bestVariant === null
        ? "not determined (no scored runs)"
        : `${summary.bestVariant.variant} (${summary.bestVariant.averageScore}/5)`
    }`,
  );
  lines.push("");

  // Imported artifacts
  lines.push("## Imported artifacts");
  lines.push("");
  if (artifacts.length === 0) {
    lines.push("No artifacts have been imported into this project yet.");
  } else {
    lines.push("| Variant | Runs | Matched | Unmatched | Status | Model (sha256) | Imported |");
    lines.push("|---|---:|---:|---:|---|---|---|");
    for (const a of artifacts) {
      lines.push(
        `| ${cell(a.variant)} | ${a.runCount} | ${a.matchedCount} | ${a.unmatchedCount} | ${cell(a.benchmarkStatus)} | ${a.modelSha256 ? cell(a.modelSha256.slice(0, 12) + "…") : "—"} | ${cell(a.importedAt)} |`,
      );
    }
  }
  lines.push("");

  // Variant comparison
  lines.push("## Variant comparison");
  lines.push("");
  lines.push(
    "Hallucination risk uses a reversed scale: **5 = lowest risk**, 1 = highest risk.",
  );
  lines.push("");
  if (summary.variants.length === 0) {
    lines.push("No runs to compare yet.");
  } else {
    const dimHeaders = RUBRIC_DIMENSIONS.map((d) => d.label).join(" | ");
    lines.push(
      `| Variant | Runs | Scored | Avg score | ${dimHeaders} | Avg elapsed (s) | Avg tokens/s |`,
    );
    const dimDivider = RUBRIC_DIMENSIONS.map(() => "---:").join(" | ");
    lines.push(`|---|---:|---:|---:|${dimDivider}|---:|---:|`);
    for (const v of summary.variants) {
      const dims = RUBRIC_DIMENSIONS.map((d) => dash(v.rubricAverages[d.field])).join(" | ");
      lines.push(
        `| ${cell(v.variant)} | ${v.runCount} | ${v.scoredCount} | ${dash(v.averageScore)} | ${dims} | ${dash(v.averageElapsedSeconds)} | ${dash(v.averageTokensPerSecond)} |`,
      );
    }
  }
  lines.push("");

  // Run-level evidence
  lines.push("## Run-level evidence");
  lines.push("");
  if (runs.length === 0) {
    lines.push("No runs to show.");
  } else {
    lines.push(
      "| Prompt id | Matched task | Variant | Model | OK | Elapsed (s) | Tokens/s | Score (/5) |",
    );
    lines.push("|---|---|---|---|:--:|---:|---:|---:|");
    for (const r of runs) {
      lines.push(
        `| ${cell(r.promptId)} | ${r.taskTitle === null ? "unmatched" : cell(r.taskTitle)} | ${cell(r.variant)} | ${cell(r.modelName)} | ${r.ok ? "✓" : "✗"} | ${dash(r.elapsedSeconds)} | ${dash(r.tokensPerSecond)} | ${r.scored ? dash(r.scoreAverage) : "—"} |`,
      );
    }
  }
  lines.push("");

  // Scoring rubric summary
  lines.push("## Scoring rubric");
  lines.push("");
  lines.push("Each scored run is rated 1–5 on six human-assigned dimensions:");
  lines.push("");
  for (const d of RUBRIC_DIMENSIONS) {
    lines.push(`- **${d.label}** — ${d.helper}`);
  }
  lines.push("");

  // Missing data notes
  lines.push("## Missing data");
  lines.push("");
  lines.push(
    '- A "—" means the value is unavailable, not zero. Unavailable metrics (e.g. elapsed seconds, tokens/sec) and unscored runs are excluded from averages rather than counted as 0.',
  );
  lines.push(
    "- Unmatched runs are imported runs whose `prompt_id` does not match any benchmark task key in this project.",
  );
  lines.push("");

  // Limitations
  lines.push("## Limitations");
  lines.push("");
  lines.push("- Manual scoring is subjective, even with a fixed rubric.");
  lines.push("- Samples are typically small; treat differences cautiously.");
  lines.push("- This report makes no statistical-significance claims.");
  lines.push("- Suggested fixes are not executed or verified by EvalForge.");
  lines.push("- Results apply only to the imported runs, model, and settings shown.");
  lines.push("");

  // Next steps
  lines.push("## Next recommended evaluation steps");
  lines.push("");
  if (summary.scoredRuns === 0) {
    lines.push("- Score model runs to enable a variant comparison.");
  } else if (summary.evidence === "limited") {
    lines.push("- Score more runs, and ensure at least two variants have scored runs.");
  }
  lines.push("- Add more benchmark tasks and import more runs to increase coverage.");
  lines.push("- Repeat runs per task to gauge variability.");
  lines.push("- Separate prompt-wording effects from output-length effects when comparing variants.");
  lines.push("");

  return lines.join("\n");
}
