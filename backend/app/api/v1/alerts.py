"""Alert management and retrieval API endpoints."""

import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Response, status as http_status

from backend.app.models.alert import Alert, AlertSeverity, AlertStatus
from backend.app.storage.alert_repo import (
    count_alerts,
    get_alert_by_id,
    get_alerts,
)

logger = logging.getLogger("edusec.alerts")
router = APIRouter(tags=["Alerts"])


@router.get(
    "",
    response_model=List[Alert],
    summary="List Security Alerts",
    description="Retrieve paginated security alerts, ordered newest first, with optional filtering by severity, status, or rule ID.",
)
def list_alerts(
    response: Response,
    severity: Optional[AlertSeverity] = Query(default=None, description="Filter by alert severity (low, medium, high, critical)"),
    status_filter: Optional[AlertStatus] = Query(default=None, alias="status", description="Filter by alert status (open, acknowledged, resolved, closed)"),
    rule_id: Optional[str] = Query(default=None, max_length=50, description="Filter by detection rule ID (e.g. NG-AUTH-001)"),
    limit: int = Query(default=50, ge=1, le=100, description="Maximum number of alerts to return (1-100)"),
    offset: int = Query(default=0, ge=0, description="Number of alerts to skip"),
) -> List[Alert]:
    """Retrieve stored alerts with pagination and filtering."""
    try:
        sev_val = severity.value if severity else None
        stat_val = status_filter.value if status_filter else None
        alerts = get_alerts(
            severity=sev_val,
            status=stat_val,
            rule_id=rule_id,
            limit=limit,
            offset=offset,
        )
        total = count_alerts(
            severity=sev_val,
            status=stat_val,
            rule_id=rule_id,
        )
        response.headers["X-Total-Count"] = str(total)
        return alerts
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to query alerts: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve alerts from database",
        ) from None


@router.get(
    "/{alert_id}",
    response_model=Alert,
    summary="Get Alert by ID",
    description="Retrieve an individual security alert with its complete detection evidence by alert ID.",
)
def get_alert(alert_id: str) -> Alert:
    """Fetch an individual alert by unique ID."""
    try:
        alert = get_alert_by_id(alert_id)
        if not alert:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Alert '{alert_id}' not found",
            )
        return alert
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to fetch alert %s: %s", alert_id, exc, exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch alert from database",
        ) from None
