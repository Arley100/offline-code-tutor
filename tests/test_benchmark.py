import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from src import benchmark
from src.benchmark import (
    build_benchmark_prompt,
    clean_llama_output,
    collect_hardware_metadata,
    parse_llama_timings,
    run_benchmark,
    sha256_file,
)
from src.runner import LlamaRunResult


class _FakeMemoryInfo:
    def __init__(self, peak_wset=None, rss=None):
        if peak_wset is not None:
            self.peak_wset = peak_wset
        self.rss = rss


class _FakeProcess:
    def __init__(self, memory_info):
        self._memory_info = memory_info

    def memory_info(self):
        return self._memory_info


class _FakePsutil:
    """Minimal psutil stand-in so tests do not depend on psutil being installed."""

    Error = Exception

    def __init__(self, total_ram=8 * 1024**3, memory_info=None):
        self._total_ram = total_ram
        self._memory_info = memory_info or _FakeMemoryInfo(peak_wset=123_456_789)

    def virtual_memory(self):
        return mock.Mock(total=self._total_ram)

    def Process(self):
        return _FakeProcess(self._memory_info)


class BenchmarkTests(unittest.TestCase):
    def _write_metadata(self, directory: str) -> Path:
        path = Path(directory) / "metadata.json"
        path.write_text(
            json.dumps(
                {
                    "test_prompts": [
                        {"id": "prompt_1", "prompt": "First prompt"},
                        {"id": "prompt_2", "prompt": "Second prompt"},
                    ]
                }
            ),
            encoding="utf-8",
        )
        return path

    def _fake_file(self, directory: str, name: str, content: bytes = b"placeholder") -> Path:
        path = Path(directory) / name
        path.write_bytes(content)
        return path

    def test_creates_benchmark_json_without_inventing_throughput(self):
        with tempfile.TemporaryDirectory() as directory:
            metadata = self._write_metadata(directory)
            model = self._fake_file(directory, "tiny.gguf", b"fake model")
            executable = self._fake_file(directory, "llama-cli")
            output_path = Path(directory) / "results" / "benchmark_local.json"
            received_settings = []

            def fake_runner(prompt, **kwargs):
                received_settings.append(kwargs)
                return LlamaRunResult(
                    True, "x" * 1200, "no timing information", 0, 1.25, ["fake"]
                )

            artifact = run_benchmark(
                metadata_path=metadata,
                output_path=output_path,
                model_path=str(model),
                llama_cli_path=str(executable),
                runner=fake_runner,
            )
            saved = json.loads(output_path.read_text(encoding="utf-8"))

        self.assertTrue(output_path.parent.name == "results")
        self.assertEqual(artifact["benchmark_status"], "completed")
        self.assertEqual(len(saved["runs"]), 2)
        self.assertEqual(saved["settings"]["max_tokens"], 64)
        self.assertTrue(all(call["max_tokens"] == 64 for call in received_settings))
        self.assertIsNone(saved["runs"][0]["tokens_per_second"])
        self.assertEqual(saved["runs"][0]["llama_timings"], {})
        self.assertEqual(len(saved["runs"][0]["output_preview"]), 500)
        self.assertEqual(len(saved["runs"][0]["clean_output_preview"]), 1000)
        self.assertEqual(saved["manual_accuracy"]["status"], "not_scored")
        self.assertIsNone(saved["manual_accuracy"]["rubric"]["correctness"])

    def test_missing_model_and_executable_write_failed_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            metadata = self._write_metadata(directory)
            output_path = Path(directory) / "benchmark.json"
            artifact = run_benchmark(
                metadata_path=metadata,
                output_path=output_path,
                model_path=str(Path(directory) / "missing.gguf"),
                llama_cli_path=str(Path(directory) / "missing-llama-cli"),
            )

            self.assertTrue(output_path.is_file())

        self.assertEqual(artifact["benchmark_status"], "failed")
        self.assertIsNone(artifact["model"]["path"])
        self.assertIsNone(artifact["runtime"]["llama_cli_path"])
        self.assertEqual(len(artifact["runs"]), 2)
        self.assertTrue(all(not run["ok"] for run in artifact["runs"]))
        self.assertEqual(len(artifact["setup_errors"]), 2)

    def test_sha256_calculation_for_model_file(self):
        with tempfile.TemporaryDirectory() as directory:
            content = b"not a real gguf model"
            model = self._fake_file(directory, "fake.gguf", content)
            digest = sha256_file(model)

        self.assertEqual(digest, hashlib.sha256(content).hexdigest())

    def test_hardware_metadata_does_not_crash(self):
        metadata = collect_hardware_metadata()

        self.assertIn("python_version", metadata)
        self.assertIn("platform", metadata)
        self.assertIn("machine", metadata)
        self.assertIn("processor", metadata)
        self.assertIn("cpu_count", metadata)
        self.assertIn("total_ram_bytes", metadata)
        self.assertIn("psutil_available", metadata)
        self.assertIn("memory_measurement_scope", metadata)
        self.assertIn("harness_peak_rss_bytes", metadata)
        self.assertEqual(metadata["memory_measurement_scope"], "harness_process")

    def test_memory_fields_null_when_psutil_missing(self):
        with mock.patch.object(benchmark, "_load_psutil", return_value=None):
            metadata = collect_hardware_metadata()

        self.assertFalse(metadata["psutil_available"])
        self.assertIsNone(metadata["total_ram_bytes"])
        self.assertIsNone(metadata["harness_peak_rss_bytes"])
        # Scope is always present so a null value is unambiguous.
        self.assertEqual(metadata["memory_measurement_scope"], "harness_process")

    def test_records_harness_peak_rss_when_psutil_available(self):
        fake = _FakePsutil(
            total_ram=16 * 1024**3,
            memory_info=_FakeMemoryInfo(peak_wset=123_456_789, rss=1),
        )
        with mock.patch.object(benchmark, "_load_psutil", return_value=fake):
            metadata = collect_hardware_metadata()

        self.assertTrue(metadata["psutil_available"])
        self.assertEqual(metadata["total_ram_bytes"], 16 * 1024**3)
        # Reports the real measured peak, not a fabricated number.
        self.assertEqual(metadata["harness_peak_rss_bytes"], 123_456_789)
        self.assertEqual(metadata["memory_measurement_scope"], "harness_process")

    def test_harness_peak_rss_is_none_without_true_peak_field(self):
        # No peak_wset available (e.g. non-Windows): current rss must NOT be
        # reported as peak, so the field stays null even though psutil is present.
        fake = _FakePsutil(memory_info=_FakeMemoryInfo(rss=777))
        with mock.patch.object(benchmark, "_load_psutil", return_value=fake):
            metadata = collect_hardware_metadata()

        self.assertTrue(metadata["psutil_available"])
        self.assertIsNone(metadata["harness_peak_rss_bytes"])

    def test_benchmark_artifact_includes_memory_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            metadata = self._write_metadata(directory)
            model = self._fake_file(directory, "tiny.gguf")
            executable = self._fake_file(directory, "llama-cli")

            def fake_runner(prompt, **kwargs):
                return LlamaRunResult(True, "answer", "", 0, 1.0, ["fake"])

            with mock.patch.object(benchmark, "_load_psutil", return_value=None):
                artifact = run_benchmark(
                    metadata_path=metadata,
                    output_path=Path(directory) / "benchmark.json",
                    model_path=str(model),
                    llama_cli_path=str(executable),
                    runner=fake_runner,
                )

        runtime = artifact["runtime"]
        self.assertFalse(runtime["psutil_available"])
        self.assertIsNone(runtime["harness_peak_rss_bytes"])
        self.assertEqual(runtime["memory_measurement_scope"], "harness_process")

    def test_parses_llama_cpp_timing_stderr(self):
        stderr = """
llama_perf_context_print: prompt eval time = 1082.45 ms / 11 tokens (98.40 ms per token, 10.16 tokens per second)
llama_perf_context_print: eval time = 5978.87 ms / 17 runs (351.70 ms per token, 2.84 tokens per second)
llama_perf_context_print: total time = 7061.32 ms / 28 tokens
"""
        timings = parse_llama_timings(stderr)

        self.assertEqual(timings["prompt_eval"]["milliseconds"], 1082.45)
        self.assertEqual(timings["prompt_eval"]["count"], 11)
        self.assertEqual(timings["prompt_eval"]["tokens_per_second"], 10.16)
        self.assertEqual(timings["eval"]["tokens_per_second"], 2.84)
        self.assertEqual(timings["total"]["milliseconds"], 7061.32)

    def test_cleans_banner_prompt_timing_and_exit_but_preserves_answer(self):
        prompt = "Find the bug in factorial."
        raw_output = """
Loading model...

▄▄ ▄▄
██ ██
build      : test-build
model      : model/test.gguf
modalities : text

available commands:
  /exit or Ctrl+C     stop or exit

> Find the bug in factorial.
The base case should return 1, because 0! equals 1.

Change `return 0` to `return 1`.
[ Prompt: 127.7 t/s | Generation: 20.9 t/s ]
Exiting...
"""
        cleaned = clean_llama_output(raw_output, prompt)

        self.assertEqual(
            cleaned,
            "The base case should return 1, because 0! equals 1.\n\n"
            "Change `return 0` to `return 1`.",
        )
        self.assertNotIn("Loading model", cleaned)
        self.assertNotIn("Prompt:", cleaned)

    def test_parses_bracketed_prompt_and_generation_speed(self):
        timings = parse_llama_timings(
            "answer text\n[ Prompt: 127.7 t/s | Generation: 20.9 t/s ]\n"
        )

        self.assertEqual(timings["prompt_tokens_per_second"], 127.7)
        self.assertEqual(timings["generation_tokens_per_second"], 20.9)

    def test_benchmark_parses_generation_speed_from_stdout(self):
        with tempfile.TemporaryDirectory() as directory:
            metadata = self._write_metadata(directory)
            model = self._fake_file(directory, "tiny.gguf")
            executable = self._fake_file(directory, "llama-cli")

            def fake_runner(prompt, **kwargs):
                output = f"Answer for {prompt}\n[ Prompt: 127.7 t/s | Generation: 20.9 t/s ]"
                return LlamaRunResult(True, output, "", 0, 1.0, ["fake"])

            artifact = run_benchmark(
                metadata_path=metadata,
                output_path=Path(directory) / "benchmark.json",
                model_path=str(model),
                llama_cli_path=str(executable),
                runner=fake_runner,
            )

        self.assertEqual(artifact["runs"][0]["tokens_per_second"], 20.9)
        self.assertEqual(
            artifact["runs"][0]["llama_timings"]["generation_tokens_per_second"],
            20.9,
        )
        self.assertEqual(artifact["runs"][0]["clean_output_preview"], "Answer for First prompt")

    def test_prompt_v2_contains_required_structure_and_original_problem(self):
        original = "Find the bug in this example."
        prompt = build_benchmark_prompt(original, "prompt_v2")

        self.assertIn(original, prompt)
        self.assertIn("Identify the most direct bug", prompt)
        self.assertIn("Bug:", prompt)
        self.assertIn("Why it happens:", prompt)
        self.assertIn("Minimal fix:", prompt)
        self.assertIn("Corrected code:", prompt)
        self.assertIn("Beginner explanation:", prompt)

    def test_prompt_v2_is_sent_to_runner_and_recorded_as_variant(self):
        with tempfile.TemporaryDirectory() as directory:
            metadata = self._write_metadata(directory)
            model = self._fake_file(directory, "tiny.gguf")
            executable = self._fake_file(directory, "llama-cli")
            received_prompts = []

            def fake_runner(prompt, **kwargs):
                received_prompts.append(prompt)
                return LlamaRunResult(True, "Structured answer", "", 0, 1.0, ["fake"])

            artifact = run_benchmark(
                metadata_path=metadata,
                output_path=Path(directory) / "benchmark_prompt_v2.json",
                model_path=str(model),
                llama_cli_path=str(executable),
                prompt_variant="prompt_v2",
                runner=fake_runner,
            )

        self.assertEqual(len(received_prompts), 2)
        self.assertTrue(all("Identify the most direct bug" in item for item in received_prompts))
        self.assertEqual(artifact["settings"]["prompt_variant"], "prompt_v2")
        self.assertEqual(artifact["settings"]["max_tokens"], 64)
        self.assertEqual(artifact["runs"][0]["prompt"], "First prompt")

    def test_cleaner_preserves_prompt_v2_answer_headings(self):
        prompt = build_benchmark_prompt("Find the bug.", "prompt_v2")
        answer = (
            "Bug:\nWrong base case.\nWhy it happens:\nZero factorial is one.\n"
            "Minimal fix:\nReturn one."
        )

        self.assertEqual(clean_llama_output(answer, prompt), answer)

    def test_prompt_v3_contains_trace_first_structure_and_task_targets(self):
        python_prompt = build_benchmark_prompt(
            "Debug factorial.", "prompt_v3", "python-factorial-debug"
        )
        cpp_prompt = build_benchmark_prompt(
            "Debug vector.", "prompt_v3", "cpp-vector-bounds-debug"
        )

        for prompt in (python_prompt, cpp_prompt):
            self.assertIn("Identify the most direct bug", prompt)
            self.assertIn("Do not discuss extra validation issues", prompt)
            self.assertIn("Direct bug:", prompt)
            self.assertIn("Trace:", prompt)
            self.assertIn("Why it fails:", prompt)
            self.assertIn("Minimal fix:", prompt)
            self.assertIn("Corrected code:", prompt)
            self.assertIn("One-sentence beginner explanation:", prompt)
        self.assertIn("Trace factorial(5)", python_prompt)
        self.assertIn("Trace the loop indices", cpp_prompt)

    def test_prompt_v3_uses_128_tokens_without_changing_other_defaults(self):
        with tempfile.TemporaryDirectory() as directory:
            metadata = self._write_metadata(directory)
            model = self._fake_file(directory, "tiny.gguf")
            executable = self._fake_file(directory, "llama-cli")
            received_settings = []

            def fake_runner(prompt, **kwargs):
                received_settings.append(kwargs)
                output = (
                    "Trace target: echoed target\n"
                    "Original coding problem: echoed problem\n"
                    "Respond using exactly this structure: echoed format\n\n"
                    "Direct bug:\nWrong condition.\nTrace:\nThe trace reaches the bad case."
                )
                return LlamaRunResult(True, output, "", 0, 1.0, ["fake"])

            artifact = run_benchmark(
                metadata_path=metadata,
                output_path=Path(directory) / "benchmark_prompt_v3.json",
                model_path=str(model),
                llama_cli_path=str(executable),
                prompt_variant="prompt_v3",
                runner=fake_runner,
            )

        self.assertEqual(artifact["settings"]["max_tokens"], 128)
        self.assertTrue(all(call["max_tokens"] == 128 for call in received_settings))
        self.assertEqual(artifact["settings"]["prompt_variant"], "prompt_v3")
        self.assertTrue(
            artifact["runs"][0]["clean_output_preview"].startswith("Direct bug:")
        )
        self.assertNotIn(
            "Original coding problem:", artifact["runs"][0]["clean_output_preview"]
        )

    def test_cleaner_starts_at_direct_bug_and_removes_v3_prompt_echo(self):
        raw_output = (
            "Trace target: Trace factorial(5).\n\n"
            "Original coding problem:\nBuggy factorial code\n\n"
            "Respond using exactly this structure:\nDirect bug:\n"
            "The base case returns zero.\nTrace:\nfactorial(5) reaches factorial(0)."
        )
        cleaned = clean_llama_output(raw_output, "full prompt that was truncated")

        self.assertTrue(cleaned.startswith("Direct bug:"))
        self.assertIn("The base case returns zero.", cleaned)
        self.assertNotIn("Trace target:", cleaned)
        self.assertNotIn("Original coding problem:", cleaned)
        self.assertNotIn("Respond using exactly this structure:", cleaned)


if __name__ == "__main__":
    unittest.main()
