"""Automated tests for security event ingestion, normalization, and retrieval."""

import sqlite3
import pytest
from fastapi.testclient import TestClient


def test_empty_events_list_when_no_events_exist(client: TestClient):
    """Verify that GET /api/v1/events returns an empty list [] when no events exist."""
    response = client.get("/api/v1/events")
    assert response.status_code == 200
    assert response.json() == []
    assert response.headers.get("X-Total-Count") == "0"


def test_valid_event_ingested_and_stored(client: TestClient):
    """
    1. A valid event is accepted and stored.
    Verifies that POST /api/v1/events returns 201, assigns an ID,
    normalizes outcome 'failed' -> 'failure', and preserves metadata.
    """
    payload = {
        "event_type": "authentication",
        "timestamp": "2026-10-15T08:30:00Z",
        "source_ip": "192.168.1.50",
        "username": "testuser",
        "outcome": "failed",
        "asset_id": "lab-linux-01",
        "metadata": {
            "source": "synthetic",
            "message": "Simulated failed login",
        },
    }

    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert "id" in data and len(data["id"]) > 0
    assert data["event_type"] == "authentication"
    assert data["source_ip"] == "192.168.1.50"
    assert data["username"] == "testuser"
    assert data["outcome"] == "failure"  # Normalized from 'failed'
    assert data["asset_id"] == "lab-linux-01"
    assert data["metadata"]["source"] == "synthetic"
    assert data["metadata"]["message"] == "Simulated failed login"
    assert "created_at" in data


def test_stored_event_can_be_retrieved(client: TestClient):
    """
    2. The stored event can be retrieved.
    Verifies retrieval via list (GET /api/v1/events) and detail (GET /api/v1/events/{id}).
    """
    payload = {
        "event_type": "privilege_escalation",
        "timestamp": "2026-10-15T08:35:00Z",
        "source_ip": "10.0.0.15",
        "username": "root",
        "outcome": "success",
        "asset_id": "dc-server-01",
        "metadata": {"method": "sudo", "command": "/bin/su"},
    }

    post_resp = client.post("/api/v1/events", json=payload)
    assert post_resp.status_code == 201
    event_id = post_resp.json()["id"]

    # 1. Retrieve via list endpoint
    list_resp = client.get("/api/v1/events")
    assert list_resp.status_code == 200
    events = list_resp.json()
    assert len(events) >= 1
    found = next((e for e in events if e["id"] == event_id), None)
    assert found is not None
    assert found["event_type"] == "privilege_escalation"
    assert found["metadata"]["method"] == "sudo"

    # 2. Retrieve via detail endpoint
    detail_resp = client.get(f"/api/v1/events/{event_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["id"] == event_id
    assert detail["username"] == "root"
    assert detail["outcome"] == "success"


def test_missing_required_field_is_rejected(client: TestClient):
    """
    3. A missing required field is rejected with HTTP 422.
    """
    # Missing event_type
    resp_no_type = client.post(
        "/api/v1/events",
        json={"timestamp": "2026-10-15T08:30:00Z", "outcome": "success"},
    )
    assert resp_no_type.status_code == 422

    # Missing timestamp
    resp_no_ts = client.post(
        "/api/v1/events",
        json={"event_type": "auth_login", "outcome": "success"},
    )
    assert resp_no_ts.status_code == 422

    # Missing outcome
    resp_no_outcome = client.post(
        "/api/v1/events",
        json={"event_type": "auth_login", "timestamp": "2026-10-15T08:30:00Z"},
    )
    assert resp_no_outcome.status_code == 422


def test_invalid_ip_address_is_rejected(client: TestClient):
    """
    4. An invalid IP address is rejected with HTTP 422.
    """
    invalid_ips = ["999.999.999.999", "192.168.1.300", "not-an-ip", ""]
    for ip in invalid_ips:
        response = client.post(
            "/api/v1/events",
            json={
                "event_type": "network_connection",
                "timestamp": "2026-10-15T08:30:00Z",
                "source_ip": ip,
                "outcome": "failure",
            },
        )
        assert response.status_code == 422


def test_malformed_timestamp_is_rejected(client: TestClient):
    """
    5. A malformed timestamp is rejected with HTTP 422.
    """
    malformed_timestamps = ["not-a-timestamp", "2026-99-99T99:99:99", "tomorrow"]
    for ts in malformed_timestamps:
        response = client.post(
            "/api/v1/events",
            json={
                "event_type": "auth_login",
                "timestamp": ts,
                "outcome": "failure",
            },
        )
        assert response.status_code == 422


def test_optional_fields_can_be_omitted(client: TestClient):
    """
    6. Optional fields can be omitted when allowed by the schema.
    """
    minimal_event = {
        "event_type": "system_heartbeat",
        "timestamp": "2026-10-15T08:40:00Z",
        "outcome": "success",
    }
    response = client.post("/api/v1/events", json=minimal_event)
    assert response.status_code == 201
    data = response.json()
    assert data["source_ip"] is None
    assert data["username"] is None
    assert data["asset_id"] is None
    assert data["metadata"] == {}
    assert "id" in data
    assert "created_at" in data


def test_multiple_valid_events_stored_independently(client: TestClient):
    """
    7. Multiple valid events are stored independently.
    """
    events_to_create = [
        {
            "event_type": "login_attempt",
            "timestamp": "2026-10-15T08:41:00Z",
            "source_ip": "10.0.0.1",
            "outcome": "failure",
        },
        {
            "event_type": "login_attempt",
            "timestamp": "2026-10-15T08:42:00Z",
            "source_ip": "10.0.0.2",
            "outcome": "failure",
        },
        {
            "event_type": "file_access",
            "timestamp": "2026-10-15T08:43:00Z",
            "source_ip": "10.0.0.3",
            "outcome": "success",
        },
    ]

    created_ids = []
    for evt in events_to_create:
        res = client.post("/api/v1/events", json=evt)
        assert res.status_code == 201
        created_ids.append(res.json()["id"])

    # All IDs must be distinct
    assert len(set(created_ids)) == 3

    # Retrieve all
    list_res = client.get("/api/v1/events")
    assert list_res.status_code == 200
    returned_ids = [e["id"] for e in list_res.json()]
    for cid in created_ids:
        assert cid in returned_ids


def test_pagination_works_correctly(client: TestClient):
    """
    8. Pagination works correctly (limit, offset, ordering newest first).
    """
    # Insert 5 events chronologically
    for i in range(1, 6):
        client.post(
            "/api/v1/events",
            json={
                "event_type": "seq_test",
                "timestamp": f"2026-10-15T09:0{i}:00Z",
                "username": f"user_{i}",
                "outcome": "success",
            },
        )

    # Page 1 (limit 2, offset 0) -> should have user_5, user_4 (newest first)
    p1 = client.get("/api/v1/events?limit=2&offset=0")
    assert p1.status_code == 200
    p1_data = p1.json()
    assert len(p1_data) == 2
    assert p1_data[0]["username"] == "user_5"
    assert p1_data[1]["username"] == "user_4"
    assert p1.headers.get("X-Total-Count") == "5"

    # Page 2 (limit 2, offset 2) -> should have user_3, user_2
    p2 = client.get("/api/v1/events?limit=2&offset=2")
    assert p2.status_code == 200
    p2_data = p2.json()
    assert len(p2_data) == 2
    assert p2_data[0]["username"] == "user_3"
    assert p2_data[1]["username"] == "user_2"

    # Page 3 (limit 2, offset 4) -> should have user_1
    p3 = client.get("/api/v1/events?limit=2&offset=4")
    assert p3.status_code == 200
    p3_data = p3.json()
    assert len(p3_data) == 1
    assert p3_data[0]["username"] == "user_1"

    # Page beyond available (offset 10) -> returns empty list []
    p4 = client.get("/api/v1/events?limit=2&offset=10")
    assert p4.status_code == 200
    assert p4.json() == []

    # Bounds validation
    assert client.get("/api/v1/events?limit=0").status_code == 422
    assert client.get("/api/v1/events?limit=101").status_code == 422
    assert client.get("/api/v1/events?offset=-1").status_code == 422


def test_database_errors_do_not_produce_false_success(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    """
    9. Database errors do not produce false success responses and avoid leaking paths.
    """
    def raise_db_error(*args, **kwargs):
        raise sqlite3.OperationalError("database disk image is malformed")

    monkeypatch.setattr("backend.app.api.v1.events.insert_event", raise_db_error)

    payload = {
        "event_type": "auth_login",
        "timestamp": "2026-10-15T09:30:00Z",
        "outcome": "success",
    }
    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 500
    err_body = response.json()
    assert err_body["detail"] == "Failed to persist security event to database"
    assert "disk image is malformed" not in err_body["detail"]
    assert "sqlite" not in err_body["detail"].lower()
