"""Testable adapter for running a local GGUF model through llama.cpp."""

from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
import shutil
import subprocess
import time
from typing import Optional


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_DIR = PROJECT_ROOT / "model"


@dataclass
class LlamaRunResult:
    ok: bool
    output: str
    stderr: str
    return_code: Optional[int]
    elapsed_seconds: float
    command: list[str]
    error_message: Optional[str] = None


def resolve_llama_cli(llama_cli_path: Optional[str] = None) -> tuple[Optional[str], str]:
    configured = llama_cli_path or os.environ.get("LLAMA_CPP_CLI")
    if configured:
        path = Path(configured).expanduser()
        if path.is_file():
            return str(path), ""
        discovered = shutil.which(configured)
        if discovered:
            return discovered, ""
        source = "llama_cli_path" if llama_cli_path else "LLAMA_CPP_CLI"
        return None, f"{source} points to a missing llama.cpp executable: {configured}"

    for name in ("llama-cli", "llama-cli.exe"):
        discovered = shutil.which(name)
        if discovered:
            return discovered, ""

    local_candidates = (
        PROJECT_ROOT / "llama-cli",
        PROJECT_ROOT / "llama-cli.exe",
        PROJECT_ROOT / "llama.cpp" / "build" / "bin" / "llama-cli",
        PROJECT_ROOT / "llama.cpp" / "build" / "bin" / "llama-cli.exe",
    )
    for candidate in local_candidates:
        if candidate.is_file():
            return str(candidate), ""

    return None, (
        "llama.cpp executable not found. Install/build llama.cpp, add llama-cli to "
        "PATH, or set LLAMA_CPP_CLI to its full path."
    )


def resolve_model(model_path: Optional[str] = None) -> tuple[Optional[Path], str]:
    configured = model_path or os.environ.get("OFFLINE_CODE_TUTOR_MODEL")
    if configured:
        path = Path(configured).expanduser()
        if path.is_file():
            return path, ""
        return None, f"GGUF model not found: {path}"

    models = sorted(DEFAULT_MODEL_DIR.glob("*.gguf"))
    if models:
        return models[0], ""
    return None, (
        f"No .gguf model found in {DEFAULT_MODEL_DIR}. Run ./download_model.sh or "
        "pass model_path."
    )


def _timeout_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode(errors="replace")
    return str(value)


def run_llama_prompt(
    prompt: str,
    model_path: Optional[str] = None,
    llama_cli_path: Optional[str] = None,
    max_tokens: int = 256,
    temperature: float = 0.2,
    timeout_seconds: int = 120,
) -> LlamaRunResult:
    """Run one prompt locally and return captured process details."""
    started = time.perf_counter()
    llama_cli, executable_error = resolve_llama_cli(llama_cli_path)
    if executable_error:
        return LlamaRunResult(
            False, "", "", None, time.perf_counter() - started, [], executable_error
        )

    model, model_error = resolve_model(model_path)
    if model_error:
        return LlamaRunResult(
            False, "", "", None, time.perf_counter() - started, [], model_error
        )

    command = [
        llama_cli,
        "-m",
        str(model),
        "-p",
        prompt,
        "-n",
        str(max_tokens),
        "--temp",
        str(temperature),
        "--single-turn",
        "--no-display-prompt",
        "--simple-io",
        "--no-warmup",
    ]
    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        elapsed = time.perf_counter() - started
        return LlamaRunResult(
            False,
            _timeout_text(exc.stdout),
            _timeout_text(exc.stderr),
            None,
            elapsed,
            command,
            f"llama-cli timed out after {timeout_seconds} seconds.",
        )
    except OSError as exc:
        return LlamaRunResult(
            False,
            "",
            "",
            None,
            time.perf_counter() - started,
            command,
            f"Could not start llama-cli: {exc}",
        )

    elapsed = time.perf_counter() - started
    ok = completed.returncode == 0
    return LlamaRunResult(
        ok=ok,
        output=completed.stdout,
        stderr=completed.stderr,
        return_code=completed.returncode,
        elapsed_seconds=elapsed,
        command=command,
        error_message=None if ok else f"llama-cli exited with status {completed.returncode}.",
    )
