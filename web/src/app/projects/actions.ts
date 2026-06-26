"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateDemoUser } from "@/lib/demo-user";
import { type FormState } from "@/lib/form";
import {
  slugify,
  validateProjectInput,
  validateTaskInput,
} from "@/lib/validation";

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
