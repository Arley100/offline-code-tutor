# Evaluation Rubric

Each model answer is scored on six dimensions, integers **1 to 5**. The same
rubric is implemented by the OfflineCodeTutor CLI `score` command and is the
contract the future EvalForge scoring UI will follow.

## Scale conventions

- Scores are whole numbers 1–5. No half scores.
- For five of the six dimensions, **higher is better** (5 = strong).
- **`hallucination_risk` is reversed:** 5 means the **lowest** risk of fabricated
  or unsupported claims, 1 means the highest risk. This keeps "5 is good" true
  across the whole rubric so averages are directionally consistent.
- Scoring is subjective. It is reproducible only insofar as the same rater applies
  the same rubric to the same outputs. Record a `notes` string with every score
  explaining the reasoning.

## Dimensions

### 1. correctness
Does the answer identify the actual defect shown in the code and propose a fix
that would genuinely resolve it?

- **1** — Misses the shown bug, or proposes a fix that is wrong or would not work.
- **3** — Identifies the right area or a partially correct fix, but with a gap
  (e.g. diagnoses a secondary issue, or the fix is incomplete/truncated).
- **5** — Correctly identifies the direct bug and proposes a fix that resolves it.

### 2. clarity
Is the explanation well-organized and unambiguous to a reader who already knows
the language?

- **1** — Confusing, contradictory, or hard to follow.
- **3** — Understandable but uneven, with some vague or muddled passages.
- **5** — Clear, well-structured, and easy to follow.

### 3. beginner_friendliness
Could a student who is still learning the language act on this answer?

- **1** — Assumes too much; jargon-heavy with no accessible explanation.
- **3** — Mostly approachable but leaves some terms or steps unexplained.
- **5** — Meets a beginner where they are, explaining the "why" accessibly.

### 4. minimality_of_fix
Is the proposed change the smallest one that fixes the actual bug, without
unrelated rewrites?

- **1** — Sprawling, rewrites unrelated code, or proposes irrelevant changes.
- **3** — Roughly on target but includes some unnecessary changes or scope.
- **5** — The smallest correct change, focused on the real defect.

### 5. hallucination_risk (reversed)
How much of the answer is fabricated, unsupported, or factually wrong? **5 is
best (lowest risk).**

- **1** — High risk: confident claims that are false or invented.
- **3** — Moderate risk: mostly grounded but with a questionable or unsupported
  claim.
- **5** — Low risk: claims are accurate and grounded in the shown code.

### 6. offline_usefulness
Taken as a whole, would this answer actually help a student working offline with
no other resources?

- **1** — Not useful; misleading or empty in practice.
- **3** — Somewhat useful but limited (e.g. correct fix buried in a flawed
  explanation, or truncated).
- **5** — Genuinely useful as standalone offline help.

## Aggregation

- A variant's per-dimension score is the mean of its scored runs.
- Report means to two decimals.
- Because `hallucination_risk` is reversed, do **not** invert it before averaging;
  it is already on a "5 = good" scale, so it can be averaged alongside the others.
- Never fabricate a score to fill a table. An unscored run is "not scored," not a
  zero. See `ARTIFACT_FORMAT.md`.
