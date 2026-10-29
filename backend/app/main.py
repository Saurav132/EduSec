"""FastAPI application entrypoint for EduSec."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.v1.alerts import router as alerts_router
from backend.app.api.v1.detections import router as detections_router
from backend.app.api.v1.events import router as events_router
from backend.app.api.v1.health import router as health_router
from backend.app.core.config import get_settings
from backend.app.storage.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Initializes the SQLite database tables on startup.
    """
    # Ensure database tables and indexes exist on application boot
    init_db()
    yield


def create_application() -> FastAPI:
    """Application factory for EduSec API."""
    settings = get_settings()

    app = FastAPI(
        title=f"{settings.app_name} - Security Monitoring API",
        version=settings.app_version,
        description="Lightweight SIEM backend for event normalization, rule-based detection, and incident response.",
        lifespan=lifespan,
    )

    # Enable CORS for local development (Vite React frontend)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    # Mount API v1 routes
    app.include_router(health_router, prefix=settings.api_v1_str)
    app.include_router(events_router, prefix=f"{settings.api_v1_str}/events")
    app.include_router(alerts_router, prefix=f"{settings.api_v1_str}/alerts")
    app.include_router(detections_router, prefix=f"{settings.api_v1_str}/detections")

    @app.get("/", tags=["Root"])
    def root():
        return {
            "message": f"Welcome to {settings.app_name} API",
            "docs": "/docs",
            "health": f"{settings.api_v1_str}/health",
            "events": f"{settings.api_v1_str}/events",
            "alerts": f"{settings.api_v1_str}/alerts",
            "detections": f"{settings.api_v1_str}/detections/run",
        }

    return app


app = create_application()
