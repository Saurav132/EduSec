"""Detection execution API endpoints."""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from backend.app.models.alert import DetectionRunSummary
from backend.app.services.detection_service import run_detection_cycle

logger = logging.getLogger("edusec.detections")
router = APIRouter(tags=["Detections"])


@router.post(
    "/run",
    response_model=DetectionRunSummary,
    summary="Execute Detection Engine",
    description="Trigger a detection cycle across stored events. Evaluates active rules, identifies suspicious activity, and creates persistent alerts with evidence.",
)
def run_detections(
    lookback_minutes: Optional[int] = Query(
        default=None,
        ge=1,
        le=1440,
        description="Optional bounded trailing time window in minutes (e.g. 60 for the last hour). If omitted, evaluates all stored events.",
    ),
) -> DetectionRunSummary:
    """
    Run detection engine over stored events.
    Suppresses duplicate alerts using evidence fingerprinting.
    Protected against concurrent execution.
    """
    try:
        lookback_seconds = lookback_minutes * 60 if lookback_minutes is not None else None
        summary = run_detection_cycle(lookback_seconds=lookback_seconds)
        return summary
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Detection cycle execution failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to execute detection cycle",
        ) from None
