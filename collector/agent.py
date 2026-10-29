"""
EduSec Systemd Journal Log Collector Agent.
Polls journalctl for authentication and security events, normalizes them,
delivers them to the Spring Boot SIEM backend, and maintains atomic checkpoints.
"""

import argparse
import json
import logging
import os
import signal
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional

from collector.checkpoint import CheckpointManager
from collector.parser import parse_journal_entry
from collector.sender import DeliveryError, EventConflictError, EventSender, EventValidationError

# Configure clean logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("edusec.collector.agent")


class JournalCollectorAgent:
    """Orchestrates systemd journal ingestion, event normalization, and delivery."""

    def __init__(self, config_path: str, dry_run: bool = False):
        self.config_path = os.path.abspath(config_path)
        self.config = self._load_config(self.config_path)
        self.dry_run = dry_run
        self.running = True

        state_file = self.config.get("state_file", "~/.local/state/edusec/collector_cursor.json")
        self.checkpoint_mgr = CheckpointManager(state_file)

        self.sender = EventSender(
            api_base_url=self.config.get("api_base_url", "http://127.0.0.1:8080/api/v1"),
            max_retries=int(self.config.get("max_retries", 3)),
            backoff_base=float(self.config.get("retry_backoff_base", 1.5)),
            timeout=float(self.config.get("timeout_seconds", 5.0))
        )

        self.poll_interval = float(self.config.get("poll_interval_seconds", 2.0))
        self.batch_size = int(self.config.get("batch_size", 100))
        self.max_message_chars = int(self.config.get("max_message_chars", 256))
        self.initial_position = self.config.get("initial_position", "tail").lower()

        # Track active cursor in memory
        state = self.checkpoint_mgr.load()
        self.current_cursor = state.get("cursor") if state else None

        self._setup_signals()

    def _setup_signals(self):
        """Catch termination signals to enable clean shutdown."""
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)

    def _handle_shutdown(self, signum, frame):
        logger.info("Received termination signal (%d). Shutting down gracefully...", signum)
        self.running = False

    @staticmethod
    def _load_config(path: str) -> Dict[str, Any]:
        """Loads configuration from JSON file."""
        if not os.path.exists(path):
            logger.warning("Config file %s not found. Using default settings.", path)
            return {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as exc:
            logger.error("Failed to read config file %s: %s. Using defaults.", path, exc)
            return {}

    def get_initial_cursor(self) -> Optional[str]:
        """
        Retrieves an initial cursor from journalctl if no checkpoint exists.
        When initial_position is 'tail', finds the current journal tail cursor.
        """
        if self.current_cursor:
            return self.current_cursor

        if self.initial_position == "tail":
            logger.info("No checkpoint found. Seeking to journal tail to avoid historical flood...")
            try:
                cmd = ["journalctl", "-n", "1", "-o", "json"]
                result = subprocess.run(cmd, capture_output=True, text=True, check=True)
                lines = result.stdout.strip().splitlines()
                if lines:
                    last_record = json.loads(lines[-1])
                    cursor = last_record.get("__CURSOR")
                    if cursor:
                        if not self.dry_run:
                            self.checkpoint_mgr.save(cursor, metadata={"init": "tail"})
                            logger.info("Initialized starting checkpoint at cursor: %s", cursor[:32] + "...")
                        else:
                            logger.info("[DRY RUN] Initialized starting in-memory cursor at tail: %s", cursor[:32] + "...")
                        return cursor
            except Exception as exc:
                logger.warning("Could not determine tail cursor: %s. Will start from head.", exc)

        return None

    def fetch_journal_entries(self, cursor: Optional[str], limit: int) -> List[Dict[str, Any]]:
        """
        Executes journalctl -o json to retrieve a batch of chronological journal records.
        """
        cmd = ["journalctl", "-o", "json", "-n", str(limit)]
        if cursor:
            cmd.extend(["--after-cursor", cursor])

        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False
            )
            if proc.returncode != 0:
                logger.error("journalctl command failed (code %d): %s", proc.returncode, proc.stderr.strip())
                return []

            entries = []
            for line in proc.stdout.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    logger.debug("Skipping unparseable journal output line: %s", line[:50])
            return entries
        except FileNotFoundError:
            logger.critical("journalctl binary not found in PATH!")
            return []
        except Exception as exc:
            logger.error("Error invoking journalctl: %s", exc)
            return []

    def process_entry(self, entry: Dict[str, Any]) -> bool:
        """
        Processes a single journal record: parses, dispatches, and updates cursor.
        Returns True if processing succeeded and loop may continue.
        Returns False if a fatal delivery error occurred (checkpoint is NOT advanced).
        """
        cursor = entry.get("__CURSOR")
        if not cursor:
            return True

        parsed = parse_journal_entry(entry, max_msg_len=self.max_message_chars)
        if parsed is None:
            # Intentionally filtered or non-security event.
            # Advance in-memory cursor so subsequent batch will continue forward.
            self.current_cursor = cursor
            return True

        # Candidate security event recognized
        logger.info(
            "Parsed security event [type=%s, outcome=%s, user=%s, ip=%s]",
            parsed.get("event_type"),
            parsed.get("outcome"),
            parsed.get("username"),
            parsed.get("source_ip")
        )

        if self.dry_run:
            logger.info("[DRY RUN] Would send: %s", json.dumps(parsed, indent=2))
            self.current_cursor = cursor
            return True

        # Send to API
        try:
            self.sender.send_event(parsed)
            # Confirm delivery and advance persisted checkpoint
            self.current_cursor = cursor
            self.checkpoint_mgr.save(cursor, last_event_id=parsed.get("id"))
            return True
        except (EventValidationError, EventConflictError) as non_retryable:
            logger.error("Unrecoverable event error on %s: %s. Skipping to prevent loop.", parsed.get("id"), non_retryable)
            # Advance cursor past permanently broken event to avoid infinite crash loops
            self.current_cursor = cursor
            self.checkpoint_mgr.save(cursor, last_event_id=parsed.get("id"), metadata={"error": str(non_retryable)})
            return True
        except DeliveryError as deliv_err:
            logger.error("Delivery failed for event %s: %s", parsed.get("id"), deliv_err)
            # DO NOT ADVANCE CHECKPOINT. Return False to pause and retry next cycle.
            return False

    def run_cycle(self) -> int:
        """
        Runs one iteration of journal reading and processing.
        Returns number of events successfully processed.
        """
        if not self.current_cursor:
            self.current_cursor = self.get_initial_cursor()

        entries = self.fetch_journal_entries(self.current_cursor, limit=self.batch_size)
        if not entries:
            logger.info("No new journal entries found after cursor. Journal is up to date.")
            return 0

        processed_count = 0
        last_filtered_cursor = None

        for entry in entries:
            if not self.running:
                break

            success = self.process_entry(entry)
            if not success:
                # Stop batch immediately. Checkpoint remains at last confirmed event.
                logger.warning("Pausing batch processing due to delivery error. Will retry from checkpoint.")
                break

            processed_count += 1
            last_filtered_cursor = entry.get("__CURSOR")

        # If a whole batch of filtered entries was processed without any new events,
        # persist the last cursor to avoid re-reading filtered logs on restart.
        if not self.dry_run and last_filtered_cursor and self.current_cursor == last_filtered_cursor:
            self.checkpoint_mgr.save(self.current_cursor)

        return processed_count

    def start(self, run_once: bool = False):
        """Starts the collector agent main loop."""
        logger.info("Starting EduSec Journal Collector Agent (PID %d)...", os.getpid())
        logger.info("API endpoint: %s", self.sender.events_url)
        logger.info("State file:   %s", self.checkpoint_mgr.state_file_path)

        while self.running:
            try:
                processed = self.run_cycle()
                if run_once:
                    logger.info("Single-cycle run requested. Exiting.")
                    break

                if processed == 0:
                    time.sleep(self.poll_interval)
            except KeyboardInterrupt:
                break
            except Exception as exc:
                logger.error("Unexpected error in collector cycle: %s", exc, exc_info=True)
                time.sleep(self.poll_interval)

        logger.info("EduSec Journal Collector Agent stopped cleanly.")


def main():
    parser = argparse.ArgumentParser(description="EduSec Linux Journal Collector Agent")
    parser.add_argument(
        "--config",
        default=os.path.join(os.path.dirname(__file__), "config.json"),
        help="Path to configuration file"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and log events without sending to backend"
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single collection cycle and exit"
    )
    args = parser.parse_args()

    agent = JournalCollectorAgent(config_path=args.config, dry_run=args.dry_run)
    agent.start(run_once=args.once)


if __name__ == "__main__":
    main()
