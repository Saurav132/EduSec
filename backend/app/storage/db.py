"""SQLite database connection and schema management."""

import hashlib
import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator, List, Optional, Union

from backend.app.core.config import get_settings

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS security_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    source_ip TEXT,
    username TEXT,
    outcome TEXT NOT NULL,
    asset_id TEXT,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_source_ip ON security_events(source_ip);

CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL,
    related_event_ids TEXT NOT NULL,
    evidence TEXT NOT NULL DEFAULT '{}',
    fingerprint TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
"""


def _compute_fingerprint(rule_id: str, event_ids: List[str]) -> str:
    """Deterministic evidence fingerprint generator for alert deduplication."""
    sorted_ids = sorted([str(eid) for eid in event_ids])
    raw = f"{rule_id}:{','.join(sorted_ids)}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def resolve_db_path(db_path: Optional[Union[str, Path]] = None) -> Path:
    """Return the resolved Path object for the SQLite database."""
    if db_path is None:
        return get_settings().resolved_database_path
    if isinstance(db_path, str):
        if db_path == ":memory:":
            return Path(":memory:")
        p = Path(db_path)
        if not p.is_absolute():
            return get_settings().resolved_database_path.parent / p
        return p
    return db_path


def get_db_connection(db_path: Optional[Union[str, Path]] = None) -> sqlite3.Connection:
    """
    Create and return a configured sqlite3.Connection.
    Configures Row factory and enables foreign key enforcement.
    """
    path = resolve_db_path(db_path)
    if str(path) != ":memory:":
        path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def get_db(db_path: Optional[Union[str, Path]] = None) -> Generator[sqlite3.Connection, None, None]:
    """Context manager for safe database transactions with auto-commit/rollback."""
    conn = get_db_connection(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(db_path: Optional[Union[str, Path]] = None) -> None:
    """
    Initialize SQLite database schema and perform safe, idempotent migrations.
    Guarantees:
    1. Base tables (security_events, alerts) are created if they do not exist.
    2. Older schemas are safely migrated to add missing columns (evidence, fingerprint)
       before any index referencing them is created.
    3. Existing rows in alerts have fingerprints backfilled where possible without inventing
       invalid fingerprints or collapsing distinct alerts.
    4. Indexes (including unique index on fingerprint) are created only after the columns exist.
    5. Safe and idempotent on fresh, partially migrated, and fully migrated databases.
    """
    conn = get_db_connection(db_path)
    try:
        with conn:
            conn.executescript(SCHEMA_SQL)

            # Safe schema update for pre-existing tables missing new columns
            cursor = conn.execute("PRAGMA table_info(alerts);")
            columns = {row["name"] for row in cursor.fetchall()}

            if "evidence" not in columns:
                conn.execute("ALTER TABLE alerts ADD COLUMN evidence TEXT NOT NULL DEFAULT '{}';")
            if "fingerprint" not in columns:
                conn.execute("ALTER TABLE alerts ADD COLUMN fingerprint TEXT;")

            # Backfill deterministic fingerprints for any existing rows where fingerprint is NULL
            null_cursor = conn.execute(
                "SELECT id, rule_id, related_event_ids FROM alerts WHERE fingerprint IS NULL;"
            )
            for row in null_cursor.fetchall():
                alert_id = row["id"]
                rule_id = row["rule_id"]
                event_ids: List[str] = []
                if row["related_event_ids"]:
                    try:
                        parsed = json.loads(row["related_event_ids"])
                        if isinstance(parsed, list):
                            event_ids = [str(x) for x in parsed]
                        elif isinstance(parsed, (str, int)):
                            event_ids = [str(parsed)]
                    except Exception:
                        event_ids = [str(row["related_event_ids"])]

                if rule_id and event_ids:
                    fp = _compute_fingerprint(rule_id, event_ids)
                    # Check for collisions before updating to avoid failing uniqueness constraint
                    existing = conn.execute(
                        "SELECT id FROM alerts WHERE fingerprint = ? AND id != ?;",
                        (fp, alert_id),
                    ).fetchone()
                    if not existing:
                        conn.execute(
                            "UPDATE alerts SET fingerprint = ? WHERE id = ?;",
                            (fp, alert_id),
                        )

            # Safely create indexes for rule_id and fingerprint after columns exist
            conn.execute("CREATE INDEX IF NOT EXISTS idx_alerts_rule_id ON alerts(rule_id);")
            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_fingerprint ON alerts(fingerprint);")
    finally:
        conn.close()


def check_db_readiness(db_path: Optional[Union[str, Path]] = None) -> tuple[bool, str]:
    """
    Check if the database is accessible and initialized with the required tables.
    Returns (is_ready, details_message).
    """
    try:
        conn = get_db_connection(db_path)
        try:
            with conn:
                # 1. Connectivity test
                conn.execute("SELECT 1;").fetchone()

                # 2. Check schema readiness
                cursor = conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('security_events', 'alerts');"
                )
                tables = {row["name"] for row in cursor.fetchall()}
                expected = {"security_events", "alerts"}

                if not expected.issubset(tables):
                    missing = expected - tables
                    return False, f"Missing required database tables: {', '.join(sorted(missing))}"

                # 3. Check column readiness
                alert_cols = {
                    r["name"] for r in conn.execute("PRAGMA table_info(alerts);").fetchall()
                }
                if not {"evidence", "fingerprint"}.issubset(alert_cols):
                    return False, "Alerts table is missing required schema columns (evidence, fingerprint)"

                return True, "Database is initialized and reachable"
        finally:
            conn.close()
    except Exception as exc:
        return False, f"Database connectivity error: {str(exc)}"
