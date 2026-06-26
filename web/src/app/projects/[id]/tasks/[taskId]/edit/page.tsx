import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateDemoUser } from "@/lib/demo-user";
import { TaskForm } from "@/components/TaskForm";
import { updateTask } from "../../../../actions";

export const dynamic = "force-dynamic";

async function loadTask(projectId: string, taskId: string) {
  try {
    const user = await getOrCreateDemoUser();
    const task = await prisma.benchmarkTask.findFirst({
      where: { id: taskId, projectId, project: { ownerId: user.id } },
    });
    return { ok: true as const, task };
  } catch {
    return { ok: false as const, task: null };
  }
}

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;
  const result = await loadTask(id, taskId);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <Link href={`/projects/${id}`} className="text-sm hover:underline">
          ← Back to project
        </Link>
        <div className="rounded-lg border border-red-300 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          Could not load this task. Make sure PostgreSQL is running.
        </div>
      </div>
    );
  }

  if (!result.task) {
    notFound();
  }

  const task = result.task;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/projects/${id}`} className="text-sm hover:underline">
          ← Back to project
        </Link>
        <h1 className="text-2xl font-bold">Edit task</h1>
        <p className="text-xs text-neutral-500">
          Task key <code>{task.taskKey}</code> stays stable across edits.
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <TaskForm
          action={updateTask}
          projectId={id}
          initial={{
            id: task.id,
            title: task.title,
            prompt: task.prompt,
            language: task.language,
            difficulty: task.difficulty,
            category: task.category,
            expectedFixHint: task.expectedFixHint,
            notes: task.notes,
          }}
          submitLabel="Save task"
        />
      </section>
    </div>
  );
}
