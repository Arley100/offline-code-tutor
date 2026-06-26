import re
import unittest

from src.benchmark import DEFAULT_METADATA_PATH, load_benchmark_prompts


ID_PATTERN = re.compile(r"^[a-z0-9]+([_-][a-z0-9]+)*$")
REQUIRED_FIELDS = ("id", "title", "language", "category", "difficulty", "prompt")
DIFFICULTIES = {"beginner", "intermediate", "advanced"}
# Tasks present before the Ticket 7 expansion; kept for backward compatibility.
LEGACY_IDS = {"python-factorial-debug", "cpp-vector-bounds-debug"}


class TaskPackTests(unittest.TestCase):
    def setUp(self):
        self.tasks = load_benchmark_prompts(DEFAULT_METADATA_PATH)

    def test_pack_has_8_to_12_tasks(self):
        self.assertGreaterEqual(len(self.tasks), 8)
        self.assertLessEqual(len(self.tasks), 12)

    def test_task_ids_are_unique_and_machine_friendly(self):
        ids = [task["id"] for task in self.tasks]
        self.assertEqual(len(ids), len(set(ids)), "task ids must be unique")
        for task_id in ids:
            self.assertRegex(task_id, ID_PATTERN)

    def test_each_task_has_required_metadata(self):
        for task in self.tasks:
            for field in REQUIRED_FIELDS:
                self.assertIn(field, task, f"{task.get('id')} missing {field}")
                self.assertIsInstance(task[field], str)
                self.assertTrue(task[field].strip(), f"{task['id']} empty {field}")
            self.assertIn(task["difficulty"], DIFFICULTIES)
            self.assertIsInstance(task.get("expected_concepts"), list)
            self.assertTrue(task["expected_concepts"], f"{task['id']} no concepts")
            self.assertIsInstance(task.get("scoring_notes"), str)

    def test_legacy_task_ids_are_preserved(self):
        ids = {task["id"] for task in self.tasks}
        self.assertTrue(LEGACY_IDS.issubset(ids))

    def test_pack_covers_multiple_languages_and_categories(self):
        languages = {task["language"] for task in self.tasks}
        categories = {task["category"] for task in self.tasks}
        # Variety is the point of the expanded pack.
        self.assertGreaterEqual(len(languages), 3)
        self.assertGreaterEqual(len(categories), 4)


if __name__ == "__main__":
    unittest.main()
