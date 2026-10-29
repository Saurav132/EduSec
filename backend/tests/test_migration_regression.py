"""Regression tests verifying database schema migration and upgrade idempotency."""

import json
from pathlib import Path
import sqlite3
import pytest

from backend.app.detectors.base import compute_evidence_fingerprint
from backend.app.storage.db import (
    check_db_readiness,
    get_db_connection,
    init_db,
)

OLDER_ALERTS_SCHEMA = """
CREATE TABLE alerts (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL,
    related_event_ids TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL
);

CREATE INDEX idx_alerts_created_at ON alerts(created_at);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_status ON alerts(status);
"""

OLDER_EVENTS_SCHEMA = """
CREATE TABLE security_events (
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

CREATE INDEX idx_events_timestamp ON security_events(timestamp);
CREATE INDEX idx_events_event_type ON security_events(event_type);
CREATE INDEX idx_events_source_ip ON security_events(source_ip);
"""


def test_upgrade_from_older_schema_preserves_records_and_adds_fingerprint(tmp_path: Path):
    """
    Simulate an existing Phase 2/3 database that lacks 'fingerprint' and 'evidence' columns,
    verify init_db safely migrates the schema, backfills fingerprints, and preserves records.
    """
    db_file = tmp_path / "legacy_edusec.db"

    # 1. Initialize older schema
    conn = sqlite3.connect(str(db_file))
    conn.row_factory = sqlite3.Row
    with conn:
        conn.executescript(OLDER_EVENTS_SCHEMA)
        conn.executescript(OLDER_ALERTS_SCHEMA)

        # Insert legacy security events
        conn.execute(
            """
            INSERT INTO security_events VALUES (
                'evt-001', 'authentication', '2026-10-15T08:00:00Z', '192.168.1.10',
                'alice', 'failure', 'host-1', '{"reason": "bad_pwd"}', '2026-10-15T08:00:01Z'
            );
            """
        )

        # Insert legacy alerts created by earlier application version (no evidence, no fingerprint)
        legacy_event_ids = ["evt-001", "evt-002", "evt-003", "evt-004", "evt-005"]
        conn.execute(
            """
            INSERT INTO alerts VALUES (
                'alert-legacy-1', 'NG-AUTH-001', 'Legacy Brute Force', 'Older alert description',
                'high', ?, 'open', '2026-10-15T08:05:00Z'
            );
            """,
            (json.dumps(legacy_event_ids),),
        )
        conn.execute(
            """
            INSERT INTO alerts VALUES (
                'alert-legacy-2', 'NG-AUTH-002', 'Legacy Compromise', 'Older alert description 2',
                'high', ?, 'open', '2026-10-15T08:06:00Z'
            );
            """,
            (json.dumps(["evt-succ", "evt-001"]),),
        )
    conn.close()

    # 2. Verify pre-migration state: evidence and fingerprint columns do NOT exist
    conn = sqlite3.connect(str(db_file))
    conn.row_factory = sqlite3.Row
    pre_cols = {r["name"] for r in conn.execute("PRAGMA table_info(alerts);").fetchall()}
    assert "fingerprint" not in pre_cols
    assert "evidence" not in pre_cols
    conn.close()

    # 3. Execute init_db() upgrade
    init_db(db_file)

    # 4. Verify post-migration state
    ready, details = check_db_readiness(db_file)
    assert ready is True
    assert "initialized and reachable" in details

    conn = sqlite3.connect(str(db_file))
    conn.row_factory = sqlite3.Row

    # Verify columns were added
    post_cols = {r["name"] for r in conn.execute("PRAGMA table_info(alerts);").fetchall()}
    assert "fingerprint" in post_cols
    assert "evidence" in post_cols

    # Verify indexes exist
    indexes = {r["name"] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='index';").fetchall()}
    assert "idx_alerts_fingerprint" in indexes
    assert "idx_alerts_rule_id" in indexes

    # Verify existing data is preserved
    rows = conn.execute("SELECT * FROM alerts ORDER BY id;").fetchall()
    assert len(rows) == 2

    # Check alert-legacy-1
    a1 = dict(rows[0])
    assert a1["id"] == "alert-legacy-1"
    assert a1["title"] == "Legacy Brute Force"
    assert a1["evidence"] == "{}"
    expected_fp_1 = compute_evidence_fingerprint("NG-AUTH-001", legacy_event_ids)
    assert a1["fingerprint"] == expected_fp_1

    # Check alert-legacy-2
    a2 = dict(rows[1])
    assert a2["id"] == "alert-legacy-2"
    assert a2["title"] == "Legacy Compromise"
    expected_fp_2 = compute_evidence_fingerprint("NG-AUTH-002", ["evt-succ", "evt-001"])
    assert a2["fingerprint"] == expected_fp_2

    # Verify security_events row preserved
    event_row = conn.execute("SELECT * FROM security_events WHERE id = 'evt-001';").fetchone()
    assert event_row is not None
    assert event_row["username"] == "alice"

    conn.close()

    # 5. Verify repeated execution (idempotency)
    init_db(db_file)
    init_db(db_file)

    ready2, _ = check_db_readiness(db_file)
    assert ready2 is True
