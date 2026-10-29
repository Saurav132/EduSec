"""Application configuration and environment settings."""

from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory for the backend (EduSec/backend)
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """System settings loaded from environment variables or .env file."""

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "EduSec"
    app_version: str = "0.1.0"
    environment: str = "development"
    debug: bool = True
    api_v1_str: str = "/api/v1"

    # SQLite database location (default: backend/data/edusec.db)
    database_path: str = "data/edusec.db"

    # Local server settings
    host: str = "127.0.0.1"
    port: int = 8000

    # Detection rule thresholds
    auth_failure_threshold: int = 5
    auth_window_seconds: int = 300  # 5 minutes rolling window

    @property
    def resolved_database_path(self) -> Path:
        """
        Resolve SQLite path reliably.
        If a relative path is provided, it is anchored to the backend directory.
        """
        p = Path(self.database_path)
        if p.is_absolute():
            return p
        return BACKEND_DIR / p


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings instance."""
    return Settings()
