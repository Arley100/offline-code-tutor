# EvalForge / TutorBench Local — Web App

This is the **foundation** of the EvalForge web app: the evaluation, comparison,
and reporting layer that will sit on top of benchmark artifacts produced by the
OfflineCodeTutor Python CLI at the repository root.

> **Status (through Ticket 6):** the app has real, database-backed project and
> benchmark-task management, **JSON artifact import** (validate, store, create
> model runs, match runs to tasks by stable task key), **manual scoring** for
> imported model runs, a **comparison dashboard** that summarizes runs and manual
> scores by prompt variant, and **Markdown report export** of that evidence. The
> dashboard and report summarize only stored evidence: they do not auto-score, do
> not claim statistical certainty, and show missing metrics as unavailable ("—"),
> never zero. This is an independent portfolio/research project inspired by the
> ADTC 2026 Laptop LLM Challenge — not an official submission. Authentication is
> still a demo placeholder, clearly labeled in the UI; it is **not**
> production-ready auth.

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
4. Use the **Score** / **Edit score** link on any imported model run to assign a
   manual rubric score. Scores are human-authored evaluation data; the app does
   not auto-score with AI and does not mutate the imported artifact JSON.
5. All data belongs to a single demo user until real auth is added.

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

### Manual scoring

Manual scoring follows `docs/EVAL_RUBRIC.md`. Each imported `ModelRun` can be
scored on six required 1–5 dimensions:

- correctness
- clarity
- beginner friendliness
- minimality of fix
- hallucination risk
- offline usefulness

`hallucination risk` uses a reversed good-is-high convention: **5 means lowest
risk** and 1 means highest risk. Notes are optional. The score page shows the
run's prompt id, matched task title, prompt, expected fix hint when available,
variant/model information, output preview, ok/failure status, latency, and
tokens/sec. Missing metrics render as "—", never zero.

Saving a score creates or updates the demo user's manual score for that run. It
does not alter `Artifact.rawJson` and it never fabricates scores or metrics.

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

- No comparison dashboard beyond simple counts.
- No real authentication (the cookie demo is a placeholder, labeled in the UI).
- No AI features, no inference, and no execution of imported code.
- No fabricated metrics; missing metrics are unavailable, never zero.
- No real or private data — seed data and fixtures are synthetic.

## What Ticket 4 includes

- Dedicated manual scoring page for each imported model run:
  `/projects/[id]/runs/[runId]/score`.
- Evidence-first scoring context: task/prompt metadata, expected fix hint,
  variant/model information, output preview, ok/failure status, and nullable
  performance metrics.
- Six required 1–5 rubric inputs plus optional notes, using the rubric from
  `docs/EVAL_RUBRIC.md`.
- Clear hallucination-risk helper text: 5 means lowest risk.
- Server Action to create or update the demo user's score for a run after
  verifying project ownership.
- Project detail indicators for scored/unscored runs and a small average score
  summary.
- Pure validation helpers and tests for score ranges, integer-only values,
  missing fields, unavailable-value averaging, and the reversed hallucination
  risk convention.

## What Ticket 4 intentionally does NOT include

- No comparison dashboard across variants (that is Ticket 5).
- No charts beyond the small score coverage/average text.
- No AI auto-scoring.
- No execution or verification of imported code.
- No mutation of imported artifact raw JSON.
- No real authentication or multi-rater workflow yet.

## What Ticket 5 includes

- A **comparison dashboard** at `/projects/[id]/compare`, linked from the project
  page.
- Summary cards: imported runs, scored runs, unscored runs, matched/unmatched,
  and average manual score (or "—").
- A score-coverage bar and a per-variant table: run count, scored count, average
  score, each rubric dimension (hallucination risk labeled "5 = lowest risk"),
  and average elapsed seconds / tokens-per-second.
- A run-level table: prompt id, matched task, variant, model, ok/failure,
  elapsed, tokens/s, score status/average, and a link to the existing score page.
- A cautious insight callout that adapts to the evidence level (none / limited /
  ok) and never over-claims.
- Pure comparison helpers in `src/lib/comparison.ts` with Vitest tests.

### How the comparison is computed

- **Manual scores are human-assigned.** The dashboard never auto-scores and never
  mutates imported artifact JSON.
- **Per-variant averages** group runs by `Artifact.variant`. A variant's average
  score is the mean of its scored runs' per-run averages; each rubric dimension is
  averaged across that variant's scored runs.
- **Missing metrics are unavailable, never zero.** Average elapsed/tokens-per-sec
  use only finite values; if none are available the cell shows "—". Unscored runs
  contribute nothing to score averages (they are not treated as 0).
- **Hallucination risk stays reversed** (5 = lowest risk) and is averaged as-is.
- **Evidence levels.** With no scored runs, no winner is declared. With a small
  sample or a single scored variant, results are labeled limited evidence. Only
  with enough scored runs across at least two variants is the comparison shown as
  a normal (still non-statistical) summary.

## What Ticket 5 intentionally does NOT include

- No report/export generation (that is Ticket 6).
- No charting library or heavy dashboard dependency (CSS-only indicators).
- No AI, no auto-scoring, no statistical/significance claims.
- No execution of imported code and no mutation of artifact raw JSON.
- No inline score editing on the dashboard (it links to the scoring page).
- No real authentication or multi-rater workflow yet.

## What Ticket 6 includes

- **Markdown report export** for a project, via an "Export Markdown" button on
  the comparison dashboard.
- A route handler at `/projects/[id]/report.md` that verifies demo-user/project
  ownership, fetches the same evidence as the dashboard, and returns
  `text/markdown` as an attachment named `evalforge-report-<project-slug>.md`.
- A pure generator (`src/lib/report.ts`, `generateReportMarkdown`) with Vitest
  tests; it accepts already-fetched data and never queries the database.

### How to export

Open a project → **Comparison dashboard** → **Export Markdown** (downloads the
`.md`). Or fetch `/projects/[id]/report.md` directly.

### What the report contains

Title and generation timestamp; an evidence-first preamble; evidence status and
overall summary (total/scored/unscored/matched/unmatched runs, average score,
best variant when available, evidence level); imported-artifact summary;
per-variant comparison table (rubric dimensions, elapsed, tokens/s); run-level
evidence table; the scoring rubric; a missing-data note; honest limitations; and
recommended next evaluation steps.

### Evidence and missing-data rules in the report

- Manual scores are human-assigned; the report is **not** an AI-generated
  judgment and the database / imported artifact JSON are never mutated.
- Missing metrics and missing scores render as `—`, never as zero, and are
  excluded from averages.
- No winner is declared when there are no scored runs; limited evidence is
  labeled as such; no statistical-significance claims are made.
- Hallucination risk uses the reversed scale (5 = lowest risk), stated in the
  report.

## What Ticket 6 intentionally does NOT include

- No PDF generation, chart images, or heavy export dependency.
- No AI-written narrative or auto-scoring.
- No execution of imported code and no mutation of artifact raw JSON.
- No real authentication or multi-rater workflow yet.

## Layout

```text
web/
├── docker-compose.yml    # local Postgres for development
├── prisma/
│   ├── schema.prisma     # entity definitions
│   └── seed.ts           # synthetic demo seed
├── src/
│   ├── app/
│   │   ├── projects/     # project + task CRUD, import, scoring, compare, report
│   │   │   ├── [id]/compare/    # comparison dashboard (Ticket 5)
│   │   │   └── [id]/report.md/  # Markdown report route handler (Ticket 6)
│   │   ├── dashboard/    # protected overview
│   │   └── api/auth/     # demo sign-in / sign-out routes
│   ├── components/       # client form + delete-confirm components
│   ├── lib/              # validation, domain, comparison, artifact, prisma, auth
│   └── middleware.ts     # demo route protection
├── .env.example
└── package.json
```
