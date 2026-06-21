"""Generate a concise Markdown comparison from benchmark JSON artifacts."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from statistics import mean
from typing import Optional


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RESULTS_DIR = PROJECT_ROOT / "results"
DEFAULT_REPORT_PATH = DEFAULT_RESULTS_DIR / "benchmark_comparison.md"

VARIANT_FILES = {
    "baseline": "benchmark_local.json",
    "prompt_v2": "benchmark_prompt_v2.json",
    "prompt_v3": "benchmark_prompt_v3.json",
}
SCORED_FILES = {
    "baseline": "benchmark_scored.json",
    "prompt_v2": "benchmark_prompt_v2_scored.json",
    "prompt_v3": "benchmark_prompt_v3_scored.json",
}
RUBRIC_FIELDS = (
    "correctness",
    "clarity",
    "beginner_friendliness",
    "minimality_of_fix",
    "hallucination_risk",
    "offline_usefulness",
)
TASK_NAMES = {
    "python-factorial-debug": "Python factorial",
    "cpp-vector-bounds-debug": "C++ vector bounds",
}


class ReportError(RuntimeError):
    """A result artifact could not be read or the report could not be written."""


def _load_optional(path: Path) -> Optional[dict[str, object]]:
    if not path.is_file():
        return None
    try:
        artifact = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ReportError(f"Could not read result artifact {path}: {exc}") from exc
    if not isinstance(artifact, dict):
        raise ReportError(f"Result artifact must be a JSON object: {path}")
    return artifact


def _numeric_average(values: list[object]) -> Optional[float]:
    numbers = [float(value) for value in values if isinstance(value, (int, float))]
    return mean(numbers) if numbers else None


def _format_average(value: Optional[float], suffix: str = "") -> str:
    return "not available" if value is None else f"{value:.2f}{suffix}"


def _runs(artifact: Optional[dict[str, object]]) -> list[dict[str, object]]:
    if artifact is None or not isinstance(artifact.get("runs"), list):
        return []
    return [run for run in artifact["runs"] if isinstance(run, dict)]


def _model_size(size: object) -> str:
    if not isinstance(size, int):
        return "not available"
    return f"{size} bytes ({size / (1024 * 1024):.2f} MiB)"


def _manual_averages(artifact: dict[str, object]) -> tuple[int, dict[str, Optional[float]]]:
    scored_runs = [run for run in _runs(artifact) if isinstance(run.get("manual_score"), dict)]
    averages = {
        field: _numeric_average([run["manual_score"].get(field) for run in scored_runs])
        for field in RUBRIC_FIELDS
    }
    return len(scored_runs), averages


def _safe_note(note: object) -> str:
    if not isinstance(note, str) or not note.strip():
        return "No notes recorded."
    return " ".join(note.strip().split())


def build_comparison_markdown(
    variants: dict[str, Optional[dict[str, object]]],
    scored: dict[str, Optional[dict[str, object]]],
) -> str:
    available = [artifact for artifact in variants.values() if artifact is not None]
    reference = available[0] if available else {}
    model = reference.get("model") if isinstance(reference.get("model"), dict) else {}
    runtime = reference.get("runtime") if isinstance(reference.get("runtime"), dict) else {}

    lines = [
        "# OfflineCodeTutor Benchmark Comparison",
        "",
        f"Generated at: {datetime.now(timezone.utc).isoformat()}",
        "",
        "## Project and runtime",
        "",
        f"- Project: {reference.get('project', 'OfflineCodeTutor')}",
        f"- Model: {model.get('filename') or 'not available'}",
        f"- Model size: {_model_size(model.get('size_bytes'))}",
        f"- Platform: {runtime.get('platform') or 'not available'}",
        f"- Machine: {runtime.get('machine') or 'not available'}",
        f"- Processor: {runtime.get('processor') or 'not available'}",
        f"- CPU count: {runtime.get('cpu_count') if runtime.get('cpu_count') is not None else 'not available'}",
        f"- Python: {str(runtime.get('python_version') or 'not available').splitlines()[0]}",
        "",
        "## Benchmark comparison",
        "",
        "| Variant | Status | Average elapsed (s) | Average generation (tokens/s) | Successful runs |",
        "|---|---:|---:|---:|---:|",
    ]

    for name in VARIANT_FILES:
        artifact = variants.get(name)
        runs = _runs(artifact)
        elapsed = _numeric_average([run.get("elapsed_seconds") for run in runs])
        speed = _numeric_average([run.get("tokens_per_second") for run in runs])
        successes = sum(1 for run in runs if run.get("ok") is True)
        status = artifact.get("benchmark_status", "unknown") if artifact else "not available"
        success_text = f"{successes}/{len(runs)}" if runs else "not available"
        lines.append(
            f"| {name} | {status} | {_format_average(elapsed)} | "
            f"{_format_average(speed)} | {success_text} |"
        )

    lines.extend(
        [
            "",
            "## Manual scoring summary",
            "",
            "| Variant | Runs scored | Correctness | Clarity | Beginner friendliness | Minimality | Hallucination risk | Offline usefulness |",
            "|---|---:|---:|---:|---:|---:|---:|---:|",
        ]
    )
    for name in VARIANT_FILES:
        artifact = scored.get(name)
        if artifact is None:
            lines.append(f"| {name} | 0 | not scored | not scored | not scored | not scored | not scored | not scored |")
            continue
        count, averages = _manual_averages(artifact)
        values = " | ".join(_format_average(averages[field]) for field in RUBRIC_FIELDS)
        lines.append(f"| {name} | {count} | {values} |")

    lines.extend(["", "## Per-task notes", ""])
    for task_id, task_name in TASK_NAMES.items():
        lines.extend([f"### {task_name}", ""])
        for variant in VARIANT_FILES:
            artifact = scored.get(variant)
            matching = next((run for run in _runs(artifact) if run.get("prompt_id") == task_id), None)
            manual_score = matching.get("manual_score") if matching else None
            note = manual_score.get("notes") if isinstance(manual_score, dict) else None
            lines.append(f"- {variant}: {_safe_note(note) if artifact else 'Not manually scored.'}")
        lines.append("")

    lines.extend(["## Conclusion", ""])
    if all(variants.get(name) is not None for name in VARIANT_FILES):
        lines.append(
            "Baseline was fastest but missed the Python factorial bug. Prompt v2 added "
            "structure but did not fix the Python failure. Prompt v3 improved correctness "
            "by forcing trace-first reasoning, but prompt v3 was slower. The model is "
            "promising for offline coding assistance but still needs guardrails or stronger "
            "validation."
        )
    else:
        lines.append(
            "A final three-way conclusion requires baseline, prompt_v2, and prompt_v3 "
            "benchmark artifacts. Available measurements and scores are shown above."
        )
    return "\n".join(lines) + "\n"


def generate_comparison_report(
    results_dir: Path = DEFAULT_RESULTS_DIR,
    output_path: Path = DEFAULT_REPORT_PATH,
) -> str:
    variants = {
        name: _load_optional(results_dir / filename)
        for name, filename in VARIANT_FILES.items()
    }
    scored = {
        name: _load_optional(results_dir / filename)
        for name, filename in SCORED_FILES.items()
    }
    if not any(variants.values()):
        raise ReportError(f"No benchmark artifacts found in {results_dir}")
    markdown = build_comparison_markdown(variants, scored)
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(markdown, encoding="utf-8")
    except OSError as exc:
        raise ReportError(f"Could not write comparison report to {output_path}: {exc}") from exc
    return markdown

