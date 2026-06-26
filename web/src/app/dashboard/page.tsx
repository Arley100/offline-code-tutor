import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOrCreateDemoUser } from "@/lib/demo-user";

export const dynamic = "force-dynamic";

async function loadCounts(): Promise<{ projects: number | null; tasks: number | null }> {
  try {
    const user = await getOrCreateDemoUser();
    const [projects, tasks] = await Promise.all([
      prisma.project.count({ where: { ownerId: user.id } }),
      prisma.benchmarkTask.count({ where: { project: { ownerId: user.id } } }),
    ]);
    return { projects, tasks };
  } catch {
    return { projects: null, tasks: null };
  }
}

function display(value: number | null): string {
  return value === null ? "—" : String(value);
}

export default async function DashboardPage() {
  const counts = await loadCounts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <form action="/api/auth/demo-sign-out" method="post">
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Sign out
          </button>
        </form>
      </div>

      <p className="text-xs text-amber-700 dark:text-amber-500">
        Protected by demo placeholder auth (cookie-based). This is not real
        authentication.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Projects
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {display(counts.projects)}
          </div>
          <Link
            href="/projects"
            className="mt-2 inline-block text-sm text-neutral-600 hover:underline dark:text-neutral-300"
          >
            Manage projects
          </Link>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Benchmark tasks
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {display(counts.tasks)}
          </div>
          <div className="mt-2 text-xs text-neutral-400">
            Across all your projects
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Imported artifacts
          </div>
          <div className="mt-1 text-2xl font-semibold">—</div>
          <div className="mt-2 text-xs text-neutral-400">
            Available after artifact import (later ticket)
          </div>
        </div>
      </div>
    </div>
  );
}
