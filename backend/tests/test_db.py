"""Tests for SQLite database initialization, idempotency, and readiness."""

import json
from pathlib import Path
from backend.app.storage.db import (
    init_db,
    get_db_connection,
    check_db_readiness,
)


def test_database_initialization_creates_tables_and_indexes(tmp_path: Path):
    """Verify that init_db creates all required tables and indexes."""
    db_file = tmp_path / "fresh_edusec.db"
    assert not db_file.exists()

    init_db(db_file)
    assert db_file.exists()

    conn = get_db_connection(db_file)
    try:
        # Check tables
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
        )
        tables = [row["name"] for row in cursor.fetchall()]
        assert "security_events" in tables
        assert "alerts" in tables

        # Check indexes
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' ORDER BY name;"
        )
        indexes = [row["name"] for row in cursor.fetchall()]
        assert "idx_events_timestamp" in indexes
        assert "idx_events_event_type" in indexes
        assert "idx_events_source_ip" in indexes
        assert "idx_alerts_created_at" in indexes
        assert "idx_alerts_severity" in indexes
        assert "idx_alerts_status" in indexes
    finally:
        conn.close()

    # Check readiness check returns True
    ready, details = check_db_readiness(db_file)
    assert ready is True
    assert "initialized and reachable" in details


def test_repeated_database_initialization_is_idempotent(tmp_path: Path):
    """Verify that calling init_db multiple times does not raise errors or corrupt schema."""
    db_file = tmp_path / "idempotent_edusec.db"

    # Call init_db 3 times in succession
    init_db(db_file)
    init_db(db_file)
    init_db(db_file)

    ready, details = check_db_readiness(db_file)
    assert ready is True


def test_parameterized_insertion_and_retrieval(tmp_path: Path):
    """Verify that parameterized SQL works cleanly for inserting security events."""
    db_file = tmp_path / "events_test.db"
    init_db(db_file)

    conn = get_db_connection(db_file)
    try:
        sample_event = {
            "id": "evt-12345",
            "event_type": "auth_login",
            "timestamp": "2026-10-14T18:00:00Z",
            "source_ip": "10.0.0.1",
            "username": "student_mca",
            "outcome": "failure",
            "asset_id": "lab-pc-01",
            "details": json.dumps({"reason": "invalid_password"}),
            "created_at": "2026-10-14T18:00:01Z",
        }

        # Safe parameterized insert
        conn.execute(
            """
            INSERT INTO security_events (
                id, event_type, timestamp, source_ip, username, outcome, asset_id, details, created_at
            ) VALUES (
                :id, :event_type, :timestamp, :source_ip, :username, :outcome, :asset_id, :details, :created_at
            );
            """,
            sample_event,
        )
        conn.commit()

        # Query back
        row = conn.execute(
            "SELECT * FROM security_events WHERE id = ?;", ("evt-12345",)
        ).fetchone()
        assert row is not None
        assert row["id"] == "evt-12345"
        assert row["event_type"] == "auth_login"
        assert row["outcome"] == "failure"
        assert json.loads(row["details"])["reason"] == "invalid_password"
    finally:
        conn.close()
