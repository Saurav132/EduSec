"""Database connection management and storage operations."""

from backend.app.storage.db import (
    init_db,
    get_db,
    get_db_connection,
    check_db_readiness,
)
from backend.app.storage.event_repo import (
    insert_event,
    get_event_by_id,
    get_events,
    count_events,
)
from backend.app.storage.alert_repo import (
    insert_alert,
    get_alert_by_id,
    get_alert_by_fingerprint,
    get_alerts,
    count_alerts,
)

__all__ = [
    "init_db",
    "get_db",
    "get_db_connection",
    "check_db_readiness",
    "insert_event",
    "get_event_by_id",
    "get_events",
    "count_events",
    "insert_alert",
    "get_alert_by_id",
    "get_alert_by_fingerprint",
    "get_alerts",
    "count_alerts",
]
