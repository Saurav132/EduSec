"""
Unit tests for collector/agent.py.
Tests agent cycle, batch processing, checkpoint updating, and delivery failure pauses.
"""

import json
import os
import shutil
import tempfile
import unittest
from unittest.mock import MagicMock, patch

from collector.agent import JournalCollectorAgent
from collector.sender import DeliveryError


class TestJournalCollectorAgent(unittest.TestCase):

    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="edusec_test_agent_")
        self.state_file = os.path.join(self.test_dir, "cursor.json")
        self.config_file = os.path.join(self.test_dir, "config.json")

        config_data = {
            "api_base_url": "http://127.0.0.1:8080/api/v1",
            "state_file": self.state_file,
            "poll_interval_seconds": 0.1,
            "batch_size": 10,
            "max_retries": 1,
            "retry_backoff_base": 1.0,
            "initial_position": "head"
        }
        with open(self.config_file, "w", encoding="utf-8") as f:
            json.dump(config_data, f)

        self.agent = JournalCollectorAgent(config_path=self.config_file)

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def test_process_filtered_entry_advances_cursor(self):
        filtered_entry = {
            "MESSAGE": "systemd-hostnamed.service: Deactivated successfully.",
            "SYSLOG_IDENTIFIER": "systemd",
            "__CURSOR": "cursor-filtered-1"
        }
        success = self.agent.process_entry(filtered_entry)
        self.assertTrue(success)
        self.assertEqual(self.agent.current_cursor, "cursor-filtered-1")

    @patch("collector.sender.EventSender.send_event")
    def test_process_security_event_delivers_and_saves_checkpoint(self, mock_send):
        mock_send.return_value = True

        sec_entry = {
            "MESSAGE": "Failed password for root from 192.168.1.10 port 22 ssh2",
            "SYSLOG_IDENTIFIER": "sshd",
            "__CURSOR": "cursor-sec-1",
            "_BOOT_ID": "boot-1",
            "__REALTIME_TIMESTAMP": "1792304548021305"
        }
        success = self.agent.process_entry(sec_entry)
        self.assertTrue(success)
        self.assertEqual(self.agent.current_cursor, "cursor-sec-1")

        # Verify checkpoint file was committed to disk
        loaded = self.agent.checkpoint_mgr.load()
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded["cursor"], "cursor-sec-1")

    @patch("collector.sender.EventSender.send_event")
    def test_process_event_delivery_failure_does_not_advance_checkpoint(self, mock_send):
        mock_send.side_effect = DeliveryError("Network down")

        # Initially set cursor to a known state
        self.agent.current_cursor = "cursor-initial"
        self.agent.checkpoint_mgr.save("cursor-initial")

        failing_entry = {
            "MESSAGE": "Failed password for root from 192.168.1.10 port 22 ssh2",
            "SYSLOG_IDENTIFIER": "sshd",
            "__CURSOR": "cursor-failing-event",
            "_BOOT_ID": "boot-1",
            "__REALTIME_TIMESTAMP": "1792304548021305"
        }

        success = self.agent.process_entry(failing_entry)
        self.assertFalse(success, "Process entry must return False on delivery error")
        self.assertEqual(self.agent.current_cursor, "cursor-initial", "In-memory cursor must not advance")

        # Verify disk checkpoint still points to cursor-initial
        loaded = self.agent.checkpoint_mgr.load()
        self.assertEqual(loaded["cursor"], "cursor-initial", "Disk checkpoint must remain at uncommitted state")

    @patch("collector.agent.JournalCollectorAgent.fetch_journal_entries")
    @patch("collector.sender.EventSender.send_event")
    def test_run_cycle_processes_batch_in_order(self, mock_send, mock_fetch):
        mock_send.return_value = True

        batch = [
            {
                "MESSAGE": "Non-security message 1",
                "SYSLOG_IDENTIFIER": "kernel",
                "__CURSOR": "cursor-batch-1"
            },
            {
                "MESSAGE": "Failed password for test from 10.0.0.5 port 22 ssh2",
                "SYSLOG_IDENTIFIER": "sshd",
                "__CURSOR": "cursor-batch-2",
                "_BOOT_ID": "b1",
                "__REALTIME_TIMESTAMP": "1792304548021305"
            },
            {
                "MESSAGE": "Non-security message 2",
                "SYSLOG_IDENTIFIER": "cron",
                "__CURSOR": "cursor-batch-3"
            }
        ]
        mock_fetch.return_value = batch

        processed = self.agent.run_cycle()
        self.assertEqual(processed, 3)
        self.assertEqual(self.agent.current_cursor, "cursor-batch-3")

    @patch("collector.agent.JournalCollectorAgent.fetch_journal_entries")
    @patch("collector.sender.EventSender.send_event")
    def test_dry_run_never_calls_checkpoint_save_and_does_not_mutate_disk(self, mock_send, mock_fetch):
        self.agent.dry_run = True
        batch = [
            {
                "MESSAGE": "Filtered system message",
                "SYSLOG_IDENTIFIER": "cron",
                "__CURSOR": "cursor-dry-1"
            },
            {
                "MESSAGE": "Failed password for root from 192.168.1.50 port 22 ssh2",
                "SYSLOG_IDENTIFIER": "sshd",
                "__CURSOR": "cursor-dry-2",
                "_BOOT_ID": "boot-dry",
                "__REALTIME_TIMESTAMP": "1792304548021305"
            },
            {
                "MESSAGE": "Another filtered message",
                "SYSLOG_IDENTIFIER": "kernel",
                "__CURSOR": "cursor-dry-3"
            }
        ]
        mock_fetch.return_value = batch

        with patch.object(self.agent.checkpoint_mgr, "save", wraps=self.agent.checkpoint_mgr.save) as spy_save:
            processed = self.agent.run_cycle()

            self.assertEqual(processed, 3)
            self.assertEqual(self.agent.current_cursor, "cursor-dry-3", "In-memory cursor should advance")
            mock_send.assert_not_called()
            spy_save.assert_not_called()
            self.assertFalse(os.path.exists(self.state_file), "Disk checkpoint must not be created in dry-run")

    @patch("subprocess.run")
    def test_dry_run_does_not_create_checkpoint_on_initial_tail_seek(self, mock_subproc):
        self.agent.dry_run = True
        self.agent.initial_position = "tail"
        self.agent.current_cursor = None
        mock_subproc.return_value = MagicMock(
            returncode=0,
            stdout='{"__CURSOR": "tail-cursor-999"}\n'
        )

        with patch.object(self.agent.checkpoint_mgr, "save") as mock_save:
            cursor = self.agent.get_initial_cursor()
            self.assertEqual(cursor, "tail-cursor-999")
            mock_save.assert_not_called()
            self.assertFalse(os.path.exists(self.state_file), "Tail checkpoint must not be written in dry-run")

    @patch("collector.agent.JournalCollectorAgent.fetch_journal_entries")
    def test_normal_mode_advances_checkpoint_on_filtered_batch(self, mock_fetch):
        self.agent.dry_run = False
        batch = [
            {
                "MESSAGE": "Filtered message 1",
                "SYSLOG_IDENTIFIER": "systemd",
                "__CURSOR": "cursor-filter-1"
            },
            {
                "MESSAGE": "Filtered message 2",
                "SYSLOG_IDENTIFIER": "cron",
                "__CURSOR": "cursor-filter-2"
            }
        ]
        mock_fetch.return_value = batch

        processed = self.agent.run_cycle()
        self.assertEqual(processed, 2)
        self.assertEqual(self.agent.current_cursor, "cursor-filter-2")

        # Verify disk checkpoint was saved for filtered batch
        loaded = self.agent.checkpoint_mgr.load()
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded["cursor"], "cursor-filter-2")

    @patch("subprocess.run")
    def test_normal_mode_creates_checkpoint_on_initial_tail_seek(self, mock_subproc):
        self.agent.dry_run = False
        self.agent.initial_position = "tail"
        self.agent.current_cursor = None
        mock_subproc.return_value = MagicMock(
            returncode=0,
            stdout='{"__CURSOR": "tail-cursor-normal"}\n'
        )

        cursor = self.agent.get_initial_cursor()
        self.assertEqual(cursor, "tail-cursor-normal")

        # Verify disk checkpoint was saved
        loaded = self.agent.checkpoint_mgr.load()
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded["cursor"], "tail-cursor-normal")
        self.assertEqual(loaded["metadata"], {"init": "tail"})

    @patch("collector.agent.JournalCollectorAgent.fetch_journal_entries")
    def test_empty_journal_results_logs_informational_message(self, mock_fetch):
        mock_fetch.return_value = []
        with self.assertLogs("edusec.collector.agent", level="INFO") as log_ctx:
            processed = self.agent.run_cycle()
            self.assertEqual(processed, 0)
            self.assertTrue(
                any("No new journal entries found after cursor. Journal is up to date." in msg for msg in log_ctx.output),
                f"Expected log message not found in {log_ctx.output}"
            )


if __name__ == "__main__":
    unittest.main()
