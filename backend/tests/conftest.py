"""Pytest configuration and shared fixtures for EduSec."""

from pathlib import Path
from typing import Generator
import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import Settings, get_settings
from backend.app.main import create_application
from backend.app.storage.db import init_db


@pytest.fixture
def test_db_path(tmp_path: Path) -> Path:
    """Return a unique temporary SQLite database file path."""
    return tmp_path / "test_edusec.db"


@pytest.fixture
def test_settings(test_db_path: Path) -> Settings:
    """Return Settings configured to use the temporary test database."""
    return Settings(
        app_name="EduSec",
        app_version="0.1.0",
        environment="test",
        debug=True,
        database_path=str(test_db_path),
        auth_failure_threshold=5,
        auth_window_seconds=300,
    )


@pytest.fixture
def isolated_db(test_settings: Settings, monkeypatch: pytest.MonkeyPatch) -> Path:
    """
    Ensure all modules referencing get_settings use the isolated test database,
    and initialize the test database schema.
    """
    monkeypatch.setattr("backend.app.core.config.get_settings", lambda: test_settings)
    monkeypatch.setattr("backend.app.storage.db.get_settings", lambda: test_settings)
    monkeypatch.setattr("backend.app.main.get_settings", lambda: test_settings)
    monkeypatch.setattr("backend.app.api.v1.health.get_settings", lambda: test_settings)
    monkeypatch.setattr("backend.app.detectors.rules.failed_logins.get_settings", lambda: test_settings)
    monkeypatch.setattr("backend.app.detectors.rules.login_after_failures.get_settings", lambda: test_settings)

    db_path = test_settings.resolved_database_path
    init_db(db_path)
    return db_path


@pytest.fixture
def client(isolated_db: Path) -> Generator[TestClient, None, None]:
    """Test client bound to application using the isolated temporary database."""
    app = create_application()
    with TestClient(app) as test_client:
        yield test_client
