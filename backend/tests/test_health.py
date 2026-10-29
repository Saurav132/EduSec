"""Tests for the /api/v1/health endpoint."""

from pathlib import Path
from fastapi.testclient import TestClient
import pytest

from backend.app.core.config import Settings
from backend.app.main import create_application


def test_health_endpoint_success(client: TestClient):
    """Verify that /api/v1/health returns 200 and healthy status when DB is ready."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app_name"] == "EduSec"
    assert data["api_version"] == "0.1.0"
    assert data["database"]["ready"] is True
    assert "initialized and reachable" in data["database"]["details"]


def test_health_endpoint_degraded_when_uninitialized(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """Verify that /api/v1/health returns 503 and degraded status when DB tables are missing."""
    empty_db = tmp_path / "uninitialized.db"
    settings = Settings(
        app_name="EduSec",
        app_version="0.1.0",
        database_path=str(empty_db),
    )
    monkeypatch.setattr("backend.app.core.config.get_settings", lambda: settings)
    monkeypatch.setattr("backend.app.storage.db.get_settings", lambda: settings)
    monkeypatch.setattr("backend.app.api.v1.health.get_settings", lambda: settings)

    # Note: we do NOT call init_db here to simulate an uninitialized state
    # We bypass lifespan by instantiating TestClient without lifespan or mocking init_db
    monkeypatch.setattr("backend.app.main.init_db", lambda: None)
    app = create_application()

    with TestClient(app) as unready_client:
        response = unready_client.get("/api/v1/health")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database"]["ready"] is False
        assert "Missing required database tables" in data["database"]["details"]
