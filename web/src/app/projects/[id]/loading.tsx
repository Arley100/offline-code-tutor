export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="h-40 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
      <div className="h-24 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
    </div>
  );
}
