# Full-Stack Spec — Draft

> **Status: partially implemented.** Tickets 1–6 are built (see "Implemented so
> far" below). The remaining sections — real auth and later roadmap items — are
> still draft specifications describing intended behavior. Technology choices
> that are now in use are marked; the rest remain proposals.
>
> **Implemented so far (Tickets 1–6):** Next.js (App Router) + TypeScript +
> Tailwind in `web/`; PostgreSQL via Prisma; demo placeholder cookie auth with
> route-protection middleware; project and benchmark-task CRUD via Server Actions
> with pure validation helpers and Vitest tests; **JSON artifact import** (pure
> parser/validator, `Artifact` + `ModelRun` creation, run-to-task matching by
> `taskKey`, duplicate guard via content hash, missing metrics stored as null);
> **manual scoring UI** for imported model runs (six 1–5 rubric dimensions plus
> notes, create/update behavior for the demo user, score coverage summary, no
> artifact mutation); **comparison dashboard** (`/projects/[id]/compare`) with
> per-variant and run-level summaries, evidence-level callouts, and pure tested
> helpers; **Markdown report export** (`/projects/[id]/report.md` route handler +
> pure tested `generateReportMarkdown`); synthetic seed + Docker Compose Postgres.

## Goals and boundaries

EvalForge is the evaluation, comparison, and reporting layer on top of artifacts
produced offline by the CLI. It does **not** perform inference itself in V1; it
imports recorded JSON. See `NON_GOALS.md` for hard constraints (no auto-grading,
no untrusted code execution, no fabricated metrics in V1).

## Proposed stack

- **Frontend/app framework:** Next.js (App Router), TypeScript, React.
- **Backend:** Next.js server routes / route handlers (colocated API).
- **Database:** PostgreSQL via an ORM (e.g. Prisma) with migrations.
- **Auth:** session-based auth with hashed credentials; provider-agnostic.
- **Testing:** unit + integration tests; end-to-end for critical flows.
- **Hosting:** containerized; deployable to a managed platform or self-hosted.

These are starting points. The CLI stays Python; the web app is a separate process
that reads CLI output. They communicate through the artifact JSON contract, not a
shared runtime.

## Core domain concepts

- **User** — an authenticated account that owns projects.
- **Project** — an evaluation effort grouping tasks, artifacts, and scores.
- **Benchmark task** — a single debugging problem (id, prompt, expected-fix hint).
- **Model run** — a recorded run of a task under a variant/model/settings,
  imported from a CLI artifact (one `runs[]` entry).
- **Imported artifact** — the raw uploaded benchmark JSON, validated and stored.
- **Manual score** — a user's six-dimension rubric score plus notes for a run.
- **Report** — a generated Markdown comparison for a project.

## Users / auth

- Email + password (hashed with a strong KDF), session cookies.
- Authorization: a user can only read/write their own projects and the artifacts,
  runs, and scores beneath them.
- V1 is single-tenant-per-user; team/sharing features are out of scope for V1.

## Projects

- CRUD. A project has a name, description, and timestamps.
- A project aggregates benchmark tasks, imported artifacts, model runs, scores,
  and generated reports.

## Benchmark tasks

- Seeded from the CLI's `metadata.json` (e.g. `python-factorial-debug`,
  `cpp-vector-bounds-debug`), extensible later (Ticket 7).
- **Implemented (Ticket 2)** fields: `taskKey` (stable slug, auto-generated and
  unique per project), `title`, `prompt`, `language`, `difficulty`
  (easy/medium/hard), `category` (bug type), `expectedFixHint` (expected
  behavior/fix), `notes`, timestamps. Full CRUD inside a project.

## Model runs — implemented (Ticket 3)

- Created during artifact import: one per `runs[]` entry.
- Store prompt id, ok, elapsed seconds (nullable), tokens/sec (nullable),
  cleaned-output preview (nullable), a nullable `taskId` link (matched by
  `taskKey`), and a link to the originating artifact.
- Never invented: nullable metrics stay null (see `ARTIFACT_FORMAT.md`).

## Imported artifacts — implemented (Ticket 3)

- `importArtifact` Server Action validates with the pure parser
  (`src/lib/artifact.ts`) against the `ARTIFACT_FORMAT.md` contract: strict
  structure, lenient optional fields, "unavailable" never zero.
- Accepts file upload or pasted JSON. Stores the immutable raw JSON plus extracted
  metadata (variant, model sha256, benchmark status, source created-at).
- Duplicate imports into the same project are blocked via a SHA-256 content hash.

## Manual scores — implemented (Ticket 4)

- Implements `EVAL_RUBRIC.md`: six integer dimensions (1–5) plus `notes`.
- Enforce the reversed `hallucination_risk` convention in validation and display.
- Scores attach to a model run; the source artifact is never mutated.
- A run is "scored" only when all six dimensions are present and valid.
- UI route: `/projects/[id]/runs/[runId]/score`.
- The score page shows prompt/task context, expected fix hint when available,
  variant/model information, model output preview, ok/failure status, and nullable
  latency/speed metrics. Missing values render as unavailable, never zero.
- `saveManualScore` verifies the run belongs to the current demo user's project,
  then updates that user's existing score or creates one. It does not auto-score
  and does not mutate `Artifact.rawJson`.

## Comparison dashboard — implemented (Ticket 5)

- Route `/projects/[id]/compare`, linked from the project page. Pure logic lives
  in `src/lib/comparison.ts` (`buildComparison`) and is unit tested.
- Per project, variants compared side by side: run count, scored count, average
  manual score, per-dimension averages (hallucination risk labeled "5 = lowest
  risk"), and average elapsed seconds / tokens-per-second.
- Run-level table linking each run to the existing scoring page.
- Unavailable measurements render as "—", never 0. Unscored runs are excluded
  from score averages (not treated as 0).
- Evidence-aware insight callout: no winner when there are no scored runs; a
  "limited evidence" label for small samples or a single scored variant; only a
  normal (still non-statistical) summary once enough scored runs span ≥2 variants.

## Report generation — implemented (Ticket 6)

- "Export Markdown" on the comparison dashboard links to a route handler at
  `/projects/[id]/report.md`, which verifies ownership, fetches the dashboard's
  evidence, and returns `text/markdown` as an attachment
  (`evalforge-report-<project-slug>.md`).
- Pure generator `generateReportMarkdown` (in `src/lib/report.ts`, unit tested)
  accepts already-fetched data and never queries the DB.
- The report covers evidence status, overall summary, imported artifacts,
  per-variant comparison, run-level evidence, the rubric, missing-data notes,
  limitations, and next steps. Missing values render as `—` (never 0), no winner
  is stated without scored runs, limited evidence is labeled, and no
  statistical-certainty claims are made. Read-only: no DB or artifact mutation.

## Database entities (proposed)

```text
User(id, email, password_hash, created_at)
Project(id, user_id -> User, name, description, created_at, updated_at)
BenchmarkTask(id, project_id -> Project, task_key, title, prompt, language?,
              difficulty?, category?, expected_fix_hint?, notes?)  # implemented
Artifact(id, project_id -> Project, variant, raw_json, model_sha256,
         benchmark_status?, source_created_at_utc?, content_hash?, status,
         created_at)  # implemented (Ticket 3)
ModelRun(id, artifact_id -> Artifact, task_key, ok, return_code?, elapsed_seconds,
         tokens_per_second?, clean_output_preview, timings_json)
ManualScore(id, model_run_id -> ModelRun, user_id -> User, correctness, clarity,
            beginner_friendliness, minimality_of_fix, hallucination_risk,
            offline_usefulness, notes, created_at)  # implemented (Ticket 4)
Report(id, project_id -> Project, markdown, created_at)
```
Nullable fields are marked `?`. Foreign keys cascade on project delete.

## API routes (draft)

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id

GET    /api/projects/:id/tasks
POST   /api/projects/:id/tasks

POST   /api/projects/:id/artifacts        # upload + validate import
GET    /api/projects/:id/artifacts
GET    /api/artifacts/:id                  # includes derived model runs

GET    /api/runs/:id
POST   /api/runs/:id/score                 # create/update manual score
GET    /api/runs/:id/score

GET    /api/projects/:id/comparison        # dashboard data
POST   /api/projects/:id/reports           # generate report
GET    /api/reports/:id                     # markdown export
```
All routes are scoped to the authenticated user's ownership.

Ticket 4 implements scoring with a Next.js page plus Server Action rather than a
separate public API route: `GET /projects/:id/runs/:runId/score` and
`saveManualScore`.

## Testing strategy

- **Unit:** artifact validation (valid/invalid/missing-optional), rubric
  validation (range, reversed dimension, completeness), aggregation math
  (unavailable ≠ 0), report rendering.
- **Integration:** import → derive runs → score → comparison → report happy path,
  plus authorization (cannot access another user's project).
- **End-to-end:** the critical flow — log in, create project, import the three
  sample artifacts, score, view comparison, export report.
- **Fixtures:** reuse the existing CLI artifacts as golden import samples so the
  web app and CLI cannot silently diverge.

## Deployment plan

- Containerize the app; provision a managed PostgreSQL instance.
- CI runs lint + unit + integration on every change; block merge on failure.
- Migrations applied automatically on deploy.
- Start with a single environment; add staging once the foundation is stable.
- Inference stays local on the user's machine via the CLI; the web app never
  becomes a hosted inference endpoint in V1.

## Open questions (to resolve at Ticket 1)
- ORM and migration tooling choice.
- Whether artifact upload is file-based, paste-based, or both.
- Multi-rater scoring (and inter-rater agreement) — likely post-V1.
- How model identity is normalized across variants for multi-model comparison.
