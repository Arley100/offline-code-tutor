# Non-Goals

What EvalForge / TutorBench Local deliberately is **not**. These constraints keep
the project honest and scoped. They are as important as the feature list.

## Not a ChatGPT clone
This is not a general-purpose chat assistant or a polished conversational product.
It is an evaluation studio for offline coding tutors. The chat-style `ask` command
exists to produce answers to evaluate, not to compete with hosted assistants.

## Not claiming production-grade tutoring reliability
The tool measures and reports quality; it does not assert that any model is
reliable enough to teach unsupervised. Recorded results apply only to the specific
model, quantization, hardware, and settings used. No "trusted tutor" claims.

## Not automatically grading correctness in V1
V1 correctness comes from a human applying a fixed rubric. There is no automatic
correctness grader, because robustly grading open-ended debugging explanations is
itself unsolved. Faking objectivity with a brittle auto-grader would be worse than
an honest manual score. Execution-based checks are a later, opt-in extension.

## Not running untrusted code in V1
V1 does not compile or execute model-suggested code. Any future execution-based
verification (Ticket 8+) must be sandboxed and opt-in. Until that exists, suggested
fixes are advisory and the user must run them themselves.

## Not hiding failed model outputs
Failed runs, wrong answers, truncated outputs, and flawed reasoning traces are
recorded and shown, not filtered out. The signature finding of this project — a
correct fix paired with a wrong explanation — is only valuable because failures
are surfaced. Cherry-picking would defeat the purpose.

## Not fabricating metrics
Unavailable measurements are labeled unavailable, never reported as zero or
invented. This applies to throughput, memory, and unscored runs alike.

## Not an official ADTC submission
This is an independent portfolio/research project inspired by the ADTC 2026 Laptop
LLM Challenge. It does not claim eligibility, acceptance, participation, or any
official status. The inspiration shaped the constraints; it does not confer a
credential.
