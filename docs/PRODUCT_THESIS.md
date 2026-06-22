# Product Thesis — EvalForge / TutorBench Local

> Status: planning document. The web application described here is not built. The
> working artifact today is the OfflineCodeTutor CLI in this repository.

## The problem

Developers and students increasingly want coding help that runs locally: no
account, no cloud dependency, no data leaving the machine. Small quantized models
(1–8B parameters) now run on ordinary laptops through runtimes like `llama.cpp`.
But a local model that *sounds* helpful is not the same as a local model that is
*reliable*. A beginner cannot easily tell the difference between a correct
explanation and a fluent, confident, wrong one.

There is no shortage of demos showing a local model answering a question. There
is a shortage of disciplined, reproducible evidence about *how good* a given
model, prompt, and setting actually are at a concrete debugging task — and how
that quality trades off against latency and resource use.

## Why local coding tutors need evaluation

Offline coding tutors are an evaluation problem before they are a UX problem:

- **Correctness is not observable from fluency.** The OfflineCodeTutor benchmark
  already produced a case where the model proposed the correct code fix while its
  written reasoning trace was wrong. A polished answer can hide a broken
  explanation.
- **Prompt design changes outcomes.** Across the recorded variants, trace-first
  prompting raised manually scored correctness but increased latency. You cannot
  pick a prompt responsibly without measuring both.
- **Results are setting-specific.** Quantization, temperature, token budget,
  hardware, and model choice all move the numbers. Claims that are not tied to a
  recorded configuration are not trustworthy.

Evaluation turns "this feels good" into "here is the artifact, the rubric, the
score, and the tradeoff."

## Why offline-first matters

- **Access.** Reliable internet and paid API access are not universal. An offline
  tutor is usable on a train, in a classroom with no Wi-Fi, or where bandwidth is
  expensive.
- **Privacy.** Student code and questions never leave the device.
- **Reproducibility.** A fixed local model file (pinned by SHA-256) plus fixed
  settings makes a run repeatable in a way that a moving cloud endpoint does not.
- **Cost.** After the one-time model download, inference is free.

Offline-first is therefore not a limitation to apologize for; it is the property
that makes the evaluation honest and the tool broadly usable.

## Why fluent answers are not enough

Language models optimize for plausible continuations, not verified truth. For a
coding tutor this means:

- The fix can be right while the explanation is wrong (or vice versa).
- The model can diagnose a real but secondary issue (e.g. negative-input
  handling) while missing the actual shown defect.
- Truncated output can present half a fix as if it were complete.

A serious tool must surface these failures rather than hide them. EvalForge's job
is to make failure visible and comparable, not to airbrush it.

## Why manual scoring is acceptable in V1

Automatic correctness grading for open-ended debugging explanations is itself an
unsolved problem. Rather than fake objectivity with a brittle automatic grader,
V1 uses a **fixed human rubric** (see `EVAL_RUBRIC.md`):

- It is honest about being subjective and says so.
- It is reproducible enough to compare variants when the same rater applies the
  same rubric to the same outputs.
- It avoids the worse failure mode of an automatic metric that is confidently
  wrong.

Manual scoring is a deliberate, defensible V1 choice — a baseline to improve on,
not a permanent ceiling. Later stages can add execution-based checks for cases
where correctness *is* mechanically verifiable (e.g. running a corrected snippet
against expected output).

## How this can grow into a full-stack product

The CLI already produces the raw material: structured JSON artifacts containing
prompts, model metadata, runtime details, timings, cleaned outputs, and rubric
scores. EvalForge wraps that material in a workflow:

1. **Import** benchmark artifacts produced offline by the CLI.
2. **Organize** them into evaluation projects and benchmark tasks.
3. **Score** model answers through a guided manual-rubric UI.
4. **Compare** prompt variants and models on a dashboard.
5. **Report** with exportable, evidence-backed Markdown.
6. **Extend** toward optional local runner integration, execution-based
   verification, and multi-model comparison.

The CLI stays the offline inference engine; the web app becomes the evaluation,
comparison, and reporting layer. The product is credible precisely because it is
built on recorded evidence rather than live demos. See `ROADMAP.md` for the
staged plan and `NON_GOALS.md` for what this explicitly is not.

## Honesty note

This project is an independent portfolio/research project inspired by the ADTC
2026 Laptop LLM Challenge. It is **not** an official ADTC submission and does not
claim eligibility or participation.
