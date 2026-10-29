"""Tests for SecurityEvent Pydantic schema validation."""

from datetime import datetime, timezone, timedelta
import pytest
from pydantic import ValidationError

from backend.app.models.event import SecurityEvent, EventOutcome


def test_valid_event_schema():
    """Verify that a correctly formatted event dictionary instantiates SecurityEvent."""
    now = datetime.now(timezone.utc)
    event = SecurityEvent(
        event_type="auth_login",
        timestamp=now,
        source_ip="192.168.1.50",
        username="admin",
        outcome=EventOutcome.SUCCESS,
        asset_id="server-auth-01",
        metadata={"port": 22, "protocol": "ssh"},
    )

    assert event.event_type == "auth_login"
    assert event.source_ip == "192.168.1.50"
    assert event.username == "admin"
    assert event.outcome == EventOutcome.SUCCESS
    assert event.asset_id == "server-auth-01"
    assert event.metadata["port"] == 22
    assert event.timestamp.tzinfo == timezone.utc
    assert isinstance(event.id, str) and len(event.id) > 0


def test_valid_ipv6_address():
    """Verify that IPv6 addresses are accepted and normalized."""
    event = SecurityEvent(
        event_type="network_flow",
        timestamp=datetime.now(timezone.utc),
        source_ip="2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        outcome=EventOutcome.SUCCESS,
    )
    assert event.source_ip == "2001:db8:85a3::8a2e:370:7334"


def test_invalid_ip_addresses():
    """Verify that invalid IP addresses are rejected with ValidationError."""
    invalid_ips = [
        "999.999.999.999",
        "192.168.1.300",
        "not_an_ip",
        "192.168.1",
        "",  # Empty string is rejected (must be None/omitted)
        "   ",
    ]

    for ip in invalid_ips:
        with pytest.raises(ValidationError) as exc_info:
            SecurityEvent(
                event_type="auth_login",
                timestamp=datetime.now(timezone.utc),
                source_ip=ip,
                outcome=EventOutcome.FAILURE,
            )
        assert "source_ip" in str(exc_info.value)


def test_missing_required_fields():
    """Verify that missing required fields trigger validation errors."""
    # Missing event_type
    with pytest.raises(ValidationError) as exc:
        SecurityEvent(  # type: ignore[call-arg]
            timestamp=datetime.now(timezone.utc),
            outcome=EventOutcome.SUCCESS,
        )
    assert "event_type" in str(exc.value)

    # Missing outcome
    with pytest.raises(ValidationError) as exc:
        SecurityEvent(  # type: ignore[call-arg]
            event_type="auth_login",
            timestamp=datetime.now(timezone.utc),
        )
    assert "outcome" in str(exc.value)


def test_invalid_event_outcome():
    """Verify that arbitrary outcome strings are rejected."""
    with pytest.raises(ValidationError) as exc:
        SecurityEvent(
            event_type="auth_login",
            timestamp=datetime.now(timezone.utc),
            outcome="unknown_status",  # type: ignore[arg-type]
        )
    assert "outcome" in str(exc.value)


def test_empty_or_whitespace_event_type():
    """Verify that blank event_type values are rejected."""
    for empty in ["", "   ", "\t"]:
        with pytest.raises(ValidationError):
            SecurityEvent(
                event_type=empty,
                timestamp=datetime.now(timezone.utc),
                outcome=EventOutcome.FAILURE,
            )


def test_timestamp_utc_conversion():
    """Verify that non-UTC timezone timestamps are normalized to UTC."""
    # Create timestamp with +05:30 offset
    tz_offset = timezone(timedelta(hours=5, minutes=30))
    local_time = datetime(2026, 10, 14, 18, 0, 0, tzinfo=tz_offset)

    event = SecurityEvent(
        event_type="auth_login",
        timestamp=local_time,
        outcome=EventOutcome.SUCCESS,
    )

    # In UTC, 18:00 +05:30 is 12:30 UTC
    assert event.timestamp.tzinfo == timezone.utc
    assert event.timestamp.hour == 12
    assert event.timestamp.minute == 30
