import json
from pathlib import Path
import tempfile
import unittest

from src.report import generate_comparison_report


class ReportTests(unittest.TestCase):
    def _artifact(self, variant: str, elapsed: list[float], speeds: list[float]):
        return {
            "project": "OfflineCodeTutor",
            "benchmark_status": "completed",
            "model": {"filename": "fixture-model.gguf", "size_bytes": 1048576},
            "runtime": {
                "platform": "FixtureOS",
                "machine": "x86_64",
                "processor": "Fixture CPU",
                "cpu_count": 4,
                "python_version": "3.12 fixture",
            },
            "settings": {"prompt_variant": variant},
            "runs": [
                {
                    "prompt_id": "python-factorial-debug",
                    "ok": True,
                    "elapsed_seconds": elapsed[0],
                    "tokens_per_second": speeds[0],
                },
                {
                    "prompt_id": "cpp-vector-bounds-debug",
                    "ok": True,
                    "elapsed_seconds": elapsed[1],
                    "tokens_per_second": speeds[1],
                },
            ],
        }

    def _write(self, directory: Path, filename: str, artifact: dict):
        (directory / filename).write_text(json.dumps(artifact), encoding="utf-8")

    def test_creates_report_with_all_variants_model_and_average_speed(self):
        with tempfile.TemporaryDirectory() as directory_name:
            directory = Path(directory_name)
            self._write(
                directory,
                "benchmark_local.json",
                self._artifact("baseline", [4.0, 6.0], [10.0, 20.0]),
            )
            self._write(
                directory,
                "benchmark_prompt_v2.json",
                self._artifact("prompt_v2", [6.0, 8.0], [12.0, 14.0]),
            )
            self._write(
                directory,
                "benchmark_prompt_v3.json",
                self._artifact("prompt_v3", [10.0, 12.0], [8.0, 10.0]),
            )
            output = directory / "benchmark_comparison.md"
            markdown = generate_comparison_report(directory, output)

            self.assertTrue(output.is_file())

        self.assertIn("fixture-model.gguf", markdown)
        self.assertIn("1048576 bytes (1.00 MiB)", markdown)
        self.assertIn("| baseline | completed | 5.00 | 15.00 | 2/2 |", markdown)
        self.assertIn("| prompt_v2 |", markdown)
        self.assertIn("| prompt_v3 |", markdown)
        self.assertIn("prompt v3 improved correctness", markdown.lower())

    def test_missing_optional_artifacts_are_handled_gracefully(self):
        with tempfile.TemporaryDirectory() as directory_name:
            directory = Path(directory_name)
            self._write(
                directory,
                "benchmark_local.json",
                self._artifact("baseline", [4.0, 6.0], [10.0, 20.0]),
            )
            markdown = generate_comparison_report(
                directory, directory / "benchmark_comparison.md"
            )

        self.assertIn("| prompt_v2 | not available |", markdown)
        self.assertIn("| prompt_v3 | not available |", markdown)
        self.assertIn("A final three-way conclusion requires", markdown)

    def test_manual_scores_and_task_notes_are_included(self):
        with tempfile.TemporaryDirectory() as directory_name:
            directory = Path(directory_name)
            baseline = self._artifact("baseline", [4.0, 6.0], [10.0, 20.0])
            scored = json.loads(json.dumps(baseline))
            for run in scored["runs"]:
                run["manual_score"] = {
                    "correctness": 4,
                    "clarity": 4,
                    "beginner_friendliness": 3,
                    "minimality_of_fix": 4,
                    "hallucination_risk": 3,
                    "offline_usefulness": 4,
                    "notes": f"Reviewed {run['prompt_id']}",
                }
            self._write(directory, "benchmark_local.json", baseline)
            self._write(directory, "benchmark_scored.json", scored)
            markdown = generate_comparison_report(
                directory, directory / "benchmark_comparison.md"
            )

        self.assertIn("| baseline | 2 | 4.00 | 4.00 | 3.00", markdown)
        self.assertIn("Reviewed python-factorial-debug", markdown)
        self.assertIn("Reviewed cpp-vector-bounds-debug", markdown)


if __name__ == "__main__":
    unittest.main()
