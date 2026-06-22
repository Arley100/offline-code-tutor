import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          EvalForge / TutorBench Local
        </h1>
        <p className="max-w-2xl text-neutral-600 dark:text-neutral-300">
          An evaluation studio for offline AI coding tutors. Small local coding
          models can make programming help available offline, but fluent answers
          are not enough — they can be confidently wrong. EvalForge helps you
          test, compare, score, and report on offline coding assistants using
          reproducible artifacts and a fixed manual rubric.
        </p>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 text-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-2 font-semibold">How it fits together</h2>
        <p className="text-neutral-600 dark:text-neutral-300">
          The OfflineCodeTutor Python CLI (in this repository) runs models
          locally and produces benchmark JSON artifacts. This web app will import
          those artifacts to score, compare, and report. Inference stays offline
          in the CLI; the app is the evaluation layer.
        </p>
      </section>

      <section className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm dark:border-amber-900/60 dark:bg-amber-950/40">
        <h2 className="mb-2 font-semibold">Foundation status (Ticket 1)</h2>
        <p className="text-neutral-700 dark:text-neutral-300">
          This is the app foundation only. Artifact import, the scoring UI, and
          comparison dashboards are <strong>not implemented yet</strong>. No
          metrics shown anywhere in this app are real until artifact import
          lands.
        </p>
      </section>

      <div className="flex gap-3 text-sm">
        <Link
          href="/dashboard"
          className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Go to dashboard
        </Link>
        <Link
          href="/sign-in"
          className="rounded-md border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
