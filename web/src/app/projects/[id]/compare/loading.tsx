export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-56 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800"
          />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
    </div>
  );
}
