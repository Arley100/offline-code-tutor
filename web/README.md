# EvalForge / TutorBench Local — Web App

This is the **foundation** of the EvalForge web app: the evaluation, comparison,
and reporting layer that will sit on top of benchmark artifacts produced by the
OfflineCodeTutor Python CLI at the repository root.

> **Status (Ticket 1):** foundation only. Artifact import, scoring UI, and
> comparison dashboards are **not implemented yet**. No metrics shown in the app
> are real until artifact import lands. This is an independent portfolio/research
> project inspired by the ADTC 2026 Laptop LLM Challenge — not an official
> submission.

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

You need a local PostgreSQL instance. Set `DATABASE_URL` in `.env` (see
`.env.example`). Then create the schema and (optionally) seed synthetic demo
data:

```bash
npm run prisma:generate   # generate the Prisma client
npm run db:push           # apply the schema to your database (dev)
npm run db:seed           # OPTIONAL: insert synthetic demo data
```

`db:seed` inserts **synthetic** demo data only (one demo project, placeholder
tasks and runs). It is not real evaluation data and contains no real metrics.

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

## What Ticket 1 includes

- `web/` Next.js + TypeScript + Tailwind app (App Router), monorepo-style next to
  the CLI.
- Product shell: landing page, demo sign-in route, protected dashboard,
  projects placeholder, project-detail placeholder.
- Demo placeholder authentication + route-protection middleware.
- Prisma schema draft: `User`, `Project`, `BenchmarkTask`, `Artifact`,
  `ModelRun`, `ManualScore` with relations and timestamps.
- `.env.example`, synthetic seed script, and Vitest tests for pure domain
  helpers (`aggregateManualScores`, `projectSummary`).

## What Ticket 1 intentionally does NOT include

- No artifact import (no parsing of CLI benchmark JSON yet).
- No scoring UI.
- No comparison dashboard beyond a static protected shell.
- No real authentication (the cookie demo is a placeholder).
- No AI features and no inference (inference stays in the CLI).
- No real or private data — seed data is synthetic.

## Layout

```text
web/
├── prisma/
│   ├── schema.prisma     # entity draft
│   └── seed.ts           # synthetic demo seed
├── src/
│   ├── app/              # App Router pages + api routes
│   ├── lib/              # pure domain helpers, prisma + auth placeholders
│   └── middleware.ts     # demo route protection
├── .env.example
└── package.json
```
