"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrCreateDemoUser } from "@/lib/demo-user";
import { type FormState } from "@/lib/form";
import { parseArtifact } from "@/lib/artifact";
import {
  slugify,
  validateProjectInput,
  validateTaskInput,
} from "@/lib/validation";
import { validateManualScoreInput } from "@/lib/domain";

const DB_ERROR =
  "Could not reach the database. Make sure PostgreSQL is running and DATABASE_URL is set (see web/README.md).";

function isRedirectError(error: unknown): boolean {
  // next/navigation redirect() throws a control-flow error we must re-throw.
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

async function ownedProjectId(
  projectId: string,
  ownerId: string,
): Promise<string | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId },
    select: { id: true },
  });
  return project?.id ?? null;
}

async function uniqueTaskKey(projectId: string, title: string): Promise<string> {
  const base = slugify(title);
  let key = base;
  let suffix = 2;
  // Honor the @@unique([projectId, taskKey]) constraint.
  while (
    await prisma.benchmarkTask.findFirst({
      where: { projectId, taskKey: key },
      select: { id: true },
    })
  ) {
    key = `${base}-${suffix}`;
    suffix += 1;
  }
  return key;
}

export async function createProject(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = validateProjectInput({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!result.ok) {
    return { ok: false, fieldErrors: result.fieldErrors };
  }

  let projectId: string;
  try {
    const user = await getOrCreateDemoUser();
    const project = await prisma.project.create({
      data: { ...result.data, ownerId: user.id },
      select: { id: true },
    });
    projectId = project.id;
  } catch {
    return { ok: false, error: DB_ERROR };
  }

  revalidatePath("/projects");
  redirect(`/projects/${projectId}`);
}

export async function updateProject(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const result = validateProjectInput({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!result.ok) {
    return { ok: false, fieldErrors: result.fieldErrors };
  }

  try {
    const user = await getOrCreateDemoUser();
    if (!(await ownedProjectId(id, user.id))) {
      return { ok: false, error: "Project not found." };
    }
    await prisma.project.update({ where: { id }, data: result.data });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { ok: false, error: DB_ERROR };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { ok: true, message: "Project saved." };
}

export async function deleteProject(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const user = await getOrCreateDemoUser();
  if (await ownedProjectId(id, user.id)) {
    await prisma.project.delete({ where: { id } }); // cascades to tasks/artifacts
  }
  revalidatePath("/projects");
  redirect("/projects");
}

export async function createTask(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const result = validateTaskInput({
    title: formData.get("title"),
    prompt: formData.get("prompt"),
    language: formData.get("language"),
    difficulty: formData.get("difficulty"),
    category: formData.get("category"),
    expectedFixHint: formData.get("expectedFixHint"),
    notes: formData.get("notes"),
  });
  if (!result.ok) {
    return { ok: false, fieldErrors: result.fieldErrors };
  }

  try {
    const user = await getOrCreateDemoUser();
    if (!(await ownedProjectId(projectId, user.id))) {
      return { ok: false, error: "Project not found." };
    }
    const taskKey = await uniqueTaskKey(projectId, result.data.title);
    await prisma.benchmarkTask.create({
      data: { ...result.data, taskKey, projectId },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { ok: false, error: DB_ERROR };
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function updateTask(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const result = validateTaskInput({
    title: formData.get("title"),
    prompt: formData.get("prompt"),
    language: formData.get("language"),
    difficulty: formData.get("difficulty"),
    category: formData.get("category"),
    expectedFixHint: formData.get("expectedFixHint"),
    notes: formData.get("notes"),
  });
  if (!result.ok) {
    return { ok: false, fieldErrors: result.fieldErrors };
  }

  try {
    const user = await getOrCreateDemoUser();
    if (!(await ownedProjectId(projectId, user.id))) {
      return { ok: false, error: "Project not found." };
    }
    // taskKey is intentionally NOT regenerated on edit to keep it stable.
    await prisma.benchmarkTask.update({
      where: { id: taskId, projectId },
      data: result.data,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { ok: false, error: DB_ERROR };
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function deleteTask(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const user = await getOrCreateDemoUser();
  if (await ownedProjectId(projectId, user.id)) {
    await prisma.benchmarkTask.delete({ where: { id: taskId, projectId } });
  }
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function importArtifact(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = String(formData.get("projectId") ?? "");

  // Accept either an uploaded file or pasted text; file wins if both present.
  const file = formData.get("artifactFile");
  let jsonText = String(formData.get("artifactJson") ?? "");
  if (file instanceof File && file.size > 0) {
    jsonText = await file.text();
  }
  if (!jsonText.trim()) {
    return {
      ok: false,
      fieldErrors: { artifactJson: "Paste artifact JSON or choose a file to import." },
    };
  }

  const parsed = parseArtifact(jsonText);
  if (!parsed.ok) {
    return { ok: false, fieldErrors: { artifactJson: parsed.error } };
  }

  try {
    const user = await getOrCreateDemoUser();
    if (!(await ownedProjectId(projectId, user.id))) {
      return { ok: false, error: "Project not found." };
    }

    const contentHash = createHash("sha256").update(jsonText).digest("hex");
    const duplicate = await prisma.artifact.findFirst({
      where: { projectId, contentHash },
      select: { id: true },
    });
    if (duplicate) {
      return {
        ok: false,
        error: "This artifact appears to have already been imported into this project.",
      };
    }

    const tasks = await prisma.benchmarkTask.findMany({
      where: { projectId },
      select: { id: true, taskKey: true },
    });
    const taskIdByKey = new Map(tasks.map((t) => [t.taskKey, t.id]));

    const matched = parsed.artifact.runs.filter((run) =>
      taskIdByKey.has(run.promptId),
    ).length;
    const unmatched = parsed.artifact.runs.length - matched;

    await prisma.artifact.create({
      data: {
        projectId,
        variant: parsed.artifact.variant,
        modelSha256: parsed.artifact.modelSha256,
        benchmarkStatus: parsed.artifact.benchmarkStatus,
        sourceCreatedAtUtc: parsed.artifact.createdAtUtc,
        contentHash,
        status: "imported",
        rawJson: parsed.artifact.raw as Prisma.InputJsonValue,
        modelRuns: {
          create: parsed.artifact.runs.map((run) => ({
            promptId: run.promptId,
            ok: run.ok,
            // Unavailable metrics persist as null, never 0.
            elapsedSeconds: run.elapsedSeconds,
            tokensPerSecond: run.tokensPerSecond,
            cleanOutputPreview: run.cleanOutputPreview,
            taskId: taskIdByKey.get(run.promptId) ?? null,
          })),
        },
      },
    });

    revalidatePath(`/projects/${projectId}`);
    const variantNote = parsed.artifact.variantKnown
      ? ""
      : ` Variant "${parsed.artifact.variant}" is not a known variant and was flagged.`;
    return {
      ok: true,
      message:
        `Imported ${parsed.artifact.runs.length} run(s): ${matched} matched to ` +
        `tasks, ${unmatched} unmatched.${variantNote}`,
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { ok: false, error: DB_ERROR };
  }
}

export async function deleteArtifact(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const artifactId = String(formData.get("artifactId") ?? "");
  const user = await getOrCreateDemoUser();
  if (await ownedProjectId(projectId, user.id)) {
    // Ensure the artifact belongs to this project before deleting.
    await prisma.artifact.deleteMany({ where: { id: artifactId, projectId } });
  }
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function saveManualScore(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const runId = String(formData.get("runId") ?? "");
  const result = validateManualScoreInput({
    correctness: formData.get("correctness"),
    clarity: formData.get("clarity"),
    beginnerFriendliness: formData.get("beginnerFriendliness"),
    minimalityOfFix: formData.get("minimalityOfFix"),
    hallucinationRisk: formData.get("hallucinationRisk"),
    offlineUsefulness: formData.get("offlineUsefulness"),
    notes: formData.get("notes"),
  });

  if (!result.ok) {
    return { ok: false, fieldErrors: result.fieldErrors };
  }

  try {
    const user = await getOrCreateDemoUser();
    const run = await prisma.modelRun.findFirst({
      where: {
        id: runId,
        artifact: { projectId, project: { ownerId: user.id } },
      },
      select: {
        id: true,
        scores: {
          where: { raterId: user.id },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!run) {
      return { ok: false, error: "Model run not found for this project." };
    }

    const existingScore = run.scores[0];
    if (existingScore) {
      await prisma.manualScore.update({
        where: { id: existingScore.id },
        data: result.data,
      });
    } else {
      await prisma.manualScore.create({
        data: {
          ...result.data,
          modelRunId: run.id,
          raterId: user.id,
        },
      });
    }
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { ok: false, error: DB_ERROR };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/runs/${runId}/score`);
  return { ok: true, message: "Manual score saved." };
}
