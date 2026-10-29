"""Data access repository for security events in SQLite."""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Union

from backend.app.models.event import SecurityEvent
from backend.app.storage.db import get_db


def row_to_event(row: sqlite3.Row) -> SecurityEvent:
    """Safely convert a SQLite Row to a validated SecurityEvent instance."""
    raw_details = row["details"]
    try:
        metadata = json.loads(raw_details) if raw_details else {}
        if not isinstance(metadata, dict):
            metadata = {"value": metadata}
    except Exception:
        metadata = {"raw": raw_details}

    return SecurityEvent(
        id=row["id"],
        event_type=row["event_type"],
        timestamp=datetime.fromisoformat(row["timestamp"]),
        source_ip=row["source_ip"],
        username=row["username"],
        outcome=row["outcome"],
        asset_id=row["asset_id"],
        metadata=metadata,
        created_at=datetime.fromisoformat(row["created_at"]),
    )


def insert_event(event: SecurityEvent, db_path: Optional[Union[str, Path]] = None) -> SecurityEvent:
    """
    Persist a normalized security event into the security_events table.
    Enforces a server-authoritative ingestion timestamp and parameterized execution.
    """
    ingest_time = datetime.now(timezone.utc)
    stored_event = event.model_copy(update={"created_at": ingest_time})

    with get_db(db_path) as conn:
        conn.execute(
            """
            INSERT INTO security_events (
                id, event_type, timestamp, source_ip, username, outcome, asset_id, details, created_at
            ) VALUES (
                :id, :event_type, :timestamp, :source_ip, :username, :outcome, :asset_id, :details, :created_at
            );
            """,
            {
                "id": stored_event.id,
                "event_type": stored_event.event_type,
                "timestamp": stored_event.timestamp.isoformat(),
                "source_ip": stored_event.source_ip,
                "username": stored_event.username,
                "outcome": stored_event.outcome.value,
                "asset_id": stored_event.asset_id,
                "details": json.dumps(stored_event.metadata),
                "created_at": stored_event.created_at.isoformat(),
            },
        )

    return stored_event


def get_event_by_id(event_id: str, db_path: Optional[Union[str, Path]] = None) -> Optional[SecurityEvent]:
    """Retrieve a single security event by its unique ID, or None if not found."""
    with get_db(db_path) as conn:
        cursor = conn.execute(
            """
            SELECT id, event_type, timestamp, source_ip, username, outcome, asset_id, details, created_at
            FROM security_events
            WHERE id = ?;
            """,
            (event_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        return row_to_event(row)


def get_events(
    limit: int = 50,
    offset: int = 0,
    db_path: Optional[Union[str, Path]] = None,
) -> List[SecurityEvent]:
    """
    Retrieve stored security events with pagination, sorted newest first.
    Returns an empty list if no events are found.
    """
    with get_db(db_path) as conn:
        cursor = conn.execute(
            """
            SELECT id, event_type, timestamp, source_ip, username, outcome, asset_id, details, created_at
            FROM security_events
            ORDER BY timestamp DESC, created_at DESC
            LIMIT ? OFFSET ?;
            """,
            (limit, offset),
        )
        rows = cursor.fetchall()
        return [row_to_event(row) for row in rows]


def count_events(db_path: Optional[Union[str, Path]] = None) -> int:
    """Return the total number of security events stored in the database."""
    with get_db(db_path) as conn:
        cursor = conn.execute("SELECT COUNT(*) AS total FROM security_events;")
        row = cursor.fetchone()
        return int(row["total"]) if row else 0
