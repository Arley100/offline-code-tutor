# OfflineCodeTutor challenge report

> Status: first vertical slice. Replace every `TBD — measure` marker only after running a documented experiment. Do not treat placeholders as results.

## 1. Model choice

- Candidate: Qwen2.5-Coder-1.5B-Instruct, Q4_K_M GGUF
- Download source: configured in `download_model.sh`
- Rationale: small code-specialized instruct model selected as an initial low-end-hardware candidate.
- License and redistribution review: **TBD — verify before submission**
- Final model decision: **TBD — evaluate**

## 2. Memory constraints

- Test machine and operating system: **TBD — record**
- Installed RAM: **TBD — record**
- Model file size: **TBD — measure**
- Peak resident memory during inference: **TBD — measure**
- Context-size impact: **TBD — measure**

## 3. Throughput

- `llama.cpp` version and build flags: **TBD — record**
- CPU and thread count: **TBD — record**
- Prompt processing speed: **TBD — measure (tokens/second)**
- Generation speed: **TBD — measure (tokens/second)**
- Time to first token: **TBD — measure**
- End-to-end latency for each fixed prompt: **TBD — measure**

## 4. Accuracy

- Evaluation rubric: **TBD — define before scoring**
- Python factorial diagnosis: **TBD — manually evaluate**
- C++ bounds diagnosis: **TBD — manually evaluate**
- Common failure modes: **TBD — observe and record**
- Aggregate score: **TBD — do not fill without the rubric and evidence**

## 5. Tradeoffs

- Model size versus explanation quality: **TBD — compare**
- Quantization versus memory and accuracy: **TBD — compare**
- Context length versus latency: **TBD — compare**
- Simplicity versus automatic verification: the first slice favors a small, auditable CLI and leaves code execution out of scope.

## 6. Reproduction notes

Record the exact commands, environment variables, model checksum, hardware, prompt set, and raw outputs used for final measurements here.

**TBD — complete during the benchmark ticket.**
