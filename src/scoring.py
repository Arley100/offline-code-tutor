"""Manual, artifact-only accuracy scoring for OfflineCodeTutor benchmarks."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Callable


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BENCHMARK_PATH = PROJECT_ROOT / "results" / "benchmark_local.json"
DEFAULT_SCORED_PATH = PROJECT_ROOT / "results" / "benchmark_scored.json"

RUBRIC_FIELDS = (
    "correctness",
    "clarity",
    "beginner_friendliness",
    "minimality_of_fix",
    "hallucination_risk",
    "offline_usefulness",
)

EXPECTED_ANSWER_HINTS = {
    "python-factorial-debug": (
        "Expected core fix:\n"
        "if n == 0:\n"
        "    return 1"
    ),
    "cpp-vector-bounds-debug": (
        "Expected core fix:\n"
        "for (std::size_t i = 0; i < values.size(); ++i)"
    ),
}


class ScoringError(RuntimeError):
    """A user-facing scoring input or artifact error."""


def load_benchmark_artifact(path: Path = DEFAULT_BENCHMARK_PATH) -> dict[str, object]:
    try:
        artifact = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ScoringError(
            f"Benchmark artifact not found: {path}. Run the benchmark command first."
        ) from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise ScoringError(f"Could not read benchmark artifact {path}: {exc}") from exc
    if not isinstance(artifact, dict) or not isinstance(artifact.get("runs"), list):
        raise ScoringError("Benchmark artifact must contain a runs list.")
    if not artifact["runs"]:
        raise ScoringError("Benchmark artifact contains no runs to score.")
    return artifact


def validate_score(value: object) -> int:
    if isinstance(value, bool):
        raise ScoringError("Scores must be whole numbers from 1 to 5.")
    try:
        score = int(value)
    except (TypeError, ValueError) as exc:
        raise ScoringError("Scores must be whole numbers from 1 to 5.") from exc
    if str(value).strip() != str(score) or not 1 <= score <= 5:
        raise ScoringError("Scores must be whole numbers from 1 to 5.")
    return score


def validate_manual_score(score: dict[str, object]) -> dict[str, object]:
    validated: dict[str, object] = {}
    for field in RUBRIC_FIELDS:
        if field not in score:
            raise ScoringError(f"Missing manual score: {field}")
        validated[field] = validate_score(score[field])
    notes = score.get("notes", "")
    if not isinstance(notes, str):
        raise ScoringError("Scoring notes must be a string.")
    validated["notes"] = notes
    return validated


def interactive_score_provider(
    run: dict[str, object],
    hint: str,
    input_func: Callable[[str], str] = input,
    output_func: Callable[[str], None] = print,
) -> dict[str, object]:
    output_func("\n" + "=" * 72)
    output_func(f"Run: {run.get('prompt_id', 'unknown')}")
    output_func(f"Prompt:\n{run.get('prompt', '')}")
    output_func(f"\nModel answer:\n{run.get('clean_output_preview', '')}")
    output_func(f"\n{hint or 'No expected-answer hint is available for this run.'}")
    output_func("\nScore each category from 1 (weak/high risk) to 5 (strong/low risk).")

    score: dict[str, object] = {}
    for field in RUBRIC_FIELDS:
        label = field.replace("_", " ")
        while True:
            raw_value = input_func(f"{label} (1-5): ")
            try:
                score[field] = validate_score(raw_value)
                break
            except ScoringError as exc:
                output_func(f"Invalid score: {exc}")
    score["notes"] = input_func("notes: ")
    return score


def score_benchmark(
    input_path: Path = DEFAULT_BENCHMARK_PATH,
    output_path: Path = DEFAULT_SCORED_PATH,
    score_provider: Callable[[dict[str, object], str], dict[str, object]] = interactive_score_provider,
) -> dict[str, object]:
    """Annotate an existing artifact without importing or invoking inference code."""
    artifact = load_benchmark_artifact(input_path)
    runs = artifact["runs"]
    for run in runs:
        if not isinstance(run, dict):
            raise ScoringError("Each benchmark run must be a JSON object.")
        prompt_id = str(run.get("prompt_id", ""))
        hint = EXPECTED_ANSWER_HINTS.get(prompt_id, "")
        run["manual_score"] = validate_manual_score(score_provider(run, hint))

    existing_accuracy = artifact.get("manual_accuracy")
    manual_accuracy = dict(existing_accuracy) if isinstance(existing_accuracy, dict) else {}
    manual_accuracy["status"] = "scored"
    manual_accuracy["scored_at_utc"] = datetime.now(timezone.utc).isoformat()
    manual_accuracy["scale"] = "1-5; for hallucination_risk, 5 means lowest risk"
    artifact["manual_accuracy"] = manual_accuracy

    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    except OSError as exc:
        raise ScoringError(f"Could not write scored artifact to {output_path}: {exc}") from exc
    return artifact

