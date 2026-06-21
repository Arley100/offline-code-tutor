import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.offline_code_tutor import TutorError, build_parser, load_source_file, main
from src.scoring import DEFAULT_BENCHMARK_PATH, DEFAULT_SCORED_PATH


class ArgumentParsingTests(unittest.TestCase):
    def setUp(self):
        self.parser = build_parser()

    def test_ask_accepts_question(self):
        args = self.parser.parse_args(["ask", "--question", "Why is this failing?"])
        self.assertEqual(args.command, "ask")
        self.assertEqual(args.question, "Why is this failing?")
        self.assertIsNone(args.file)

    def test_ask_accepts_file(self):
        args = self.parser.parse_args(["ask", "--file", "example.py"])
        self.assertEqual(args.file, Path("example.py"))
        self.assertIsNone(args.question)

    def test_ask_rejects_question_and_file_together(self):
        with self.assertRaises(SystemExit):
            self.parser.parse_args(
                ["ask", "--question", "Help", "--file", "example.py"]
            )

    def test_benchmark_command_parses(self):
        args = self.parser.parse_args(["benchmark"])
        self.assertEqual(args.command, "benchmark")
        self.assertIsNone(args.variant)

    def test_prompt_v2_benchmark_variant_parses(self):
        args = self.parser.parse_args(["benchmark", "--variant", "prompt_v2"])
        self.assertEqual(args.command, "benchmark")
        self.assertEqual(args.variant, "prompt_v2")

    def test_prompt_v3_benchmark_variant_parses(self):
        args = self.parser.parse_args(["benchmark", "--variant", "prompt_v3"])
        self.assertEqual(args.command, "benchmark")
        self.assertEqual(args.variant, "prompt_v3")

    def test_score_command_parses(self):
        args = self.parser.parse_args(["score"])
        self.assertEqual(args.command, "score")
        self.assertEqual(args.input, DEFAULT_BENCHMARK_PATH)
        self.assertEqual(args.output, DEFAULT_SCORED_PATH)

    def test_score_command_accepts_custom_input_and_output_without_inference(self):
        input_path = Path("results/benchmark_prompt_v3.json")
        output_path = Path("results/benchmark_prompt_v3_scored.json")
        with patch(
            "src.offline_code_tutor.score_benchmark", return_value={"runs": []}
        ) as scorer, patch("src.offline_code_tutor.run_llama_prompt") as inference:
            exit_code = main(
                [
                    "score",
                    "--input",
                    str(input_path),
                    "--output",
                    str(output_path),
                ]
            )

        self.assertEqual(exit_code, 0)
        scorer.assert_called_once_with(input_path, output_path)
        inference.assert_not_called()

    def test_report_command_parses(self):
        args = self.parser.parse_args(["report"])
        self.assertEqual(args.command, "report")


class FileLoadingTests(unittest.TestCase):
    def test_loads_utf8_source(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "hello.py"
            path.write_text("print('héllo')\n", encoding="utf-8")
            self.assertEqual(load_source_file(path), "print('héllo')\n")

    def test_missing_file_has_clear_error(self):
        with self.assertRaisesRegex(TutorError, "Source file not found"):
            load_source_file(Path("definitely-missing.py"))


if __name__ == "__main__":
    unittest.main()
