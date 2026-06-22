export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const redirectTo = redirect ?? "/dashboard";

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Demo placeholder sign-in. This sets a temporary cookie only and is{" "}
          <strong>not real authentication</strong>. Auth.js / NextAuth will
          replace it in a later ticket.
        </p>
      </div>

      <form
        action="/api/auth/demo-sign-in"
        method="post"
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <input type="hidden" name="redirect" value={redirectTo} />
        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600 dark:text-neutral-300">
            Email (not verified in demo)
          </span>
          <input
            type="email"
            name="email"
            placeholder="demo@example.com"
            className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Continue (demo)
        </button>
      </form>
    </div>
  );
}
