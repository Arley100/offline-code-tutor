# OfflineCodeTutor specification

## Purpose

OfflineCodeTutor is a small command-line assistant that helps students debug short Python, C, and C++ snippets on a low-end laptop. It sends a focused tutoring prompt to a local GGUF model through the `llama.cpp` command-line runner. After the one-time model download and `llama.cpp` installation, inference requires no network connection.

## First vertical slice

The first version provides three commands:

- `ask --question "..."` asks a direct debugging question.
- `ask --file path/to/code.py` loads a source file and asks the model to inspect it.
- `benchmark` runs the benchmark task pack defined in `metadata.json` (a set of stable, versioned tasks) and prints measured latency and generated output. It does not claim accuracy or performance results in advance. `--repeats N` runs each task N times; `--max-tokens N` sets an explicit generation budget.

## Runtime contract

- Python 3.9 or newer runs the CLI; the application has no third-party Python dependencies.
- `llama-cli` must be installed and available on `PATH`, or its location must be supplied through `LLAMA_CPP_CLI`.
- The default GGUF must exist at `model/Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf`; `OFFLINE_CODE_TUTOR_MODEL` can override that path.
- Model weights remain in the Git-ignored `model/` directory.
- Generation uses conservative defaults intended for CPU inference: a 2048-token context and at most 512 generated tokens.

## Tutor behavior

The system prompt asks for a concise explanation, the likely root cause, a minimal corrected snippet, and one learning takeaway. It asks the model not to rewrite unrelated code. Model output is advisory: students must compile or run suggested fixes themselves.

## Out of scope for this slice

- Web UI, editor integration, code execution, compilation, and sandboxing
- Conversation history, retrieval, telemetry, and automatic scoring
- Automatic hardware tuning or downloading/building `llama.cpp`
- Claims about throughput, memory use, or correctness before measurement

## Acceptance criteria

- Both `ask` input modes parse correctly and reject ambiguous input.
- File input is loaded as UTF-8 with a useful error on failure.
- Missing `llama-cli` and missing model weights produce clear setup guidance.
- The benchmark uses the versioned task pack in `metadata.json` and reports only measurements from the current run. Task ids are stable; per-task metadata in artifacts is additive and optional.
- Unit tests cover argument parsing and file loading without requiring a model.

