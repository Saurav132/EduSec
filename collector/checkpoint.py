"""
Checkpoint manager for EduSec Journal Collector.
Persists the systemd journal cursor to a user-owned state file atomically.
"""

import json
import logging
import os
import tempfile
import time
from typing import Any, Dict, Optional

logger = logging.getLogger("edusec.collector.checkpoint")


class CheckpointManager:
    """Manages reading and atomic writing of journal checkpoints."""

    def __init__(self, state_file_path: str):
        self.state_file_path = os.path.abspath(os.path.expanduser(state_file_path))
        self.state_dir = os.path.dirname(self.state_file_path)
        os.makedirs(self.state_dir, exist_ok=True)

    def load(self) -> Optional[Dict[str, Any]]:
        """
        Load the checkpoint state from disk.
        Returns a dict containing 'cursor' and metadata, or None if file does not exist.
        """
        if not os.path.exists(self.state_file_path):
            logger.info("No existing checkpoint found at %s. Starting fresh.", self.state_file_path)
            return None

        try:
            with open(self.state_file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "cursor" in data:
                    logger.info("Loaded checkpoint cursor: %s", data["cursor"][:32] + "...")
                    return data
                else:
                    logger.warning("Checkpoint file %s contains invalid structure.", self.state_file_path)
                    return None
        except Exception as exc:
            logger.error("Error reading checkpoint file %s: %s", self.state_file_path, exc)
            backup_path = f"{self.state_file_path}.corrupt.{int(time.time())}"
            try:
                os.replace(self.state_file_path, backup_path)
                logger.warning("Moved corrupted checkpoint to %s", backup_path)
            except OSError:
                pass
            return None

    def save(self, cursor: str, last_event_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """
        Atomically write the cursor checkpoint to disk.
        Uses write-to-temp and atomic replace to guarantee consistency against crashes.
        """
        if not cursor or not isinstance(cursor, str):
            logger.error("Cannot save empty or invalid cursor.")
            return False

        payload = {
            "cursor": cursor.strip(),
            "last_event_id": last_event_id,
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "metadata": metadata or {}
        }

        temp_fd = None
        temp_path = None
        try:
            temp_fd, temp_path = tempfile.mkstemp(
                prefix="checkpoint_",
                suffix=".tmp",
                dir=self.state_dir
            )
            with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
                temp_fd = None  # fdopen takes ownership of temp_fd
                json.dump(payload, f, indent=2)
                f.flush()
                os.fsync(f.fileno())

            os.replace(temp_path, self.state_file_path)
            temp_path = None
            return True
        except Exception as exc:
            logger.error("Failed to write checkpoint atomically: %s", exc)
            return False
        finally:
            if temp_fd is not None:
                try:
                    os.close(temp_fd)
                except OSError:
                    pass
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    pass
