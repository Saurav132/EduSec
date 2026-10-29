"""Health check API endpoint."""

from fastapi import APIRouter, Response, status
from pydantic import BaseModel

from backend.app.core.config import get_settings
from backend.app.storage.db import check_db_readiness

router = APIRouter(tags=["Health"])


class DatabaseHealth(BaseModel):
    ready: bool
    details: str


class HealthResponse(BaseModel):
    status: str
    app_name: str
    api_version: str
    database: DatabaseHealth


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service Health Check",
    description="Check application availability and database initialization readiness.",
)
def get_health(response: Response) -> HealthResponse:
    settings = get_settings()
    db_ready, db_details = check_db_readiness()

    if not db_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    return HealthResponse(
        status=overall_status,
        app_name=settings.app_name,
        api_version=settings.app_version,
        database=DatabaseHealth(
            ready=db_ready,
            details=db_details,
        ),
    )
