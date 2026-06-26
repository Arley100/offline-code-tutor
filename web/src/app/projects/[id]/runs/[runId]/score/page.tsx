import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreForm } from "@/components/ScoreForm";
import { averageManualScore } from "@/lib/domain";
import { getOrCreateDemoUser } from "@/lib/demo-user";
import { prisma } from "@/lib/prisma";
import { saveManualScore } from "../../../../actions";

export const dynamic = "force-dynamic";

function metric(value: number | null, suffix = ""): string {
  // Unavailable metrics render as "—", never as 0.
  return value === null ? "—" : `${value}${suffix}`;
}

function modelFilename(rawJson: unknown): string | null {
  if (typeof rawJson !== "object" || rawJson === null || Array.isArray(rawJson)) {
    return null;
  }
  const model = (rawJson as { model?: unknown }).model;
  if (typeof model !== "object" || model === null || Array.isArray(model)) {
    return null;
  }
  const filename = (model as { filename?: unknown }).filename;
  return typeof filename === "string" && filename.trim() ? filename : null;
}

async function loadRun(projectId: string, runId: string) {
  try {
    const user = await getOrCreateDemoUser();
    const run = await prisma.modelRun.findFirst({
      where: {
        id: runId,
        artifact: { projectId, project: { ownerId: user.id } },
      },
      include: {
        task: true,
        artifact: {
          select: {
            variant: true,
            modelSha256: true,
            benchmarkStatus: true,
            rawJson: true,
            project: { select: { id: true, name: true } },
          },
        },
        scores: {
          where: { raterId: user.id },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });
    return { ok: true as const, run };
  } catch {
    return { ok: false as const, run: null };
  }
}

export default async function ScoreRunPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id, runId } = await params;
  const result = await loadRun(id, runId);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <Link href={`/projects/${id}`} className="text-sm hover:underline">
          ← Back to project
        </Link>
        <div className="rounded-lg border border-red-300 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          Could not load this model run. Make sure PostgreSQL is running and the
          schema is applied (<code>npm run db:push</code>).
        </div>
      </div>
    );
  }

  if (!result.run) {
    notFound();
  }

  const run = result.run;
  const score = run.scores[0] ?? null;
  const scoreValues = score
    ? {
        correctness: score.correctness,
        clarity: score.clarity,
        beginnerFriendliness: score.beginnerFriendliness,
        minimalityOfFix: score.minimalityOfFix,
        hallucinationRisk: score.hallucinationRisk,
        offlineUsefulness: score.offlineUsefulness,
        notes: score.notes,
      }
    : null;
  const scoreAverage = scoreValues ? averageManualScore(scoreValues) : null;
  const filename = modelFilename(run.artifact.rawJson);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link href={`/projects/${id}`} className="text-sm hover:underline">
          ← Back to {run.artifact.project.name}
        </Link>
        <h1 className="text-2xl font-bold">Score model run</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Manual scores are human-assigned evaluation data. This form does not
          auto-score with AI and does not mutate the imported artifact JSON.
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-4 text-lg font-semibold">Evidence to review</h2>
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Prompt id
            </div>
            <div className="font-mono">{run.promptId}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Matched task
            </div>
            <div>{run.task?.title ?? "Unmatched"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Variant
            </div>
            <div>{run.artifact.variant}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Model
            </div>
            <div>{filename ?? run.artifact.modelSha256 ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Run status
            </div>
            <div>{run.ok ? "OK" : "Failed"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Artifact status
            </div>
            <div>{run.artifact.benchmarkStatus ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Elapsed seconds
            </div>
            <div>{metric(run.elapsedSeconds)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Tokens per second
            </div>
            <div>{metric(run.tokensPerSecond)}</div>
          </div>
        </div>

        {run.task ? (
          <div className="mt-5 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Task prompt</h3>
              <p className="mt-1 whitespace-pre-wrap rounded-md bg-neutral-50 p-3 text-sm text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                {run.task.prompt}
              </p>
            </div>
            {run.task.expectedFixHint ? (
              <div>
                <h3 className="text-sm font-semibold">Expected fix hint</h3>
                <p className="mt-1 rounded-md bg-neutral-50 p-3 text-sm text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                  {run.task.expectedFixHint}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            This run is not matched to a project task. You can still score it,
            but the expected-fix hint is unavailable.
          </p>
        )}

        <div className="mt-5">
          <h3 className="text-sm font-semibold">Model output preview</h3>
          <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-950 p-3 text-xs text-neutral-100">
            {run.cleanOutputPreview ?? "—"}
          </pre>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Manual rubric score</h2>
            <p className="text-xs text-neutral-500">
              Six required 1–5 scores. Hallucination risk is reversed: 5 means
              lowest risk.
            </p>
          </div>
          {score ? (
            <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-300">
              Scored
              {scoreAverage === null ? "" : ` · average ${scoreAverage}/5`}
            </div>
          ) : (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Unscored
            </div>
          )}
        </div>

        <ScoreForm
          action={saveManualScore}
          projectId={id}
          runId={run.id}
          initial={scoreValues}
        />
      </section>
    </div>
  );
}
