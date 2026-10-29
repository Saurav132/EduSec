"""API v1 routing endpoints."""

from backend.app.api.v1.health import router as health_router
from backend.app.api.v1.events import router as events_router
from backend.app.api.v1.alerts import router as alerts_router
from backend.app.api.v1.detections import router as detections_router

__all__ = [
    "health_router",
    "events_router",
    "alerts_router",
    "detections_router",
]
