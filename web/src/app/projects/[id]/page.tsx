import Link from "next/link";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="text-sm text-neutral-600 hover:underline dark:text-neutral-300"
      >
        ← Back to projects
      </Link>
      <h1 className="text-2xl font-bold">Project detail</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        Placeholder for project{" "}
        <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">
          {id}
        </code>
        . Tasks, imported artifacts, model runs, scores, and the comparison view
        will appear here in later tickets.
      </p>
    </div>
  );
}
