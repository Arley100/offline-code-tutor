# OfflineCodeTutor

OfflineCodeTutor is a deliberately small, offline-first coding assistant. It uses Python as a thin CLI around a local `llama.cpp` executable and a GGUF coding model. The initial use case is helping students inspect short Python, C, and C++ snippets on modest hardware.

> **Eligibility note:** This repository is an independent project inspired by the ADTC 2026 Laptop LLM Challenge. It is not an official ADTC submission.

OfflineCodeTutor is an independent portfolio/research project. The challenge framing influenced the constraints: offline inference, modest hardware, reproducible benchmarking, and honest tradeoff analysis.

## Repository layout

```text
OfflineCodeTutor/
├── metadata.json
├── download_model.sh
├── offline_code_tutor.py
├── SPEC.md
├── REPORT.md
├── model/                 # GGUF files are ignored by Git
├── src/
├── examples/
└── tests/
```

## Setup

Requirements:

- Python 3.9+
- A local `llama.cpp` build containing `llama-cli`
- Bash plus `curl` or `wget` for the download helper

From the repository root:

```bash
./download_model.sh
python offline_code_tutor.py --help
python -m unittest discover -s tests -v
```

If `llama-cli` is not on `PATH`, point the CLI to it:

```bash
export LLAMA_CPP_CLI=/path/to/llama-cli
```

On PowerShell, use `$env:LLAMA_CPP_CLI = "C:\\path\\to\\llama-cli.exe"`. To use a different local GGUF, set `OFFLINE_CODE_TUTOR_MODEL` to its path. Once dependencies and weights are present, normal use is fully offline.

## Usage

Ask a direct question:

```bash
python offline_code_tutor.py ask --question "Why does integer division change this result?"
```

Inspect a file:

```bash
python offline_code_tutor.py ask --file examples/buggy_factorial.py
python offline_code_tutor.py ask --file examples/vector_out_of_bounds.cpp
```

Run the two fixed evaluation prompts:

```bash
python offline_code_tutor.py benchmark
```

The benchmark prints live wall-clock timings. It intentionally does not invent accuracy, memory, or throughput figures; record those through a controlled measurement process in `REPORT.md`.

Each benchmark run writes a reproducible JSON artifact to
`results/benchmark_local.json`. Missing runtime or model prerequisites are
recorded as failed runs; manual accuracy fields remain unscored until a person
applies the rubric.

Score an existing benchmark interactively without rerunning the model:

```bash
python offline_code_tutor.py score
```

The scorer shows each cleaned answer and its expected core-fix hint, then asks
for six scores from 1 to 5 plus notes. It reads
`results/benchmark_local.json` and writes the annotated copy to
`results/benchmark_scored.json`. For `hallucination_risk`, 5 means lowest risk.

Score a prompt experiment by supplying separate input and output paths:

```bash
python offline_code_tutor.py score \
  --input results/benchmark_prompt_v3.json \
  --output results/benchmark_prompt_v3_scored.json
```

Scoring only reads and annotates JSON; it never reruns llama.cpp or overwrites
the source benchmark artifact.

Generate a concise Markdown comparison of available baseline, prompt-v2, and
prompt-v3 measurements and manual scores:

```bash
python offline_code_tutor.py report
```

The report is written to `results/benchmark_comparison.md`. Missing optional
variant or scored artifacts are shown as unavailable rather than treated as
zero measurements.

### Prompt v2 experiment

Run the same two tasks and model with a structured debugging prompt:

```bash
python offline_code_tutor.py benchmark --variant prompt_v2
```

Prompt v2 asks for the most direct bug first and requires `Bug`, `Why it
happens`, `Minimal fix`, `Corrected code`, and `Beginner explanation` sections.
It writes `results/benchmark_prompt_v2.json`; the baseline
`results/benchmark_local.json` is not overwritten.

### Prompt v3 trace-first experiment

Run the same tasks and model with a trace-first debugging prompt and a
128-token generation budget:

```bash
python offline_code_tutor.py benchmark --variant prompt_v3
```

Prompt v3 asks the model to trace `factorial(5)` or the vector loop indices
before proposing a fix. It writes `results/benchmark_prompt_v3.json` without
overwriting the baseline or prompt-v2 artifacts.

## Limitations

- The model download is roughly the size expected of a 1.5B-parameter Q4 quantization and still requires adequate disk space and memory.
- Responses can be incorrect or insecure. This version does not compile, execute, or verify suggested code.
- `llama.cpp` installation is manual and platform-specific.
- Prompt formatting and generation settings are a minimal baseline, not tuned results.
- The benchmark has two regression prompts and no automatic accuracy scoring yet.
- Peak-memory instrumentation is optional and limited. If `psutil` is installed and the platform exposes a true peak (currently `peak_wset` on Windows), each benchmark records `harness_peak_rss_bytes`: the peak resident memory of the Python benchmark *harness* process only. This is **not** the `llama-cli` child-process inference memory, so it is a lower bound. When no true-peak field is available, the field is `null` (current RSS is deliberately not substituted, since it is not a peak). If `psutil` is missing the benchmark still runs and records the memory fields as `null` with `psutil_available: false`; no memory numbers are fabricated.

The llama.cpp boundary lives in `src/runner.py`. It captures stdout, stderr,
exit status, elapsed time, and timeout failures so it can be unit-tested without
installing llama.cpp or downloading a GGUF model.

See `SPEC.md` for the runtime contract and `REPORT.md` for the evaluation plan.
