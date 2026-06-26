import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateDemoUser } from "@/lib/demo-user";
import { ProjectForm } from "@/components/ProjectForm";
import { TaskForm } from "@/components/TaskForm";
import { DeleteButton } from "@/components/DeleteButton";
import {
  createTask,
  deleteProject,
  deleteTask,
  updateProject,
} from "../actions";

export const dynamic = "force-dynamic";

async function loadProject(id: string) {
  try {
    const user = await getOrCreateDemoUser();
    const project = await prisma.project.findFirst({
      where: { id, ownerId: user.id },
      include: { tasks: { orderBy: { createdAt: "asc" } } },
    });
    return { ok: true as const, project };
  } catch {
    return { ok: false as const, project: null };
  }
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadProject(id);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <Link href="/projects" className="text-sm hover:underline">
          ← Back to projects
        </Link>
        <div className="rounded-lg border border-red-300 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          Could not load this project. Make sure PostgreSQL is running and the
          schema is applied (<code>npm run db:push</code>).
        </div>
      </div>
    );
  }

  if (!result.project) {
    notFound();
  }

  const project = result.project;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link href="/projects" className="text-sm hover:underline">
          ← Back to projects
        </Link>
        <h1 className="text-2xl font-bold">{project.name}</h1>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Project settings</h2>
          <DeleteButton
            action={deleteProject}
            fields={{ id: project.id }}
            label="Delete project"
            confirmText={`Delete project "${project.name}" and all its tasks? This cannot be undone.`}
          />
        </div>
        <ProjectForm
          action={updateProject}
          initial={{
            id: project.id,
            name: project.name,
            description: project.description,
          }}
          submitLabel="Save changes"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Benchmark tasks ({project.tasks.length})
        </h2>
        {project.tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
            No tasks yet. Add the first benchmark task below.
          </div>
        ) : (
          <ul className="space-y-3">
            {project.tasks.map((task) => (
              <li
                key={task.id}
                className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium">{task.title}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-500">
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
                        {task.taskKey}
                      </span>
                      {task.language ? <span>· {task.language}</span> : null}
                      {task.difficulty ? <span>· {task.difficulty}</span> : null}
                      {task.category ? <span>· {task.category}</span> : null}
                    </div>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">
                      {task.prompt}
                    </p>
                    {task.expectedFixHint ? (
                      <p className="mt-2 text-xs text-neutral-500">
                        Expected: {task.expectedFixHint}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Link
                      href={`/projects/${project.id}/tasks/${task.id}/edit`}
                      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      Edit
                    </Link>
                    <DeleteButton
                      action={deleteTask}
                      fields={{ projectId: project.id, taskId: task.id }}
                      label="Delete"
                      confirmText={`Delete task "${task.title}"? This cannot be undone.`}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-4 text-lg font-semibold">New task</h2>
        <TaskForm
          action={createTask}
          projectId={project.id}
          submitLabel="Add task"
        />
      </section>
    </div>
  );
}
