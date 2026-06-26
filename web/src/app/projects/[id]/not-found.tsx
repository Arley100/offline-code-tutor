import Link from "next/link";

export default function ProjectNotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Project not found</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        This project does not exist or is not owned by the demo user.
      </p>
      <Link href="/projects" className="text-sm hover:underline">
        ← Back to projects
      </Link>
    </div>
  );
}
