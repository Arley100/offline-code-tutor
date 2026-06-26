import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateDemoUser } from "@/lib/demo-user";
import { averageManualScore, RUBRIC_DIMENSIONS, type ManualScore } from "@/lib/domain";
import { buildComparison, type ComparisonRunInput } from "@/lib/comparison";

export const dynamic = "force-dynamic";

/** Render a numeric value, or "—" when unavailable. Never shows 0 for null. */
function fmt(value: number | null, suffix = ""): string {
  return value === null ? "—" : `${value}${suffix}`;
}

function modelNameFromRaw(raw: unknown): string | null {
  if (raw && typeof raw === "object" && "model" in raw) {
    const model = (raw as Record<string, unknown>).model;
    if (model && typeof model === "object" && "filename" in model) {
      const filename = (model as Record<string, unknown>).filename;
      if (typeof filename === "string" && filename.length > 0) return filename;
    }
  }
  return null;
}

function toManualScore(score: {
  correctness: number;
  clarity: number;
  beginnerFriendliness: number;
  minimalityOfFix: number;
  hallucinationRisk: number;
  offlineUsefulness: number;
}): ManualScore {
  return {
    correctness: score.correctness,
    clarity: score.clarity,
    beginnerFriendliness: score.beginnerFriendliness,
    minimalityOfFix: score.minimalityOfFix,
    hallucinationRisk: score.hallucinationRisk,
    offlineUsefulness: score.offlineUsefulness,
  };
}

async function loadProject(id: string) {
  try {
    const user = await getOrCreateDemoUser();
    const project = await prisma.project.findFirst({
      where: { id, ownerId: user.id },
      include: {
        artifacts: {
          orderBy: { createdAt: "desc" },
          include: {
            modelRuns: {
              include: {
                task: { select: { title: true } },
                scores: {
                  where: { raterId: user.id },
                  orderBy: { updatedAt: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    return { ok: true as const, project };
  } catch {
    return { ok: false as const, project: null };
  }
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadProject(id);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <Link href={`/projects/${id}`} className="text-sm hover:underline">
          ← Back to project
        </Link>
        <div className="rounded-lg border border-red-300 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          Could not load this project. Make sure PostgreSQL is running.
        </div>
      </div>
    );
  }

  if (!result.project) {
    notFound();
  }

  const project = result.project;

  // Flatten runs with the per-run context the UI and helper need.
  const flatRuns = project.artifacts.flatMap((artifact) =>
    artifact.modelRuns.map((run) => {
      const rawScore = run.scores[0] ?? null;
      const score = rawScore ? toManualScore(rawScore) : null;
      return {
        runId: run.id,
        promptId: run.promptId,
        variant: artifact.variant,
        modelName: modelNameFromRaw(artifact.rawJson) ?? artifact.modelSha256,
        ok: run.ok,
        matched: run.task !== null,
        taskTitle: run.task?.title ?? null,
        elapsedSeconds: run.elapsedSeconds,
        tokensPerSecond: run.tokensPerSecond,
        score,
        scoreAverage: score ? averageManualScore(score) : null,
      };
    }),
  );

  const comparisonInput: ComparisonRunInput[] = flatRuns.map((run) => ({
    variant: run.variant,
    matched: run.matched,
    ok: run.ok,
    elapsedSeconds: run.elapsedSeconds,
    tokensPerSecond: run.tokensPerSecond,
    score: run.score,
  }));
  const summary = buildComparison(comparisonInput);

  const cards = [
    { label: "Imported runs", value: String(summary.totalRuns) },
    { label: "Scored runs", value: String(summary.scoredRuns) },
    { label: "Unscored runs", value: String(summary.unscoredRuns) },
    {
      label: "Matched / unmatched",
      value: `${summary.matchedRuns} / ${summary.unmatchedRuns}`,
    },
    { label: "Average score", value: fmt(summary.averageScore, "/5") },
  ];

  const coveragePct =
    summary.totalRuns === 0
      ? 0
      : Math.round((summary.scoredRuns / summary.totalRuns) * 100);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link href={`/projects/${id}`} className="text-sm hover:underline">
          ← Back to project
        </Link>
        <h1 className="text-2xl font-bold">Comparison dashboard</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          {project.name}
        </p>
        <p className="text-xs text-neutral-500">
          Summarizes only stored evidence. Manual scores are human-assigned; this
          dashboard does not auto-score and does not claim statistical certainty.
          Missing metrics are shown as “—”, never as zero.
        </p>
      </div>

      {/* Insight callout */}
      <section
        className={
          summary.evidence === "ok"
            ? "rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200"
            : "rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        }
      >
        {summary.evidence === "none" ? (
          <>No manual scores yet. Score model runs to enable comparison.</>
        ) : summary.evidence === "limited" ? (
          <>
            Evidence is limited. Score more runs before treating this as a
            reliable comparison.
            {summary.bestVariant ? (
              <>
                {" "}
                So far, <strong>{summary.bestVariant.variant}</strong> has the
                highest average ({summary.bestVariant.averageScore}/5).
              </>
            ) : null}
          </>
        ) : (
          <>
            Based on manually scored runs,{" "}
            <strong>{summary.bestVariant?.variant}</strong> currently has the
            highest average score ({summary.bestVariant?.averageScore}/5). This
            is a small-sample summary, not statistical certainty.
          </>
        )}
      </section>

      {/* Summary cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              {card.label}
            </div>
            <div className="mt-1 text-2xl font-semibold">{card.value}</div>
          </div>
        ))}
      </section>

      {/* Score coverage bar */}
      <section className="space-y-1">
        <div className="flex justify-between text-xs text-neutral-500">
          <span>Manual scoring coverage</span>
          <span>
            {summary.scoredRuns}/{summary.totalRuns} runs ({coveragePct}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className="h-full bg-green-600 dark:bg-green-500"
            style={{ width: `${coveragePct}%` }}
          />
        </div>
      </section>

      {/* Variant comparison table */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">By prompt variant</h2>
        {summary.variants.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
            No imported runs yet. Import an artifact on the project page.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-neutral-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Variant</th>
                  <th className="py-2 pr-3 font-medium">Runs</th>
                  <th className="py-2 pr-3 font-medium">Scored</th>
                  <th className="py-2 pr-3 font-medium">Avg score</th>
                  {RUBRIC_DIMENSIONS.map((dim) => (
                    <th key={dim.field} className="py-2 pr-3 font-medium">
                      {dim.label}
                      {dim.field === "hallucinationRisk" ? (
                        <span className="block font-normal text-neutral-400">
                          5 = lowest risk
                        </span>
                      ) : null}
                    </th>
                  ))}
                  <th className="py-2 pr-3 font-medium">Avg elapsed (s)</th>
                  <th className="py-2 pr-3 font-medium">Avg tokens/s</th>
                </tr>
              </thead>
              <tbody>
                {summary.variants.map((variant) => {
                  const isBest =
                    summary.evidence !== "none" &&
                    summary.bestVariant?.variant === variant.variant;
                  return (
                    <tr
                      key={variant.variant}
                      className="border-t border-neutral-100 dark:border-neutral-800"
                    >
                      <td className="py-2 pr-3">
                        <span className="rounded bg-neutral-900 px-1.5 py-0.5 font-medium text-white dark:bg-white dark:text-neutral-900">
                          {variant.variant}
                        </span>
                        {isBest ? (
                          <span className="ml-1 text-green-700 dark:text-green-400">
                            ★
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">{variant.runCount}</td>
                      <td className="py-2 pr-3">{variant.scoredCount}</td>
                      <td className="py-2 pr-3 font-medium">
                        {fmt(variant.averageScore)}
                      </td>
                      {RUBRIC_DIMENSIONS.map((dim) => (
                        <td key={dim.field} className="py-2 pr-3">
                          {fmt(variant.rubricAverages[dim.field])}
                        </td>
                      ))}
                      <td className="py-2 pr-3">
                        {fmt(variant.averageElapsedSeconds)}
                      </td>
                      <td className="py-2 pr-3">
                        {fmt(variant.averageTokensPerSecond)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Run-level table */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Runs ({flatRuns.length})</h2>
        {flatRuns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
            No runs to show.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-neutral-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Prompt id</th>
                  <th className="py-2 pr-3 font-medium">Matched task</th>
                  <th className="py-2 pr-3 font-medium">Variant</th>
                  <th className="py-2 pr-3 font-medium">Model</th>
                  <th className="py-2 pr-3 font-medium">OK</th>
                  <th className="py-2 pr-3 font-medium">Elapsed (s)</th>
                  <th className="py-2 pr-3 font-medium">Tokens/s</th>
                  <th className="py-2 pr-3 font-medium">Score</th>
                  <th className="py-2 pr-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {flatRuns.map((run) => (
                  <tr
                    key={run.runId}
                    className="border-t border-neutral-100 dark:border-neutral-800"
                  >
                    <td className="py-2 pr-3 font-mono">{run.promptId}</td>
                    <td className="py-2 pr-3">
                      {run.taskTitle ?? (
                        <span className="text-amber-700 dark:text-amber-500">
                          unmatched
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">{run.variant}</td>
                    <td className="py-2 pr-3">
                      {run.modelName ? (
                        <span title={run.modelName}>
                          {run.modelName.length > 18
                            ? `${run.modelName.slice(0, 18)}…`
                            : run.modelName}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3">{run.ok ? "✓" : "✗"}</td>
                    <td className="py-2 pr-3">{fmt(run.elapsedSeconds)}</td>
                    <td className="py-2 pr-3">{fmt(run.tokensPerSecond)}</td>
                    <td className="py-2 pr-3">
                      {run.score ? (
                        <span className="text-green-700 dark:text-green-400">
                          {fmt(run.scoreAverage, "/5")}
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-500">
                          Unscored
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Link
                        href={`/projects/${id}/runs/${run.runId}/score`}
                        className="rounded-md border border-neutral-300 px-2 py-1 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                      >
                        {run.score ? "Edit score" : "Score"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
