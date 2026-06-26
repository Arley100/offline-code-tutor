import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateDemoUser } from "@/lib/demo-user";
import { averageManualScore, extractManualScore } from "@/lib/domain";
import { modelNameFromRawJson } from "@/lib/artifact";
import { buildComparison, type ComparisonRunInput } from "@/lib/comparison";
import {
  generateReportMarkdown,
  type ReportArtifactSummary,
  type ReportRun,
} from "@/lib/report";
import { slugify } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * GET /projects/[id]/report.md
 * Returns a Markdown comparison report for the project as an attachment.
 * Read-only: never mutates database rows or imported artifact JSON.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let project;
  try {
    const user = await getOrCreateDemoUser();
    project = await prisma.project.findFirst({
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
  } catch {
    return new NextResponse(
      "Could not generate report: the database is unavailable.",
      { status: 500 },
    );
  }

  if (!project) {
    return new NextResponse("Project not found.", { status: 404 });
  }

  const artifacts: ReportArtifactSummary[] = project.artifacts.map((artifact) => {
    const unmatched = artifact.modelRuns.filter((run) => run.task === null).length;
    return {
      variant: artifact.variant,
      runCount: artifact.modelRuns.length,
      matchedCount: artifact.modelRuns.length - unmatched,
      unmatchedCount: unmatched,
      benchmarkStatus: artifact.benchmarkStatus,
      modelSha256: artifact.modelSha256,
      importedAt: artifact.createdAt.toISOString().slice(0, 10),
    };
  });

  const flat = project.artifacts.flatMap((artifact) =>
    artifact.modelRuns.map((run) => {
      const rawScore = run.scores[0] ?? null;
      const score = rawScore ? extractManualScore(rawScore) : null;
      const cmp: ComparisonRunInput = {
        variant: artifact.variant,
        matched: run.task !== null,
        ok: run.ok,
        elapsedSeconds: run.elapsedSeconds,
        tokensPerSecond: run.tokensPerSecond,
        score,
      };
      const row: ReportRun = {
        promptId: run.promptId,
        taskTitle: run.task?.title ?? null,
        variant: artifact.variant,
        modelName: modelNameFromRawJson(artifact.rawJson) ?? artifact.modelSha256,
        ok: run.ok,
        elapsedSeconds: run.elapsedSeconds,
        tokensPerSecond: run.tokensPerSecond,
        scored: score !== null,
        scoreAverage: score ? averageManualScore(score) : null,
      };
      return { cmp, row };
    }),
  );

  const summary = buildComparison(flat.map((f) => f.cmp));
  const markdown = generateReportMarkdown({
    projectName: project.name,
    generatedAt: new Date(),
    summary,
    artifacts,
    runs: flat.map((f) => f.row),
  });

  const slug = slugify(project.name);
  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="evalforge-report-${slug}.md"`,
    },
  });
}
