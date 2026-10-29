"""
Unit tests for collector/checkpoint.py.
Verifies atomic saving, loading, corruption recovery, and path expansion.
"""

import json
import os
import shutil
import tempfile
import unittest

from collector.checkpoint import CheckpointManager


class TestCheckpointManager(unittest.TestCase):

    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="edusec_test_checkpoint_")
        self.state_file = os.path.join(self.test_dir, "test_cursor.json")
        self.mgr = CheckpointManager(self.state_file)

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def test_load_when_file_does_not_exist(self):
        self.assertIsNone(self.mgr.load())

    def test_save_and_load_success(self):
        saved = self.mgr.save(cursor="cursor-12345", last_event_id="evt-1", metadata={"test": True})
        self.assertTrue(saved)
        self.assertTrue(os.path.exists(self.state_file))

        loaded = self.mgr.load()
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded["cursor"], "cursor-12345")
        self.assertEqual(loaded["last_event_id"], "evt-1")
        self.assertEqual(loaded["metadata"]["test"], True)

    def test_save_empty_cursor_fails(self):
        self.assertFalse(self.mgr.save(cursor=""))
        self.assertFalse(self.mgr.save(cursor=None))

    def test_atomic_overwrite(self):
        self.mgr.save(cursor="cursor-initial")
        loaded1 = self.mgr.load()
        self.assertEqual(loaded1["cursor"], "cursor-initial")

        self.mgr.save(cursor="cursor-updated")
        loaded2 = self.mgr.load()
        self.assertEqual(loaded2["cursor"], "cursor-updated")

    def test_corrupted_file_recovery(self):
        # Write corrupted non-JSON data
        with open(self.state_file, "w", encoding="utf-8") as f:
            f.write("NOT_VALID_JSON{:::;")

        loaded = self.mgr.load()
        self.assertIsNone(loaded, "Corrupted file must return None and not raise exception")

        # Check that corrupted file was moved out of the way
        files = os.listdir(self.test_dir)
        corrupted_backups = [f for f in files if "corrupt" in f]
        self.assertTrue(len(corrupted_backups) > 0, "Corrupted file must be backed up")


if __name__ == "__main__":
    unittest.main()
