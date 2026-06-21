import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from src.scoring import (
    ScoringError,
    load_benchmark_artifact,
    score_benchmark,
    validate_score,
)


class ScoringTests(unittest.TestCase):
    def _write_benchmark(self, directory: str) -> tuple[Path, dict[str, object]]:
        artifact = {
            "project": "OfflineCodeTutor",
            "benchmark_status": "completed",
            "model": {"filename": "test.gguf", "sha256": "real-digest"},
            "runtime": {"platform": "TestOS"},
            "settings": {"max_tokens": 64},
            "runs": [
                {
                    "prompt_id": "python-factorial-debug",
                    "prompt": "Debug factorial",
                    "ok": True,
                    "elapsed_seconds": 1.2,
                    "clean_output_preview": "Factorial answer",
                },
                {
                    "prompt_id": "cpp-vector-bounds-debug",
                    "prompt": "Debug vector loop",
                    "ok": True,
                    "elapsed_seconds": 2.3,
                    "clean_output_preview": "Vector answer",
                },
            ],
            "manual_accuracy": {"status": "not_scored"},
        }
        path = Path(directory) / "benchmark_local.json"
        path.write_text(json.dumps(artifact), encoding="utf-8")
        return path, artifact

    def test_reads_benchmark_local_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path, expected = self._write_benchmark(directory)
            loaded = load_benchmark_artifact(path)

        self.assertEqual(loaded["project"], expected["project"])
        self.assertEqual(len(loaded["runs"]), 2)

    def test_writes_scores_and_preserves_benchmark_metadata_without_inference(self):
        with tempfile.TemporaryDirectory() as directory:
            input_path, original = self._write_benchmark(directory)
            output_path = Path(directory) / "benchmark_scored.json"

            def provider(run, hint):
                self.assertIn("Expected core fix", hint)
                return {
                    "correctness": 4,
                    "clarity": 5,
                    "beginner_friendliness": 4,
                    "minimality_of_fix": 3,
                    "hallucination_risk": 4,
                    "offline_usefulness": 5,
                    "notes": f"Reviewed {run['prompt_id']}",
                }

            with patch("src.runner.run_llama_prompt") as inference:
                scored = score_benchmark(input_path, output_path, provider)

            saved = json.loads(output_path.read_text(encoding="utf-8"))

        inference.assert_not_called()
        self.assertEqual(saved["project"], original["project"])
        self.assertEqual(saved["model"], original["model"])
        self.assertEqual(saved["runtime"], original["runtime"])
        self.assertEqual(saved["settings"], original["settings"])
        self.assertEqual(saved["runs"][0]["elapsed_seconds"], 1.2)
        self.assertEqual(saved["runs"][0]["manual_score"]["correctness"], 4)
        self.assertEqual(
            saved["runs"][1]["manual_score"]["notes"],
            "Reviewed cpp-vector-bounds-debug",
        )
        self.assertEqual(scored["manual_accuracy"]["status"], "scored")

    def test_rejects_scores_outside_one_to_five(self):
        for invalid in (0, 6, -1, "2.5", True):
            with self.subTest(invalid=invalid), self.assertRaises(ScoringError):
                validate_score(invalid)


if __name__ == "__main__":
    unittest.main()
