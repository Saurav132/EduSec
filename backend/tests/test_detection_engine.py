"""Comprehensive automated tests for detection rules, alert persistence, and detection APIs."""

from datetime import datetime, timezone
import sqlite3
import pytest
from fastapi.testclient import TestClient

from backend.app.detectors.base import compute_evidence_fingerprint
from backend.app.detectors.rules.failed_logins import RepeatedFailedLoginsRule
from backend.app.detectors.rules.login_after_failures import LoginAfterFailuresRule
from backend.app.models.alert import AlertSeverity
from backend.app.models.event import EventOutcome, SecurityEvent


def make_event(
    event_type: str = "authentication",
    timestamp: str = "2026-10-15T10:00:00Z",
    source_ip: str = "192.168.1.100",
    username: str = "admin",
    outcome: EventOutcome = EventOutcome.FAILURE,
    asset_id: str = "srv-01",
) -> SecurityEvent:
    """Helper to create a validated SecurityEvent for detector unit testing."""
    return SecurityEvent(
        event_type=event_type,
        timestamp=datetime.fromisoformat(timestamp),
        source_ip=source_ip,
        username=username,
        outcome=outcome,
        asset_id=asset_id,
    )


# ---------------------------------------------------------------------------
# Unit Tests for Detection Rules
# ---------------------------------------------------------------------------


def test_four_failed_attempts_do_not_trigger_ng_auth_001():
    """1. Four failed attempts do not trigger NG-AUTH-001 (threshold is 5)."""
    rule = RepeatedFailedLoginsRule(threshold=5, window_seconds=300)
    events = [
        make_event(timestamp=f"2026-10-15T10:0{i}:00Z", outcome=EventOutcome.FAILURE)
        for i in range(4)
    ]
    results = rule.evaluate(events)
    assert len(results) == 0


def test_five_failed_attempts_within_window_trigger_ng_auth_001():
    """2. Five failed attempts within five minutes trigger NG-AUTH-001."""
    rule = RepeatedFailedLoginsRule(threshold=5, window_seconds=300)
    events = [
        make_event(timestamp=f"2026-10-15T10:0{i}:00Z", outcome=EventOutcome.FAILURE)
        for i in range(5)
    ]
    results = rule.evaluate(events)
    assert len(results) == 1
    match = results[0]
    assert match.rule_id == "NG-AUTH-001"
    assert match.severity == AlertSeverity.HIGH
    assert len(match.related_event_ids) == 5
    assert match.evidence["source_ip"] == "192.168.1.100"
    assert match.evidence["failed_attempts_count"] == 5
    assert match.evidence["threshold"] == 5


def test_five_attempts_spread_outside_window_do_not_trigger():
    """3. Five attempts spread outside the 5-minute window do not trigger NG-AUTH-001."""
    rule = RepeatedFailedLoginsRule(threshold=5, window_seconds=300)
    # Events spaced 6 minutes apart (360 seconds > 300 seconds window)
    events = [
        make_event(timestamp=f"2026-10-15T10:{i*6:02d}:00Z", outcome=EventOutcome.FAILURE)
        for i in range(5)
    ]
    results = rule.evaluate(events)
    assert len(results) == 0


def test_events_from_different_ips_not_combined():
    """4. Events from different source IPs are not incorrectly combined."""
    rule = RepeatedFailedLoginsRule(threshold=5, window_seconds=300)
    # 3 from 10.0.0.1, 3 from 10.0.0.2 within the same 5-minute window
    events = [
        make_event(timestamp="2026-10-15T10:00:10Z", source_ip="10.0.0.1"),
        make_event(timestamp="2026-10-15T10:00:20Z", source_ip="10.0.0.2"),
        make_event(timestamp="2026-10-15T10:00:30Z", source_ip="10.0.0.1"),
        make_event(timestamp="2026-10-15T10:00:40Z", source_ip="10.0.0.2"),
        make_event(timestamp="2026-10-15T10:00:50Z", source_ip="10.0.0.1"),
        make_event(timestamp="2026-10-15T10:01:00Z", source_ip="10.0.0.2"),
    ]
    results = rule.evaluate(events)
    assert len(results) == 0


def test_non_authentication_events_are_ignored():
    """5. Non-authentication events (e.g. network_flow, file_access) are ignored."""
    rule = RepeatedFailedLoginsRule(threshold=5, window_seconds=300)
    events = [
        make_event(event_type="network_flow", timestamp=f"2026-10-15T10:0{i}:00Z")
        for i in range(5)
    ]
    results = rule.evaluate(events)
    assert len(results) == 0


def test_successful_login_after_five_failures_triggers_ng_auth_002():
    """6. A successful login after five qualifying failures triggers NG-AUTH-002."""
    rule = LoginAfterFailuresRule(threshold=5, window_seconds=300)
    events = [
        make_event(timestamp=f"2026-10-15T10:0{i}:00Z", outcome=EventOutcome.FAILURE)
        for i in range(5)
    ]
    # Success event at 10:04:30 from same IP
    success_event = make_event(
        timestamp="2026-10-15T10:04:30Z",
        outcome=EventOutcome.SUCCESS,
        username="admin",
    )
    events.append(success_event)

    results = rule.evaluate(events)
    assert len(results) == 1
    match = results[0]
    assert match.rule_id == "NG-AUTH-002"
    assert match.severity == AlertSeverity.HIGH
    assert len(match.related_event_ids) == 6  # 1 success + 5 failures
    assert match.evidence["successful_event_id"] == success_event.id
    assert match.evidence["preceding_failed_count"] == 5


def test_successful_login_without_qualifying_failures_does_not_trigger():
    """7. A successful login without qualifying preceding failures does not trigger NG-AUTH-002."""
    rule = LoginAfterFailuresRule(threshold=5, window_seconds=300)
    # Only 2 preceding failures
    events = [
        make_event(timestamp="2026-10-15T10:00:00Z", outcome=EventOutcome.FAILURE),
        make_event(timestamp="2026-10-15T10:01:00Z", outcome=EventOutcome.FAILURE),
        make_event(timestamp="2026-10-15T10:02:00Z", outcome=EventOutcome.SUCCESS),
    ]
    results = rule.evaluate(events)
    assert len(results) == 0


def test_failures_after_successful_login_not_counted_as_preceding():
    """8. Failures after a successful login are not counted as preceding failures."""
    rule = LoginAfterFailuresRule(threshold=5, window_seconds=300)
    # Success first at 10:00:00, then 5 failures AFTER it
    events = [make_event(timestamp="2026-10-15T10:00:00Z", outcome=EventOutcome.SUCCESS)]
    for i in range(1, 6):
        events.append(
            make_event(timestamp=f"2026-10-15T10:0{i}:00Z", outcome=EventOutcome.FAILURE)
        )

    results = rule.evaluate(events)
    # Failures occur after success, so NG-AUTH-002 must not trigger
    assert len(results) == 0


def test_missing_source_ip_does_not_crash_detection():
    """9. Missing or empty source IP does not crash detection."""
    r1 = RepeatedFailedLoginsRule(threshold=5, window_seconds=300)
    r2 = LoginAfterFailuresRule(threshold=5, window_seconds=300)

    events = [
        SecurityEvent(
            event_type="authentication",
            timestamp=datetime.now(timezone.utc),
            source_ip=None,
            outcome=EventOutcome.FAILURE,
        )
        for _ in range(6)
    ]
    assert len(r1.evaluate(events)) == 0
    assert len(r2.evaluate(events)) == 0


# ---------------------------------------------------------------------------
# Integration Tests: Detection Execution, Deduplication & Alert APIs
# ---------------------------------------------------------------------------


def test_detection_run_and_alert_attributes(client: TestClient):
    """
    10. Alerts contain the correct rule ID, severity, and supporting event IDs.
    """
    # Ingest 5 failed authentication events from same IP
    for i in range(5):
        resp = client.post(
            "/api/v1/events",
            json={
                "event_type": "authentication",
                "timestamp": f"2026-10-15T11:0{i}:00Z",
                "source_ip": "198.51.100.25",
                "username": f"user_{i}",
                "outcome": "failed",
            },
        )
        assert resp.status_code == 201

    # Trigger detection run
    run_resp = client.post("/api/v1/detections/run")
    assert run_resp.status_code == 200
    summary = run_resp.json()

    assert summary["events_evaluated"] == 5
    assert summary["alerts_created"] == 1
    assert summary["alerts_existing"] == 0
    assert len(summary["new_alerts"]) == 1

    alert = summary["new_alerts"][0]
    assert alert["rule_id"] == "NG-AUTH-001"
    assert alert["severity"] == "high"
    assert len(alert["related_event_ids"]) == 5
    assert alert["evidence"]["source_ip"] == "198.51.100.25"
    assert alert["fingerprint"] is not None


def test_rerunning_detection_does_not_duplicate_alerts(client: TestClient):
    """
    11. Re-running detection does not duplicate the same alert.
    """
    for i in range(5):
        client.post(
            "/api/v1/events",
            json={
                "event_type": "authentication",
                "timestamp": f"2026-10-15T12:0{i}:00Z",
                "source_ip": "198.51.100.50",
                "outcome": "failed",
            },
        )

    # First run creates alert
    run1 = client.post("/api/v1/detections/run")
    assert run1.status_code == 200
    assert run1.json()["alerts_created"] == 1
    assert run1.json()["alerts_existing"] == 0

    # Second run detects existing alert and suppresses duplicate
    run2 = client.post("/api/v1/detections/run")
    assert run2.status_code == 200
    assert run2.json()["alerts_created"] == 0
    assert run2.json()["alerts_existing"] == 1

    # Database still contains exactly 1 alert
    list_alerts = client.get("/api/v1/alerts")
    assert list_alerts.status_code == 200
    assert len(list_alerts.json()) == 1


def test_distinct_evidence_creates_distinct_alerts(client: TestClient):
    """
    12. Distinct evidence sets create distinct alerts.
    """
    # 5 failures from IP 1
    for i in range(5):
        client.post(
            "/api/v1/events",
            json={
                "event_type": "authentication",
                "timestamp": f"2026-10-15T13:0{i}:00Z",
                "source_ip": "203.0.113.1",
                "outcome": "failed",
            },
        )

    # 5 failures from IP 2
    for i in range(5):
        client.post(
            "/api/v1/events",
            json={
                "event_type": "authentication",
                "timestamp": f"2026-10-15T13:0{i}:00Z",
                "source_ip": "203.0.113.2",
                "outcome": "failed",
            },
        )

    run_resp = client.post("/api/v1/detections/run")
    assert run_resp.status_code == 200
    summary = run_resp.json()
    assert summary["alerts_created"] == 2

    # Verify both distinct alerts are present in the list
    alerts_resp = client.get("/api/v1/alerts")
    assert alerts_resp.status_code == 200
    alerts = alerts_resp.json()
    assert len(alerts) == 2
    source_ips = {a["evidence"]["source_ip"] for a in alerts}
    assert source_ips == {"203.0.113.1", "203.0.113.2"}


def test_alert_listing_and_detail_endpoints(client: TestClient):
    """
    13. Alert listing and detail endpoints work correctly with filters and pagination.
    """
    # Ingest 5 failures + 1 success to trigger both NG-AUTH-001 and NG-AUTH-002
    for i in range(5):
        client.post(
            "/api/v1/events",
            json={
                "event_type": "authentication",
                "timestamp": f"2026-10-15T14:0{i}:00Z",
                "source_ip": "198.51.100.99",
                "outcome": "failed",
            },
        )
    client.post(
        "/api/v1/events",
        json={
            "event_type": "authentication",
            "timestamp": "2026-10-15T14:04:45Z",
            "source_ip": "198.51.100.99",
            "outcome": "success",
        },
    )

    client.post("/api/v1/detections/run")

    # 1. List alerts
    list_resp = client.get("/api/v1/alerts")
    assert list_resp.status_code == 200
    alerts = list_resp.json()
    assert len(alerts) == 2
    assert list_resp.headers.get("X-Total-Count") == "2"

    first_alert_id = alerts[0]["id"]

    # 2. Detail lookup
    detail_resp = client.get(f"/api/v1/alerts/{first_alert_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["id"] == first_alert_id
    assert "evidence" in detail
    assert "related_event_ids" in detail

    # 3. Filtering by rule_id
    r1_resp = client.get("/api/v1/alerts?rule_id=NG-AUTH-001")
    assert r1_resp.status_code == 200
    assert len(r1_resp.json()) == 1

    r2_resp = client.get("/api/v1/alerts?rule_id=NG-AUTH-002")
    assert r2_resp.status_code == 200
    assert len(r2_resp.json()) == 1

    # 4. Filtering by severity
    high_resp = client.get("/api/v1/alerts?severity=high")
    assert high_resp.status_code == 200
    assert len(high_resp.json()) == 2

    low_resp = client.get("/api/v1/alerts?severity=low")
    assert low_resp.status_code == 200
    assert len(low_resp.json()) == 0


def test_unknown_alert_id_returns_404(client: TestClient):
    """
    14. Unknown alert IDs return 404 Not Found.
    """
    response = client.get("/api/v1/alerts/nonexistent-uuid-12345")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_invalid_filter_values_return_422(client: TestClient):
    """
    15. Invalid filter values (e.g. unknown severity or invalid bounds) are handled correctly.
    """
    assert client.get("/api/v1/alerts?severity=super_critical").status_code == 422
    assert client.get("/api/v1/alerts?status=invalid_status").status_code == 422
    assert client.get("/api/v1/alerts?limit=0").status_code == 422
    assert client.get("/api/v1/alerts?limit=150").status_code == 422
    assert client.get("/api/v1/alerts?offset=-1").status_code == 422


def test_database_error_handling_in_detection_and_alerts(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    """
    16. Database errors do not produce false success responses and do not leak stack traces.
    """
    def raise_db_error(*args, **kwargs):
        raise sqlite3.OperationalError("database is locked")

    # Error during detection run
    monkeypatch.setattr("backend.app.api.v1.detections.run_detection_cycle", raise_db_error)
    det_resp = client.post("/api/v1/detections/run")
    assert det_resp.status_code == 500
    assert det_resp.json()["detail"] == "Failed to execute detection cycle"
    assert "sqlite" not in det_resp.json()["detail"].lower()

    # Error during alert list query
    monkeypatch.setattr("backend.app.api.v1.alerts.get_alerts", raise_db_error)
    alerts_resp = client.get("/api/v1/alerts")
    assert alerts_resp.status_code == 500
    assert alerts_resp.json()["detail"] == "Failed to retrieve alerts from database"
    assert "sqlite" not in alerts_resp.json()["detail"].lower()
