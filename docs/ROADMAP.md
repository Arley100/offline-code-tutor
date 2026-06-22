# Roadmap — EvalForge / TutorBench Local

Staged plan from the current CLI seed to a full-stack evaluation studio. Each
stage is intended to be shippable and independently reviewable. Stages are
sequential by default but several are parallelizable once the foundation exists.

> Honesty note: this roadmap is a plan, not a record of completed work. Only the
> CLI (through Ticket 0) exists today.

## Ticket 0 — Documentation and product reframing (this stage)
- Reframe the repo as the CLI seed of EvalForge / TutorBench Local.
- Add product thesis, rubric, artifact format, roadmap, non-goals, demo script,
  and a draft full-stack spec under `docs/`.
- Keep the ADTC independent-project / not-an-official-submission note intact.
- No code changes, no new dependencies, no web app.
- **Done when:** docs exist, README explains current status and direction, and the
  existing test suite still passes.

## Ticket 1 — Full-stack app foundation
- Stand up the web application skeleton (framework, project structure, linting,
  test harness, CI). No product features yet.
- Define the database connection and migration tooling.
- **Done when:** the app builds, runs locally, and has a passing placeholder test.

## Ticket 2 — Evaluation projects and benchmark tasks
- Model "evaluation project" and "benchmark task" entities.
- CRUD for projects and tasks; seed with the existing two debugging tasks.
- **Done when:** a user can create a project and view its tasks.

## Ticket 3 — JSON artifact import
- Implement the importer described in `ARTIFACT_FORMAT.md`: strict structural
  validation, lenient optional-field handling, "unavailable" never zero.
- Store imported artifacts and link them to a project and variant.
- **Done when:** the three sample artifacts import cleanly and invalid files are
  rejected with clear errors.

## Ticket 4 — Manual scoring UI
- A guided interface implementing `EVAL_RUBRIC.md`: show prompt, cleaned answer,
  and expected-fix hint; collect six 1–5 scores plus notes; enforce the reversed
  `hallucination_risk` convention.
- Persist scores against runs without mutating the imported source.
- **Done when:** a user can score an imported artifact and scores persist.

## Ticket 5 — Comparison dashboard
- Side-by-side comparison of variants (and later models): elapsed time, generation
  speed, successful runs, and per-dimension manual averages.
- Surface unavailable measurements explicitly.
- **Done when:** baseline/prompt_v2/prompt_v3 render in one comparison view.

## Ticket 6 — Markdown report export
- Export an evidence-backed Markdown report equivalent to (and eventually richer
  than) the CLI's `benchmark_comparison.md`, including per-task notes and the
  honest tradeoff narrative.
- **Done when:** a user can export a report that a recruiter or engineer could read
  standalone.

## Ticket 7 — Expanded benchmark pack
- Grow beyond two tasks: more Python, C, and C++ defects; repeated runs to measure
  variability; controlled separation of prompt effect from output-length effect.
- **Done when:** the benchmark pack is documented and reproducible.

## Ticket 8+ — Optional advanced capabilities
- **Local runner integration:** optionally trigger CLI/`llama.cpp` runs from the
  app while keeping inference local.
- **Code execution verification:** sandboxed execution of corrected snippets to
  mechanically check correctness where possible (opt-in, carefully isolated).
- **Multi-model support:** compare different local models and quantizations on the
  same tasks and rubric.
- These are explicitly later and gated on the foundation being solid.

## Sequencing notes
- Tickets 1–3 are the critical path; scoring (4), dashboard (5), and report (6)
  depend on import (3).
- Ticket 7 can proceed in parallel with the CLI once the artifact format is stable.
- Ticket 8+ items are optional and should not block a credible V1.
