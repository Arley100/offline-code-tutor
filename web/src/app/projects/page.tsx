export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Projects</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        Placeholder. Project listing and creation will be implemented in a later
        ticket. Real projects are populated by importing benchmark artifacts
        produced by the OfflineCodeTutor CLI.
      </p>

      <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
        No projects yet. Artifact import is not implemented in this foundation.
      </div>
    </div>
  );
}
