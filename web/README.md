# EvalForge / TutorBench Local — Web App

This is the **foundation** of the EvalForge web app: the evaluation, comparison,
and reporting layer that will sit on top of benchmark artifacts produced by the
OfflineCodeTutor Python CLI at the repository root.

> **Status (through Ticket 3):** the app has real, database-backed project and
> benchmark-task management, plus **JSON artifact import** (validate, store, create
> model runs, match runs to tasks by stable task key). The scoring UI and
> comparison dashboard are still **not implemented yet** — imported metrics are
> shown as-is and missing metrics are shown as unavailable, never zero. This is an
> independent portfolio/research project inspired by the ADTC 2026 Laptop LLM
> Challenge — not an official submission. Authentication is still a demo
> placeholder, clearly labeled in the
> UI; it is **not** production-ready auth.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- PostgreSQL via Prisma
- Demo placeholder auth (cookie-based) — Auth.js / NextAuth planned for later
- Vitest for pure domain tests

## Setup

From `web/`:

```bash
npm install
cp .env.example .env   # then edit values; never commit a real .env
```

### Local database (PostgreSQL)

You need a local PostgreSQL instance. The quickest option is the bundled Docker
Compose file (matches `.env.example`):

```bash
docker compose up -d      # starts Postgres 16 on 127.0.0.1:5433
```

Or point `DATABASE_URL` in `.env` at any PostgreSQL you already run. Then create
the schema and (optionally) seed synthetic demo data:

```bash
npm run prisma:generate   # generate the Prisma client
npm run db:push           # apply the schema to your database (dev, no migration files)
# or, to create a tracked migration instead of pushing:
npm run prisma:migrate    # prisma migrate dev
npm run db:seed           # OPTIONAL: insert synthetic demo data
```

`db:push` is the simplest dev workflow; `prisma migrate dev` is available when you
want versioned migration files. `db:seed` inserts **synthetic** demo data only
(one demo project, placeholder tasks and runs). It is not real evaluation data and
contains no real metrics.

`db:seed` is **idempotent**: the demo project, tasks, and seed artifact use stable
ids/keys, so re-running it updates/resets the same demo data instead of creating
duplicate demo projects. It only touches the seed-owned rows — user-created
projects and user-imported artifacts are left untouched. (It also removes any
legacy duplicate demo projects created by earlier, non-idempotent seed runs.)

If Prisma reports that it cannot reach the database on Windows, prefer
`127.0.0.1` over `localhost` in `DATABASE_URL`. Some local setups resolve
`localhost` to IPv6 `::1`, while Docker is publishing Postgres on the IPv4 loopback
port. If the container just started, wait until the Compose health check reports
healthy before running `npm run db:push`.

### Using the app

1. `npm run dev`, open `http://localhost:3000`, and click **Sign in** (demo
   placeholder — any email, no password).
2. Go to **Projects** to create an evaluation project, then open it to add
   benchmark tasks (title, language, difficulty, category, prompt, expected
   behavior/fix, notes).
3. On the project page, use **Import artifact** to import an OfflineCodeTutor
   benchmark JSON (upload a file or paste the contents of a `results/benchmark_*.json`
   from the repo root). The app validates it, stores the artifact, creates a model
   run per benchmark run, and matches runs to tasks by `taskKey` == the run's
   `prompt_id`. Unmatched runs are imported and clearly flagged.
4. All data belongs to a single demo user until real auth is added.

### Importing an artifact

- **Required top-level fields:** `project`, `created_at_utc`, `benchmark_status`,
  `model`, `runtime`, `settings`, `manual_accuracy`, and a non-empty `runs` array.
  Each run needs `prompt_id`, `prompt`, and `ok`. Files missing these are rejected
  with a readable error (and non-OfflineCodeTutor JSON is rejected as such).
- **Missing optional metrics** (`elapsed_seconds`, `tokens_per_second`,
  `clean_output_preview`) are stored as `null` / shown as "—", **never as zero**.
  Nothing is fabricated.
- **Variant** comes from `settings.prompt_variant`; unknown variants are imported
  but flagged.
- **Duplicate guard:** re-importing identical JSON into the same project is
  blocked via a content hash. Delete the artifact to re-import.

## Run

```bash
npm run dev       # start the dev server at http://localhost:3000
npm run build     # production build
npm run start     # run the production build
```

## Quality checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run test        # vitest run (pure domain tests)
```

## What Ticket 1 included

- `web/` Next.js + TypeScript + Tailwind app (App Router), monorepo-style next to
  the CLI.
- Product shell, demo placeholder auth + route-protection middleware.
- Prisma schema draft (`User`, `Project`, `BenchmarkTask`, `Artifact`,
  `ModelRun`, `ManualScore`).
- `.env.example`, synthetic seed script, and Vitest domain tests.

## What Ticket 2 includes

- Real, database-backed **project CRUD**: list, create, view/edit, delete (with
  confirmation; cascades to tasks/artifacts).
- Real **benchmark-task CRUD** inside a project: list, create, edit, delete, with
  fields for title, language, difficulty, category, prompt, expected
  behavior/fix, and notes. Stable auto-generated `taskKey` slug per project.
- Server Actions + `useActionState` forms with user-readable validation, error,
  loading, empty, and success states.
- Pure validation helpers (`validateProjectInput`, `validateTaskInput`,
  `slugify`) with Vitest tests.
- `docker-compose.yml` for local Postgres, extended task fields in the schema,
  and updated synthetic seed data.

## What Ticket 3 includes

- **JSON artifact import** on the project page (file upload or paste).
- Pure parser/validator (`src/lib/artifact.ts`) with Vitest tests covering valid
  baseline/prompt_v3, malformed JSON, missing required fields, unknown variant,
  and missing optional metrics → `null` (never 0).
- `importArtifact` / `deleteArtifact` Server Actions: validate, store an
  `Artifact`, create `ModelRun` rows, match runs to `BenchmarkTask` by `taskKey`,
  block duplicate imports via a content hash.
- Project page UI: imported-artifact list with per-run summary, matched/unmatched
  indicators, and an unmatched-task warning.
- Minimal schema additions to `Artifact`: `benchmarkStatus`, `sourceCreatedAtUtc`,
  `contentHash` (all nullable).
- Synthetic fixtures under `src/lib/__fixtures__/`.

## What Ticket 3 intentionally does NOT include

- No manual scoring UI (that is Ticket 4).
- No comparison dashboard beyond simple counts.
- No real authentication (the cookie demo is a placeholder, labeled in the UI).
- No AI features, no inference, and no execution of imported code.
- No fabricated metrics; missing metrics are unavailable, never zero.
- No real or private data — seed data and fixtures are synthetic.

## Layout

```text
web/
├── docker-compose.yml    # local Postgres for development
├── prisma/
│   ├── schema.prisma     # entity definitions
│   └── seed.ts           # synthetic demo seed
├── src/
│   ├── app/
│   │   ├── projects/     # project + task CRUD pages and Server Actions
│   │   ├── dashboard/    # protected overview
│   │   └── api/auth/     # demo sign-in / sign-out routes
│   ├── components/       # client form + delete-confirm components
│   ├── lib/              # validation, domain helpers, prisma + auth placeholders
│   └── middleware.ts     # demo route protection
├── .env.example
└── package.json
```
