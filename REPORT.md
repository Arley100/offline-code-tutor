# OfflineCodeTutor Project Report

## Project summary

OfflineCodeTutor is a minimal offline command-line coding assistant for students debugging short Python, C, and C++ programs. It runs a local GGUF model through `llama.cpp`, records reproducible benchmark artifacts, supports manual accuracy scoring, and requires no network connection during inference.

## Problem statement

Small local models can make coding help available on modest hardware, but a fluent answer is not necessarily a correct diagnosis. This project tests whether a compact code-specialized model can identify the direct bug, explain it clearly, and propose a minimal fix without cloud inference.

## Hardware/runtime environment

- Operating system: Windows
- Machine: AMD64
- Processor: AMD64 Family 25 Model 80 Stepping 0, AuthenticAMD
- Logical CPU count recorded by Python: 16
- Python: 3.12.10, 64-bit
- Inference runtime: local `llama.cpp` CLI
- Total RAM and peak inference memory: not recorded

## Model choice

The experiment used `Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf`, a small code-oriented instruct model with Q4_K_M quantization.

- File size: 986,048,800 bytes (940.37 MiB)
- SHA-256: `f530705d447660a4336c329981af164b471b60b974b1d808d57e8ec9fe23b239`
- Temperature: 0.2 for all variants

The model is small enough to be a plausible offline candidate while retaining coding-specific behavior. The GGUF weight file is stored under `model/`, is ignored by Git, and is not committed to the repository.

## Benchmark method

All variants used the same model and the same two tasks (the original
`python-factorial-debug` and `cpp-vector-bounds-debug`):

1. Diagnose a Python factorial function whose `factorial(0)` base case incorrectly returns `0` instead of `1`.
2. Diagnose a C++ vector loop whose `<= values.size()` condition permits an out-of-bounds index.

The benchmark task pack in `metadata.json` has since been expanded to 10 stable
tasks (added in Ticket 7) for future runs. The measurements in this report cover
only the original two tasks above; the additional tasks have no recorded
measurements yet, and no metrics are invented for them.

Each variant ran both prompts once with a 120-second timeout. Baseline and prompt v2 allowed 64 generated tokens; prompt v3 allowed 128 because the earlier structured answers were cut off. Wall-clock elapsed time and generation throughput came from recorded benchmark artifacts. Accuracy was scored manually on a 1-5 rubric for all three variants.

## Prompt variants tested

- **Baseline:** direct debugging prompt with no required response structure.
- **Prompt v2:** required `Bug`, cause, minimal fix, corrected code, and beginner explanation sections.
- **Prompt v3:** required trace-first reasoning on the shown example before the fix, with task-specific trace targets and a concise structured answer.

## Results table

| Variant | Status | Average elapsed (s) | Average generation (tokens/s) | Successful runs |
|---|---:|---:|---:|---:|
| Baseline | completed | 5.26 | 21.55 | 2/2 |
| Prompt v2 | completed | 5.71 | 21.50 | 2/2 |
| Prompt v3 | completed | 13.71 | 15.85 | 2/2 |

## Manual accuracy findings

| Variant | Runs scored | Correctness | Clarity | Beginner friendliness | Minimality | Hallucination risk | Offline usefulness |
|---|---:|---:|---:|---:|---:|---:|---:|
| Baseline | 2 | 2.50 | 3.50 | 3.00 | 2.00 | 2.50 | 3.00 |
| Prompt v2 | 2 | 2.00 | 3.00 | 2.00 | 1.50 | 2.00 | 2.50 |
| Prompt v3 | 2 | 4.00 | 4.00 | 4.00 | 4.00 | 3.00 | 4.00 |

The baseline missed the direct Python factorial defect and focused instead on negative-input validation. Its C++ answer identified the invalid `values.size()` index but did not fully present the corrected loop in the captured answer.

Prompt v2 added a useful response structure but, like the baseline, still missed the Python factorial bug and focused on negative input instead of the `factorial(0)` base case. On the C++ task it partially identified the out-of-bounds access at `values.size()`, but its explanation drifted into confusing unsigned-integer reasoning and, because the answer was truncated, it did not clearly show the corrected loop. Its manually scored correctness average of 2.00 sits between the baseline and prompt v3, so prompt v3 remains the strongest manually scored variant.

Prompt v3 correctly identified both direct bugs. Trace-first reasoning substantially improved the factorial diagnosis, but it did not eliminate reasoning errors: the Python trace incorrectly claimed that the base case recurses, and the C++ trace incorrectly described the loop as indefinite. The model therefore remains capable of producing a correct fix alongside a flawed explanation.

## Key tradeoff

The central tradeoff was correctness versus latency. Prompt v3 raised the manually scored correctness average from 2.50 to 4.00 and produced more complete fixes, but average elapsed time increased from 5.26 to 13.71 seconds and average generation speed fell from 21.55 to 15.85 tokens per second. Some of that increase reflects the larger 128-token output budget, so this experiment does not isolate prompt wording from response length.

## Limitations

- The recorded experiment covers only two tasks and one run per task and variant (the task pack is now larger but unmeasured).
- Manual scoring is subjective despite using a fixed rubric.
- Peak memory and time to first token were not measured, and prompt-processing throughput was not analyzed in the final comparison table.
- The assistant does not compile or execute suggested fixes, so incorrect reasoning is not automatically detected.
- The model still makes reasoning mistakes even when it finds the correct code change.
- Results apply only to the recorded model, quantization, hardware, and settings.

## Next steps

- Add deterministic guardrails for simple cases, such as checking factorial base cases and vector bounds against expected fixes.
- Expand the benchmark with more Python, C, and C++ defects and repeat runs to measure variability.
- Separate prompt effects from output-length effects in a controlled benchmark.
- Record peak RAM, prompt-processing speed, and time to first token.
- Retain trace-first prompting while validating each trace against the actual control flow before presenting it to a student.


