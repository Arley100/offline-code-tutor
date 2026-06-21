import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

from src.runner import run_llama_prompt


class LlamaRunnerTests(unittest.TestCase):
    def _fake_file(self, directory: str, name: str) -> str:
        path = Path(directory) / name
        path.write_text("test placeholder", encoding="utf-8")
        return str(path)

    def test_missing_llama_cpp_executable(self):
        with tempfile.TemporaryDirectory() as directory:
            model = self._fake_file(directory, "model.gguf")
            with patch("src.runner.shutil.which", return_value=None), patch(
                "src.runner.PROJECT_ROOT", Path(directory) / "empty"
            ), patch.dict(os.environ, {}, clear=True):
                result = run_llama_prompt("hello", model_path=model)

        self.assertFalse(result.ok)
        self.assertIsNone(result.return_code)
        self.assertIn("executable not found", result.error_message)

    def test_missing_model_file(self):
        with tempfile.TemporaryDirectory() as directory:
            executable = self._fake_file(directory, "llama-cli")
            result = run_llama_prompt(
                "hello",
                model_path=str(Path(directory) / "missing.gguf"),
                llama_cli_path=executable,
            )

        self.assertFalse(result.ok)
        self.assertIn("GGUF model not found", result.error_message)

    def test_successful_subprocess_call_and_command_construction(self):
        with tempfile.TemporaryDirectory() as directory:
            executable = self._fake_file(directory, "llama-cli")
            model = self._fake_file(directory, "model.gguf")
            completed = subprocess.CompletedProcess([], 0, "model answer", "runtime note")
            with patch("src.runner.subprocess.run", return_value=completed) as run:
                result = run_llama_prompt(
                    "Explain this prompt",
                    model_path=model,
                    llama_cli_path=executable,
                    max_tokens=64,
                    temperature=0.35,
                )

        self.assertTrue(result.ok)
        self.assertEqual(result.output, "model answer")
        self.assertEqual(result.stderr, "runtime note")
        self.assertEqual(result.return_code, 0)
        command = run.call_args.args[0]
        self.assertEqual(command[0], executable)
        self.assertEqual(command[command.index("-m") + 1], model)
        self.assertEqual(command[command.index("-p") + 1], "Explain this prompt")
        self.assertEqual(command[command.index("-n") + 1], "64")
        self.assertEqual(command[command.index("--temp") + 1], "0.35")
        self.assertIn("--single-turn", command)
        self.assertIn("--no-display-prompt", command)
        self.assertIn("--simple-io", command)
        self.assertIn("--no-warmup", command)
        run.assert_called_once_with(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
            check=False,
        )

    def test_subprocess_timeout(self):
        with tempfile.TemporaryDirectory() as directory:
            executable = self._fake_file(directory, "llama-cli")
            model = self._fake_file(directory, "model.gguf")
            timeout = subprocess.TimeoutExpired([], 3, output="partial")
            with patch("src.runner.subprocess.run", side_effect=timeout):
                result = run_llama_prompt(
                    "hello",
                    model_path=model,
                    llama_cli_path=executable,
                    timeout_seconds=3,
                )

        self.assertFalse(result.ok)
        self.assertIsNone(result.return_code)
        self.assertEqual(result.output, "partial")
        self.assertIn("timed out after 3 seconds", result.error_message)

    def test_uses_llama_cpp_cli_environment_variable(self):
        with tempfile.TemporaryDirectory() as directory:
            executable = self._fake_file(directory, "custom-llama-cli")
            model = self._fake_file(directory, "model.gguf")
            completed = Mock(returncode=0, stdout="ok", stderr="")
            with patch.dict(os.environ, {"LLAMA_CPP_CLI": executable}, clear=True), patch(
                "src.runner.subprocess.run", return_value=completed
            ):
                result = run_llama_prompt("hello", model_path=model)

        self.assertTrue(result.ok)
        self.assertEqual(result.command[0], executable)


if __name__ == "__main__":
    unittest.main()
