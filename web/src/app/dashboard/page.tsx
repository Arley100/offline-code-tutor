import Link from "next/link";

export default function DashboardPage() {
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

      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        Protected shell. Route protection is handled by demo placeholder
        middleware. There is no real data here yet.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Projects", value: "—", href: "/projects" },
          { label: "Imported artifacts", value: "—", href: null },
          { label: "Scored runs", value: "—", href: null },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              {card.label}
            </div>
            <div className="mt-1 text-2xl font-semibold">{card.value}</div>
            {card.href ? (
              <Link
                href={card.href}
                className="mt-2 inline-block text-sm text-neutral-600 hover:underline dark:text-neutral-300"
              >
                View
              </Link>
            ) : (
              <div className="mt-2 text-xs text-neutral-400">
                Available after artifact import (later ticket)
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
