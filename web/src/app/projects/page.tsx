import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOrCreateDemoUser } from "@/lib/demo-user";
import { ProjectForm } from "@/components/ProjectForm";
import { DeleteButton } from "@/components/DeleteButton";
import { createProject, deleteProject } from "./actions";

export const dynamic = "force-dynamic";

type ProjectListItem = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  _count: { tasks: number; artifacts: number };
};

async function loadProjects(): Promise<
  { ok: true; projects: ProjectListItem[] } | { ok: false }
> {
  try {
    const user = await getOrCreateDemoUser();
    const projects = await prisma.project.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { tasks: true, artifacts: true } } },
    });
    return { ok: true, projects };
  } catch {
    return { ok: false };
  }
}

export default async function ProjectsPage() {
  const result = await loadProjects();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Projects</h1>
        <p className="text-xs text-amber-700 dark:text-amber-500">
          Demo placeholder auth: all projects belong to a single demo user. This
          is not real authentication.
        </p>
      </div>

      {!result.ok ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          Could not load projects. Make sure PostgreSQL is running and the schema
          is applied (<code>npm run db:push</code>). See <code>web/README.md</code>.
        </div>
      ) : (
        <>
          <section className="space-y-3">
            {result.projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
                No projects yet. Create your first evaluation project below.
              </div>
            ) : (
              <ul className="space-y-3">
                {result.projects.map((project) => (
                  <li
                    key={project.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium hover:underline"
                      >
                        {project.name}
                      </Link>
                      {project.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-300">
                          {project.description}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-neutral-500">
                        {project._count.tasks} task
                        {project._count.tasks === 1 ? "" : "s"} ·{" "}
                        {project._count.artifacts} artifact
                        {project._count.artifacts === 1 ? "" : "s"} · created{" "}
                        {project.createdAt.toISOString().slice(0, 10)}
                      </p>
                    </div>
                    <DeleteButton
                      action={deleteProject}
                      fields={{ id: project.id }}
                      label="Delete"
                      confirmText={`Delete project "${project.name}" and all its tasks? This cannot be undone.`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-4 text-lg font-semibold">New project</h2>
            <ProjectForm action={createProject} submitLabel="Create project" />
          </section>
        </>
      )}
    </div>
  );
}
