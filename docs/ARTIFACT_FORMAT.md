# Benchmark Artifact Format

This documents the JSON the OfflineCodeTutor CLI writes today, so that the future
EvalForge importer has a precise contract. The CLI is the source of truth; if the
two ever disagree, the CLI wins and this document is updated.

## Files and variants

Each benchmark variant writes its own file under `results/`. Scoring reads a
benchmark file and writes a separate `_scored` copy without overwriting the
source.

| Variant     | Benchmark file                     | Scored file                          | Notes                                  |
|-------------|------------------------------------|--------------------------------------|----------------------------------------|
| `baseline`  | `results/benchmark_local.json`     | `results/benchmark_scored.json`      | No required answer structure.          |
| `prompt_v2` | `results/benchmark_prompt_v2.json` | `results/benchmark_prompt_v2_scored.json` | Structured sections; 64-token budget. |
| `prompt_v3` | `results/benchmark_prompt_v3.json` | `results/benchmark_prompt_v3_scored.json` | Trace-first; 128-token budget.        |

The `settings.prompt_variant` field inside the artifact is the authoritative
variant label (`baseline`, `prompt_v2`, or `prompt_v3`); importers should not rely
on the filename alone.

## Top-level object

```jsonc
{
  "project": "OfflineCodeTutor",
  "created_at_utc": "2026-06-20T16:43:29.881838+00:00",  // ISO 8601 UTC
  "benchmark_status": "completed",   // "completed" | "partial" | "failed"
  "model": { ... },
  "runtime": { ... },
  "settings": { ... },
  "runs": [ ... ],
  "manual_accuracy": { ... },
  "setup_errors": [ "..." ]          // OPTIONAL; present only on missing prereqs
}
```

### `model`
```jsonc
{
  "path": "model/Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf", // or null
  "filename": "Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf",   // or null
  "sha256": "f530705d...23b239",                            // or null
  "size_bytes": 986048800                                   // or null
}
```
All four fields are `null` when no model was resolved (a failed run). `sha256`
pins the exact weights and is the key field for reproducibility.

### `runtime`
```jsonc
{
  "python_version": "3.12.10 ...",
  "platform": "Windows",
  "machine": "AMD64",
  "processor": "AMD64 Family 25 ...",   // or null
  "cpu_count": 16,                       // or null
  "total_ram_bytes": null,               // null unless psutil available
  "psutil_available": false,             // bool
  "memory_measurement_scope": "harness_process", // constant descriptor
  "harness_peak_rss_bytes": null,        // null unless a true peak is exposed
  "llama_cli_path": "C:\\...\\llama-cli.EXE" // or null
}
```
Memory fields are intentionally conservative: `harness_peak_rss_bytes` measures
the benchmark **harness** process, not the `llama-cli` child, and is `null` when
no true peak is available. Importers must treat `null` as "unavailable," never 0.

### `settings`
```jsonc
{
  "max_tokens": 64,            // 64 for baseline/prompt_v2, 128 for prompt_v3
  "temperature": 0.2,
  "timeout_seconds": 120,
  "prompt_variant": "prompt_v2" // "baseline" | "prompt_v2" | "prompt_v3"
}
```

### `runs[]`
One entry per benchmark task (currently two).
```jsonc
{
  "prompt_id": "python-factorial-debug",  // stable task id
  "prompt": "Find the bug ...",            // original task prompt
  "ok": true,                              // bool: run succeeded
  "elapsed_seconds": 5.837,                // wall-clock
  "return_code": 0,                        // or null on timeout/spawn failure
  "output_chars": 1447,
  "stderr_chars": 0,
  "tokens_per_second": 21.5,               // generation rate, or null if unknown
  "llama_timings": { ... },                // best-effort parsed timings, may be {}
  "error_message": null,                   // string when ok is false
  "output_preview": "...",                 // raw, capped at 500 chars
  "clean_output_preview": "...",           // cleaned answer, capped at 1000 chars
  "manual_score": { ... }                  // OPTIONAL; present only after scoring
}
```

### `runs[].manual_score` (after scoring)
```jsonc
{
  "correctness": 2,
  "clarity": 3,
  "beginner_friendliness": 2,
  "minimality_of_fix": 1,
  "hallucination_risk": 2,    // reversed: 5 = lowest risk
  "offline_usefulness": 2,
  "notes": "Free-text rationale."
}
```

### `manual_accuracy`
```jsonc
{
  "status": "not_scored",     // "not_scored" before scoring; "scored" after
  "rubric": {                 // top-level placeholder; per-run scores are authoritative
    "correctness": null, "clarity": null, "beginner_friendliness": null,
    "minimality_of_fix": null, "hallucination_risk": null, "offline_usefulness": null
  },
  "scored_at_utc": "2026-06-20T16:39:04+00:00",  // added when scored
  "scale": "1-5; for hallucination_risk, 5 means lowest risk" // added when scored
}
```
Note: the top-level `rubric` block stays `null`; the real scores live on each run
under `manual_score`. Aggregate by reading `runs[].manual_score`, not this block.

## How future imports should validate artifacts

A V1 importer should be strict about structure and lenient about optional data:

1. **Required top-level keys:** `project`, `created_at_utc`, `benchmark_status`,
   `model`, `runtime`, `settings`, `runs`, `manual_accuracy`. Reject the file with
   a clear error if any are missing or of the wrong type.
2. **`runs` must be a non-empty list of objects**, each with at least `prompt_id`,
   `prompt`, and `ok`. Reject otherwise.
3. **Variant must be recognized:** `settings.prompt_variant` in
   {`baseline`, `prompt_v2`, `prompt_v3`}. Unknown variants are imported but
   flagged, not silently coerced.
4. **Scored vs unscored:** a run is scored only if it has a complete
   `manual_score` (all six integer dimensions 1–5 plus `notes`). A partially
   scored run is treated as unscored and flagged.
5. **Validation, not mutation:** the importer reads and validates; it never edits
   the source artifact. (This mirrors the CLI's scoring rule.)

## Missing optional fields

Optional or unavailable fields must be surfaced as **"unavailable," never as 0**:

- `tokens_per_second: null`, `total_ram_bytes: null`,
  `harness_peak_rss_bytes: null`, and empty `llama_timings: {}` mean *not
  measured*, not *measured as zero*.
- A missing `manual_score` means *not scored*, not *scored zero*.
- A missing scored file for a variant means *no scores yet*, not *all zeros*.

Treating unavailable data as zero would fabricate evidence and silently bias
comparisons. This is a hard rule for both the CLI report generator and any future
importer.
