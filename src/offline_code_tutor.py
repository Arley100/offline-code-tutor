#!/usr/bin/env python3
"""Minimal offline coding tutor powered by llama.cpp."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys
from typing import Sequence

from src.benchmark import (
    BenchmarkError,
    DEFAULT_RESULTS_PATH,
    PROMPT_V2_RESULTS_PATH,
    PROMPT_V3_RESULTS_PATH,
    run_benchmark,
)
from src.runner import LlamaRunResult, run_llama_prompt
from src.report import DEFAULT_REPORT_PATH, ReportError, generate_comparison_report
from src.scoring import (
    DEFAULT_BENCHMARK_PATH,
    DEFAULT_SCORED_PATH,
    ScoringError,
    score_benchmark,
)


class TutorError(RuntimeError):
    """A user-facing setup or runtime error."""


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="offline_code_tutor.py",
        description="Debug small code snippets with a local llama.cpp model.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    ask_parser = subparsers.add_parser("ask", help="Ask a debugging question.")
    source = ask_parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--question", help="A coding or debugging question.")
    source.add_argument("--file", type=Path, help="A UTF-8 source file to inspect.")

    benchmark_parser = subparsers.add_parser(
        "benchmark", help="Run the two prompts in metadata.json and report live timings."
    )
    benchmark_parser.add_argument(
        "--variant",
        choices=("prompt_v2", "prompt_v3"),
        help="Run a named prompt experiment without overwriting the baseline artifact.",
    )
    score_parser = subparsers.add_parser(
        "score", help="Manually score an existing benchmark artifact."
    )
    score_parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_BENCHMARK_PATH,
        help="Benchmark JSON to score.",
    )
    score_parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_SCORED_PATH,
        help="Destination for the scored JSON artifact.",
    )
    subparsers.add_parser("report", help="Generate a benchmark comparison report.")
    return parser


def load_source_file(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise TutorError(f"Source file not found: {path}") from exc
    except IsADirectoryError as exc:
        raise TutorError(f"Expected a source file, but received a directory: {path}") from exc
    except UnicodeDecodeError as exc:
        raise TutorError(f"Source file is not valid UTF-8: {path}") from exc
    except OSError as exc:
        raise TutorError(f"Could not read source file {path}: {exc}") from exc


def make_prompt(question: str) -> str:
    return (
        "You are OfflineCodeTutor, a concise programming tutor. Diagnose the likely "
        "root cause, show the smallest useful correction, and finish with one learning "
        "takeaway. Do not rewrite unrelated code.\n\nStudent request:\n"
        f"{question.strip()}"
    )


def ask_model(question: str) -> LlamaRunResult:
    result = run_llama_prompt(make_prompt(question))
    if not result.ok:
        detail = result.stderr.strip()
        message = result.error_message or "llama-cli failed."
        if detail:
            message = f"{message}\n{detail}"
        raise TutorError(message)
    return result


def run_benchmark_command(variant: str | None = None) -> None:
    output_paths = {
        None: DEFAULT_RESULTS_PATH,
        "prompt_v2": PROMPT_V2_RESULTS_PATH,
        "prompt_v3": PROMPT_V3_RESULTS_PATH,
    }
    output_path = output_paths[variant]
    try:
        artifact = run_benchmark(output_path=output_path, prompt_variant=variant)
    except BenchmarkError as exc:
        raise TutorError(str(exc)) from exc
    runs = artifact["runs"]
    successful = sum(1 for run in runs if run["ok"])
    print(f"Benchmark status: {artifact['benchmark_status']} ({successful}/{len(runs)} runs succeeded)")
    for error in artifact.get("setup_errors", []):
        print(f"Setup: {error}")
    print(f"Results saved to: {output_path}")
    print("Manual accuracy: not scored")


def run_score_command(input_path: Path, output_path: Path) -> None:
    try:
        artifact = score_benchmark(input_path, output_path)
    except ScoringError as exc:
        raise TutorError(str(exc)) from exc
    print(f"Scored {len(artifact['runs'])} benchmark runs.")
    print(f"Scored results saved to: {output_path}")


def run_report_command() -> None:
    try:
        generate_comparison_report()
    except ReportError as exc:
        raise TutorError(str(exc)) from exc
    print(f"Comparison report saved to: {DEFAULT_REPORT_PATH}")


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "ask":
            if args.question is not None:
                question = args.question
            else:
                code = load_source_file(args.file)
                question = f"Debug this file ({args.file.name}):\n\n{code}"
            result = ask_model(question)
            print(result.output, end="" if result.output.endswith("\n") else "\n")
        elif args.command == "benchmark":
            run_benchmark_command(args.variant)
        elif args.command == "score":
            run_score_command(args.input, args.output)
        else:
            run_report_command()
    except TutorError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
