# OfflineCodeTutor Benchmark Comparison

Generated at: 2026-06-21T05:48:26.654848+00:00

## Project and runtime

- Project: OfflineCodeTutor
- Model: Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf
- Model size: 986048800 bytes (940.37 MiB)
- Platform: Windows
- Machine: AMD64
- Processor: AMD64 Family 25 Model 80 Stepping 0, AuthenticAMD
- CPU count: 16
- Python: 3.12.10 (tags/v3.12.10:0cc8128, Apr  8 2025, 12:21:36) [MSC v.1943 64 bit (AMD64)]

## Benchmark comparison

| Variant | Status | Average elapsed (s) | Average generation (tokens/s) | Successful runs |
|---|---:|---:|---:|---:|
| baseline | completed | 5.26 | 21.55 | 2/2 |
| prompt_v2 | completed | 5.71 | 21.50 | 2/2 |
| prompt_v3 | completed | 13.71 | 15.85 | 2/2 |

## Manual scoring summary

| Variant | Runs scored | Correctness | Clarity | Beginner friendliness | Minimality | Hallucination risk | Offline usefulness |
|---|---:|---:|---:|---:|---:|---:|---:|
| baseline | 2 | 2.50 | 3.50 | 3.00 | 2.00 | 2.50 | 3.00 |
| prompt_v2 | 0 | not scored | not scored | not scored | not scored | not scored | not scored |
| prompt_v3 | 2 | 4.00 | 4.00 | 4.00 | 4.00 | 3.00 | 4.00 |

## Per-task notes

### Python factorial

- baseline: The answer is clear but misses the main bug. The expected fix is that factorial(0) should return 1, not 0. The model instead focused on negative input, which is related to input validation but not the defect shown in the code.
- prompt_v2: Not manually scored.
- prompt_v3: The answer correctly identifies the direct bug: factorial(0) returns 0 but should return 1. It also states the expected core fix. However, the trace contains an incorrect claim that when n is 0 the function calls factorial(n - 1); in reality, the function returns 0 immediately. Overall, prompt v3 substantially improves correctness compared with baseline and prompt v2.

### C++ vector bounds

- baseline: The answer correctly identifies that values.size() is out of bounds because valid indices are 0, 1, and 2. The ideal minimal fix is changing <= to < in the loop condition. The answer is useful but incomplete because it does not fully show the corrected loop in the captured preview.
- prompt_v2: Not manually scored.
- prompt_v3: The answer correctly identifies that i <= values.size() allows i == values.size(), which causes an out-of-bounds vector access. The ideal fix is changing <= to <. However, the trace incorrectly says the loop runs indefinitely; it actually reaches an invalid index and then would stop after i increments past size if execution continues.

## Conclusion

Baseline was fastest but missed the Python factorial bug. Prompt v2 added structure but did not fix the Python failure. Prompt v3 improved correctness by forcing trace-first reasoning, but prompt v3 was slower. The model is promising for offline coding assistance but still needs guardrails or stronger validation.
