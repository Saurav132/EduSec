"""Security event ingestion and retrieval API endpoints."""

import logging
from typing import List
from fastapi import APIRouter, HTTPException, Query, Response, status

from backend.app.models.event import SecurityEvent
from backend.app.storage.event_repo import (
    count_events,
    get_event_by_id,
    get_events,
    insert_event,
)

logger = logging.getLogger("edusec.events")
router = APIRouter(tags=["Security Events"])


@router.post(
    "",
    response_model=SecurityEvent,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest Security Event",
    description="Validate, normalize, and persist a single synthetic security event into the SIEM database.",
)
def ingest_security_event(event: SecurityEvent) -> SecurityEvent:
    """
    Ingest a security event:
    - Strictly validates schema, UTC timestamps, and IP addresses.
    - Normalizes outcomes (e.g. 'failed' -> 'failure').
    - Preserves structured metadata without code execution.
    - Persists to SQLite using parameterized statements.
    """
    try:
        stored_event = insert_event(event)
        return stored_event
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to persist security event: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist security event to database",
        ) from None


@router.get(
    "",
    response_model=List[SecurityEvent],
    summary="List Security Events",
    description="Retrieve paginated security events, ordered newest first (by event timestamp and ingestion time).",
)
def list_security_events(
    response: Response,
    limit: int = Query(default=50, ge=1, le=100, description="Maximum number of events to return (1-100)"),
    offset: int = Query(default=0, ge=0, description="Number of events to skip"),
) -> List[SecurityEvent]:
    """
    Retrieve stored security events:
    - Returns newest events first.
    - Emits standard X-Total-Count header for UI pagination.
    - Returns an empty list [] when no events match or exist.
    """
    try:
        events = get_events(limit=limit, offset=offset)
        total = count_events()
        response.headers["X-Total-Count"] = str(total)
        return events
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to query security events: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve security events from database",
        ) from None


@router.get(
    "/{event_id}",
    response_model=SecurityEvent,
    summary="Get Security Event by ID",
    description="Fetch full details for an individual security event by its unique identifier.",
)
def get_security_event(event_id: str) -> SecurityEvent:
    """Fetch an individual security event by unique ID."""
    try:
        event = get_event_by_id(event_id)
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Security event '{event_id}' not found",
            )
        return event
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to fetch security event %s: %s", event_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch security event from database",
        ) from None
