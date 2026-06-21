"""Reproducible local benchmark recording for OfflineCodeTutor."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import sys
from typing import Callable, Optional

from src.runner import (
    LlamaRunResult,
    resolve_llama_cli,
    resolve_model,
    run_llama_prompt,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_METADATA_PATH = PROJECT_ROOT / "metadata.json"
DEFAULT_RESULTS_PATH = PROJECT_ROOT / "results" / "benchmark_local.json"
PROMPT_V2_RESULTS_PATH = PROJECT_ROOT / "results" / "benchmark_prompt_v2.json"
PROMPT_V3_RESULTS_PATH = PROJECT_ROOT / "results" / "benchmark_prompt_v3.json"
OUTPUT_PREVIEW_CHARS = 500
CLEAN_OUTPUT_PREVIEW_CHARS = 1000


class BenchmarkError(RuntimeError):
    """A benchmark configuration or persistence error."""


def load_benchmark_prompts(path: Path = DEFAULT_METADATA_PATH) -> list[dict[str, str]]:
    try:
        metadata = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BenchmarkError(f"Could not load benchmark metadata from {path}: {exc}") from exc
    prompts = metadata.get("test_prompts")
    if not isinstance(prompts, list) or len(prompts) != 2:
        raise BenchmarkError("metadata.json must contain exactly two test_prompts.")
    for prompt in prompts:
        if not isinstance(prompt, dict) or not isinstance(prompt.get("id"), str) or not isinstance(
            prompt.get("prompt"), str
        ):
            raise BenchmarkError("Each benchmark prompt must have string id and prompt fields.")
    return prompts


def build_benchmark_prompt(
    original_prompt: str,
    variant: Optional[str] = None,
    prompt_id: Optional[str] = None,
) -> str:
    if variant is None:
        return original_prompt
    if variant == "prompt_v2":
        return (
            "Identify the most direct bug in the provided code first. Do not introduce "
            "extra issues unless they are secondary to the direct bug.\n\n"
            "Original coding problem:\n"
            f"{original_prompt.strip()}\n\n"
            "Respond using exactly this structure:\n"
            "Bug:\n"
            "Why it happens:\n"
            "Minimal fix:\n"
            "Corrected code:\n"
            "Beginner explanation:"
        )
    if variant == "prompt_v3":
        trace_targets = {
            "python-factorial-debug": (
                "Trace factorial(5) and explain why the result becomes wrong."
            ),
            "cpp-vector-bounds-debug": (
                "Trace the loop indices for values.size() == 3."
            ),
        }
        trace_target = trace_targets.get(prompt_id, "Trace the shown example.")
        return (
            "Identify the most direct bug in the provided code first. Before suggesting "
            "a fix, trace what the code does on the shown example. Do not discuss extra "
            "validation issues until after the direct bug is fixed. Keep the answer short.\n\n"
            f"Trace target: {trace_target}\n\n"
            "Original coding problem:\n"
            f"{original_prompt.strip()}\n\n"
            "Respond using exactly this structure:\n"
            "Direct bug:\n"
            "Trace:\n"
            "Why it fails:\n"
            "Minimal fix:\n"
            "Corrected code:\n"
            "One-sentence beginner explanation:"
        )
    raise BenchmarkError(f"Unknown benchmark prompt variant: {variant}")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as model_file:
        for chunk in iter(lambda: model_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def collect_hardware_metadata() -> dict[str, object]:
    total_ram_bytes = None
    try:
        import psutil  # type: ignore

        total_ram_bytes = psutil.virtual_memory().total
    except (ImportError, AttributeError, OSError):
        pass
    return {
        "python_version": sys.version,
        "platform": platform.system(),
        "machine": platform.machine(),
        "processor": platform.processor() or None,
        "cpu_count": os.cpu_count(),
        "total_ram_bytes": total_ram_bytes,
    }


def clean_llama_output(raw_output: str, prompt: str) -> str:
    """Remove common llama.cpp wrapper text while preserving the generated answer."""
    normalized_output = raw_output.replace("\r\n", "\n").replace("\r", "\n")
    normalized_prompt = prompt.replace("\r\n", "\n").replace("\r", "\n")
    for echoed_prompt in (f"> {normalized_prompt}", f">{normalized_prompt}"):
        if echoed_prompt in normalized_output:
            normalized_output = normalized_output.replace(echoed_prompt, "", 1)
            break
    cleaned_lines = []
    answer_started = False
    in_commands = False
    speed_pattern = re.compile(
        r"^\[\s*Prompt:\s*[\d.]+\s*t/s\s*\|\s*Generation:\s*[\d.]+\s*t/s\s*\]$",
        re.IGNORECASE,
    )

    for line in normalized_output.splitlines():
        stripped = line.strip()
        lower = stripped.lower()

        if speed_pattern.match(stripped) or lower == "exiting...":
            continue
        if not answer_started:
            if not stripped:
                if in_commands:
                    in_commands = False
                continue
            if lower.startswith("loading model"):
                continue
            if any(character in stripped for character in "▄▀█"):
                continue
            if re.match(r"^(build|model|modalities)\s*:", stripped, re.IGNORECASE):
                continue
            if lower == "available commands:":
                in_commands = True
                continue
            if in_commands or stripped.startswith("/"):
                continue
            if stripped.startswith(">"):
                answer_started = True
                continue
            answer_started = True
        cleaned_lines.append(line.rstrip())

    cleaned_output = "\n".join(cleaned_lines).strip()
    direct_bug_index = cleaned_output.find("Direct bug:")
    if direct_bug_index >= 0:
        cleaned_output = cleaned_output[direct_bug_index:]
    return cleaned_output


def parse_llama_timings(text: str) -> dict[str, object]:
    """Best-effort parsing for timing lines from multiple llama.cpp formats."""
    timings: dict[str, object] = {}
    speed_pattern = re.compile(
        r"\[\s*Prompt:\s*(?P<prompt>[\d.]+)\s*t/s\s*\|\s*"
        r"Generation:\s*(?P<generation>[\d.]+)\s*t/s\s*\]",
        re.IGNORECASE,
    )
    label_pattern = re.compile(
        r"(?P<label>[A-Za-z][A-Za-z _-]*?time)\s*=\s*"
        r"(?P<milliseconds>\d+(?:\.\d+)?)\s*ms",
        re.IGNORECASE,
    )
    count_pattern = re.compile(r"/\s*(?P<count>\d+)\s*(?P<unit>tokens?|runs?)", re.IGNORECASE)
    rate_pattern = re.compile(
        r"(?P<rate>\d+(?:\.\d+)?)\s*tokens?\s+per\s+second", re.IGNORECASE
    )

    for line in text.splitlines():
        speed_match = speed_pattern.search(line)
        if speed_match:
            timings["prompt_tokens_per_second"] = float(speed_match.group("prompt"))
            timings["generation_tokens_per_second"] = float(
                speed_match.group("generation")
            )
        label_match = label_pattern.search(line)
        if not label_match:
            continue
        label = label_match.group("label").lower().replace(" time", "").strip()
        key = re.sub(r"[^a-z0-9]+", "_", label).strip("_") or "timing"
        base_key = key
        suffix = 2
        while key in timings:
            key = f"{base_key}_{suffix}"
            suffix += 1

        entry: dict[str, object] = {
            "milliseconds": float(label_match.group("milliseconds")),
            "raw": line.strip(),
        }
        count_match = count_pattern.search(line)
        if count_match:
            entry["count"] = int(count_match.group("count"))
            entry["count_unit"] = count_match.group("unit").lower()
        rate_match = rate_pattern.search(line)
        if rate_match:
            entry["tokens_per_second"] = float(rate_match.group("rate"))
        timings[key] = entry
    return timings


def _generation_tokens_per_second(
    timings: dict[str, object],
) -> Optional[float]:
    generation_rate = timings.get("generation_tokens_per_second")
    if generation_rate is not None:
        return float(generation_rate)
    for key, entry in timings.items():
        if not isinstance(entry, dict):
            continue
        rate = entry.get("tokens_per_second")
        if rate is not None and "eval" in key and "prompt" not in key:
            return float(rate)
    for entry in timings.values():
        if not isinstance(entry, dict):
            continue
        rate = entry.get("tokens_per_second")
        if rate is not None:
            return float(rate)
    return None


def _display_path(path: Optional[Path]) -> Optional[str]:
    if path is None:
        return None
    try:
        return str(path.resolve().relative_to(PROJECT_ROOT.resolve()))
    except ValueError:
        return str(path)


def _model_metadata(model: Optional[Path]) -> dict[str, object]:
    if model is None or not model.is_file():
        return {"path": None, "filename": None, "sha256": None, "size_bytes": None}
    return {
        "path": _display_path(model),
        "filename": model.name,
        "sha256": sha256_file(model),
        "size_bytes": model.stat().st_size,
    }


def _run_record(
    prompt: dict[str, str], result: LlamaRunResult, effective_prompt: Optional[str] = None
) -> dict[str, object]:
    timings = parse_llama_timings(f"{result.output}\n{result.stderr}")
    clean_output = clean_llama_output(
        result.output, effective_prompt if effective_prompt is not None else prompt["prompt"]
    )
    return {
        "prompt_id": prompt["id"],
        "prompt": prompt["prompt"],
        "ok": result.ok,
        "elapsed_seconds": result.elapsed_seconds,
        "return_code": result.return_code,
        "output_chars": len(result.output),
        "stderr_chars": len(result.stderr),
        "tokens_per_second": _generation_tokens_per_second(timings),
        "llama_timings": timings,
        "error_message": result.error_message,
        "output_preview": result.output[:OUTPUT_PREVIEW_CHARS],
        "clean_output_preview": clean_output[:CLEAN_OUTPUT_PREVIEW_CHARS],
    }


def run_benchmark(
    metadata_path: Path = DEFAULT_METADATA_PATH,
    output_path: Path = DEFAULT_RESULTS_PATH,
    model_path: Optional[str] = None,
    llama_cli_path: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: float = 0.2,
    timeout_seconds: int = 120,
    prompt_variant: Optional[str] = None,
    runner: Callable[..., LlamaRunResult] = run_llama_prompt,
) -> dict[str, object]:
    prompts = load_benchmark_prompts(metadata_path)
    llama_cli, executable_error = resolve_llama_cli(llama_cli_path)
    model, model_error = resolve_model(model_path)
    effective_max_tokens = (
        max_tokens if max_tokens is not None else (128 if prompt_variant == "prompt_v3" else 64)
    )

    runs = []
    for prompt in prompts:
        effective_prompt = build_benchmark_prompt(
            prompt["prompt"], prompt_variant, prompt["id"]
        )
        result = runner(
            effective_prompt,
            model_path=str(model) if model else model_path,
            llama_cli_path=llama_cli or llama_cli_path,
            max_tokens=effective_max_tokens,
            temperature=temperature,
            timeout_seconds=timeout_seconds,
        )
        runs.append(_run_record(prompt, result, effective_prompt))

    successful_runs = sum(1 for run in runs if run["ok"])
    if successful_runs == len(runs):
        status = "completed"
    elif successful_runs:
        status = "partial"
    else:
        status = "failed"

    runtime = collect_hardware_metadata()
    runtime["llama_cli_path"] = llama_cli
    artifact: dict[str, object] = {
        "project": "OfflineCodeTutor",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "benchmark_status": status,
        "model": _model_metadata(model),
        "runtime": runtime,
        "settings": {
            "max_tokens": effective_max_tokens,
            "temperature": temperature,
            "timeout_seconds": timeout_seconds,
            "prompt_variant": prompt_variant or "baseline",
        },
        "runs": runs,
        "manual_accuracy": {
            "status": "not_scored",
            "rubric": {
                "correctness": None,
                "clarity": None,
                "beginner_friendliness": None,
                "minimality_of_fix": None,
                "hallucination_risk": None,
                "offline_usefulness": None,
            },
        },
    }
    if executable_error or model_error:
        artifact["setup_errors"] = [
            error for error in (executable_error, model_error) if error
        ]

    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    except OSError as exc:
        raise BenchmarkError(f"Could not write benchmark artifact to {output_path}: {exc}") from exc
    return artifact
