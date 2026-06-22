# Demo Script — 2 Minutes

A tight, honest walkthrough for recruiters, engineers, and technical founders. It
shows the working CLI today and narrates how the future EvalForge app consumes its
output. Where a step refers to the web app, say so plainly — do not imply it
already exists.

**Framing (say up front):** "This is an independent project inspired by the ADTC
2026 Laptop LLM Challenge — not an official submission. It's an evaluation studio
for offline coding tutors. Inference runs locally; the point is honest evidence,
not a chatbot demo."

---

## 0:00–0:20 — The problem and the artifacts
"Small local models can give coding help offline, but fluent answers can be
confidently wrong. So instead of a live demo, I record reproducible evidence."

- Show `results/` and open `benchmark_local.json`.
- Point at `model.sha256`, `settings`, and a run's `clean_output_preview`.
  "Every run pins the exact model and settings, so results are reproducible."

## 0:20–0:45 — Import an artifact (future EvalForge app)
"The CLI produces these JSON artifacts offline. The EvalForge web app — planned,
not yet built — imports them."

- Narrate the import: strict validation, optional fields shown as *unavailable*
  rather than zero (reference `ARTIFACT_FORMAT.md`).
  "No fabricated numbers. Missing data is labeled missing."

## 0:45–1:10 — Score model answers
"Correctness isn't observable from fluency, so a human applies a fixed rubric."

- Show the six dimensions from `EVAL_RUBRIC.md`; call out that
  `hallucination_risk` is reversed (5 = lowest risk).
- Demonstrate (CLI today, UI later) scoring the factorial answer.
  "Baseline missed the real `factorial(0)` bug and talked about negative input
  instead — so correctness scores low even though the answer reads smoothly."

## 1:10–1:35 — Compare prompt variants
- Open `benchmark_comparison.md` (or the planned dashboard).
- Walk the three variants: baseline, prompt_v2, prompt_v3.
  "Trace-first prompting (v3) raised manually scored correctness from 2.5 to 4.0
  — but average latency went from about 5 to about 14 seconds, partly because v3
  also gets a larger token budget."

## 1:35–1:50 — The trace-first tradeoff (the honest finding)
"Here's the signature result: v3 found the correct fix, but its written *trace*
was still wrong — it claimed the base case recurses when it returns immediately.
A correct fix with a flawed explanation. That's exactly why evaluation and
guardrails matter for beginner-facing tutors."

## 1:50–2:00 — Evidence-backed report and limitations
- Show the exported Markdown report.
  "Every claim here is backed by a recorded artifact and a logged score."
- Close on limitations: "Two tasks, one run each, subjective scoring, no execution
  verification yet. I'd rather show honest, reproducible evidence than a polished
  illusion."

---

## Delivery notes
- Keep claims tied to artifacts on screen. If a number isn't in an artifact, don't
  say it.
- Never imply the web app is built if you're narrating it — use "planned."
- Lead with the honest tradeoff; it is the most credible part of the story.
