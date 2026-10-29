"""Data access repository for alerts in SQLite."""

from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
from typing import List, Optional, Tuple, Union

from backend.app.models.alert import Alert, AlertSeverity, AlertStatus
from backend.app.storage.db import get_db


def row_to_alert(row: sqlite3.Row) -> Alert:
    """Convert a SQLite Row from alerts table into a validated Alert model."""
    related_ids_raw = row["related_event_ids"]
    try:
        related_ids = json.loads(related_ids_raw) if related_ids_raw else []
        if not isinstance(related_ids, list):
            related_ids = [str(related_ids)]
    except Exception:
        related_ids = []

    evidence_raw = row["evidence"]
    try:
        evidence = json.loads(evidence_raw) if evidence_raw else {}
        if not isinstance(evidence, dict):
            evidence = {"raw": evidence_raw}
    except Exception:
        evidence = {}

    return Alert(
        id=row["id"],
        rule_id=row["rule_id"],
        title=row["title"],
        description=row["description"],
        severity=AlertSeverity(row["severity"]),
        related_event_ids=related_ids,
        evidence=evidence,
        fingerprint=row["fingerprint"],
        status=AlertStatus(row["status"]),
        created_at=datetime.fromisoformat(row["created_at"]),
    )


def get_alert_by_fingerprint(
    fingerprint: str,
    db_path: Optional[Union[str, Path]] = None,
) -> Optional[Alert]:
    """Retrieve an alert matching a specific evidence fingerprint."""
    with get_db(db_path) as conn:
        cursor = conn.execute(
            """
            SELECT id, rule_id, title, description, severity, related_event_ids, evidence, fingerprint, status, created_at
            FROM alerts
            WHERE fingerprint = ?;
            """,
            (fingerprint,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        return row_to_alert(row)


def insert_alert(
    alert: Alert,
    db_path: Optional[Union[str, Path]] = None,
) -> Tuple[Alert, bool]:
    """
    Persist an alert with fingerprint-based deduplication.
    Returns (alert, is_new).
    If an alert with the same fingerprint already exists, returns the existing record and False.
    """
    # 1. Check if an alert with identical fingerprint already exists
    if alert.fingerprint:
        existing = get_alert_by_fingerprint(alert.fingerprint, db_path)
        if existing:
            return existing, False

    # 2. Insert new alert
    created_at_time = datetime.now(timezone.utc)
    stored_alert = alert.model_copy(update={"created_at": created_at_time})

    with get_db(db_path) as conn:
        try:
            conn.execute(
                """
                INSERT INTO alerts (
                    id, rule_id, title, description, severity, related_event_ids, evidence, fingerprint, status, created_at
                ) VALUES (
                    :id, :rule_id, :title, :description, :severity, :related_event_ids, :evidence, :fingerprint, :status, :created_at
                );
                """,
                {
                    "id": stored_alert.id,
                    "rule_id": stored_alert.rule_id,
                    "title": stored_alert.title,
                    "description": stored_alert.description,
                    "severity": stored_alert.severity.value,
                    "related_event_ids": json.dumps(stored_alert.related_event_ids),
                    "evidence": json.dumps(stored_alert.evidence),
                    "fingerprint": stored_alert.fingerprint,
                    "status": stored_alert.status.value,
                    "created_at": stored_alert.created_at.isoformat(),
                },
            )
            return stored_alert, True
        except sqlite3.IntegrityError:
            # Handle race condition where fingerprint was inserted concurrently
            if stored_alert.fingerprint:
                existing = get_alert_by_fingerprint(stored_alert.fingerprint, db_path)
                if existing:
                    return existing, False
            raise


def get_alert_by_id(
    alert_id: str,
    db_path: Optional[Union[str, Path]] = None,
) -> Optional[Alert]:
    """Retrieve an alert by its primary ID."""
    with get_db(db_path) as conn:
        cursor = conn.execute(
            """
            SELECT id, rule_id, title, description, severity, related_event_ids, evidence, fingerprint, status, created_at
            FROM alerts
            WHERE id = ?;
            """,
            (alert_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        return row_to_alert(row)


def get_alerts(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    rule_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db_path: Optional[Union[str, Path]] = None,
) -> List[Alert]:
    """Retrieve stored alerts with optional filtering and pagination (newest first)."""
    query = """
    SELECT id, rule_id, title, description, severity, related_event_ids, evidence, fingerprint, status, created_at
    FROM alerts
    WHERE 1=1
    """
    params: list = []

    if severity:
        query += " AND severity = ?"
        params.append(severity)
    if status:
        query += " AND status = ?"
        params.append(status)
    if rule_id:
        query += " AND rule_id = ?"
        params.append(rule_id)

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?;"
    params.extend([limit, offset])

    with get_db(db_path) as conn:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [row_to_alert(row) for row in rows]


def count_alerts(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    rule_id: Optional[str] = None,
    db_path: Optional[Union[str, Path]] = None,
) -> int:
    """Return total alerts count matching the specified filters."""
    query = "SELECT COUNT(*) AS total FROM alerts WHERE 1=1"
    params: list = []

    if severity:
        query += " AND severity = ?"
        params.append(severity)
    if status:
        query += " AND status = ?"
        params.append(status)
    if rule_id:
        query += " AND rule_id = ?"
        params.append(rule_id)

    with get_db(db_path) as conn:
        cursor = conn.execute(query, params)
        row = cursor.fetchone()
        return int(row["total"]) if row else 0
