"""Normalized security event schema with strict validation."""

import ipaddress
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class EventOutcome(str, Enum):
    """Normalized outcomes for security events."""
    SUCCESS = "success"
    FAILURE = "failure"
    UNKNOWN = "unknown"


class SecurityEvent(BaseModel):
    """
    Validated representation of a normalized security event.
    Enforces UTC timestamps, valid IP format when present, and non-empty event types.
    """
    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique identifier for the security event",
    )
    event_type: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Type of the event, e.g., authentication, network_flow, privilege_escalation",
    )
    timestamp: datetime = Field(
        ...,
        description="Time the security event occurred, normalized to UTC",
    )
    source_ip: Optional[str] = Field(
        default=None,
        description="Originating IPv4 or IPv6 address if known",
    )
    username: Optional[str] = Field(
        default=None,
        max_length=150,
        description="Associated user or principal account name",
    )
    outcome: EventOutcome = Field(
        ...,
        description="Outcome of the event: success, failure, or unknown",
    )
    asset_id: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Affected asset, server, or resource identifier",
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional structured context (e.g. port, protocol, user_agent)",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp when this event was ingested/recorded in UTC",
    )

    @model_validator(mode="before")
    @classmethod
    def preserve_extra_fields_in_metadata(cls, data: Any) -> Any:
        """
        Preserve any incoming structured top-level fields that are not in the primary schema
        by safely moving them into the metadata dictionary rather than silently discarding them.
        """
        if isinstance(data, dict):
            known_fields = {
                "id",
                "event_type",
                "timestamp",
                "source_ip",
                "username",
                "outcome",
                "asset_id",
                "metadata",
                "created_at",
            }
            extra_keys = [k for k in data.keys() if k not in known_fields]
            if extra_keys:
                meta = dict(data.get("metadata") or {})
                for k in extra_keys:
                    if k not in meta:
                        meta[k] = data[k]
                data["metadata"] = meta
        return data

    @field_validator("id")
    @classmethod
    def validate_id(cls, v: Optional[str]) -> str:
        """Ensure non-empty ID or generate server-side UUIDv4."""
        if v is None or not str(v).strip():
            return str(uuid.uuid4())
        return str(v).strip()

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("event_type must not be empty or whitespace only")
        return trimmed

    @field_validator("outcome", mode="before")
    @classmethod
    def normalize_outcome(cls, v: Any) -> Any:
        """
        Normalize varied event outcome representations (e.g. 'failed' -> 'failure')
        while strictly rejecting invalid outcomes.
        """
        if isinstance(v, str):
            cleaned = v.strip().lower()
            if cleaned in ("failed", "failure", "fail"):
                return EventOutcome.FAILURE
            if cleaned in ("success", "successful", "succeeded"):
                return EventOutcome.SUCCESS
            if cleaned == "unknown":
                return EventOutcome.UNKNOWN
        return v

    @field_validator("source_ip")
    @classmethod
    def validate_source_ip(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("source_ip cannot be empty string; use null/None if unknown")
        try:
            # Validates both IPv4 and IPv6; rejects invalid octets and malformed strings
            ip_obj = ipaddress.ip_address(trimmed)
            return str(ip_obj)
        except ValueError as err:
            raise ValueError(f"Invalid IP address '{v}': {str(err)}") from err

    @field_validator("timestamp", "created_at")
    @classmethod
    def ensure_utc_timestamp(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            # If naive, assume UTC as per SOC standard
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)
