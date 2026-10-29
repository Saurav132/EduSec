"""Detection orchestration service for evaluating events and persisting alerts."""

from datetime import datetime, timezone, timedelta
from pathlib import Path
import threading
from typing import List, Optional, Union

from backend.app.detectors.engine import DetectionEngine
from backend.app.models.alert import Alert, DetectionRunSummary
from backend.app.models.event import SecurityEvent
from backend.app.storage.alert_repo import insert_alert
from backend.app.storage.db import get_db
from backend.app.storage.event_repo import row_to_event

_detection_lock = threading.Lock()


def get_stored_events_for_detection(
    lookback_seconds: Optional[int] = None,
    db_path: Optional[Union[str, Path]] = None,
) -> List[SecurityEvent]:
    """
    Fetch stored events ordered chronologically (timestamp ASC) for correlation rules.
    If lookback_seconds is provided, limits events to that trailing window.
    """
    query = """
    SELECT id, event_type, timestamp, source_ip, username, outcome, asset_id, details, created_at
    FROM security_events
    """
    params: list = []

    if lookback_seconds is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=lookback_seconds)
        query += " WHERE timestamp >= ?"
        params.append(cutoff.isoformat())

    query += " ORDER BY timestamp ASC, created_at ASC;"

    with get_db(db_path) as conn:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [row_to_event(row) for row in rows]


def run_detection_cycle(
    lookback_seconds: Optional[int] = None,
    engine: Optional[DetectionEngine] = None,
    db_path: Optional[Union[str, Path]] = None,
) -> DetectionRunSummary:
    """
    Execute detection cycle:
    1. Locks detection execution to prevent concurrent duplicate generation.
    2. Fetches stored events in chronological order.
    3. Runs registered detection rules.
    4. Persists any matches using deterministic evidence fingerprints.
    5. Returns a structured DetectionRunSummary.
    """
    if engine is None:
        engine = DetectionEngine()

    with _detection_lock:
        events = get_stored_events_for_detection(lookback_seconds=lookback_seconds, db_path=db_path)
        detection_results = engine.evaluate_events(events)

        new_alerts: List[Alert] = []
        existing_count = 0

        for result in detection_results:
            alert = Alert(
                rule_id=result.rule_id,
                title=result.title,
                description=result.description,
                severity=result.severity,
                related_event_ids=result.related_event_ids,
                evidence=result.evidence,
                fingerprint=result.fingerprint,
            )
            saved_alert, is_new = insert_alert(alert, db_path)
            if is_new:
                new_alerts.append(saved_alert)
            else:
                existing_count += 1

        return DetectionRunSummary(
            events_evaluated=len(events),
            alerts_created=len(new_alerts),
            alerts_existing=existing_count,
            new_alerts=new_alerts,
        )
