# EduSec REST API Reference

Base URL: `http://localhost:8080/api/v1`  
Content-Type: `application/json`

---

## 1. Health & Readiness

### `GET /api/v1/health`
Checks backend service readiness and SQLite database reachability.

- **Response (`200 OK`)**:
```json
{
  "status": "healthy",
  "app_name": "EduSec",
  "api_version": "0.1.0",
  "database": {
    "ready": true,
    "details": "Database initialized and reachable"
  }
}
```

---

## 2. Security Events

### `POST /api/v1/events`
Ingests a single raw security event. Validates and normalizes fields to UTC.

- **Request Body**:
```json
{
  "event_type": "authentication",
  "timestamp": "2026-10-16T10:00:00Z",
  "source_ip": "198.51.100.99",
  "username": "victim_admin",
  "outcome": "failure",
  "asset_id": "srv-auth-01",
  "metadata": {
    "protocol": "SSH-2.0"
  }
}
```
- **Validation Rules**:
  - `event_type`: Required string, 1 to 100 characters.
  - `timestamp`: Required ISO-8601 UTC parseable timestamp string.
  - `outcome`: Required enum (`success` or `failure`).
  - `source_ip`: Optional string; if provided, must be a valid IPv4 or IPv6 address.
  - `username`: Optional string, max 150 characters.
  - `asset_id`: Optional string, max 100 characters.
  - `id`: Optional client string, max 64 characters (auto-generated UUID if omitted).
- **Response (`201 Created`)**:
```json
{
  "id": "240b1797-e0fc-4e4f-b876-664da12d0bc7",
  "event_type": "authentication",
  "timestamp": "2026-10-16T10:00:00Z",
  "source_ip": "198.51.100.99",
  "username": "victim_admin",
  "outcome": "failure",
  "asset_id": "srv-auth-01",
  "metadata": { "protocol": "SSH-2.0" },
  "created_at": "2026-10-16T10:00:01.123456Z"
}
```

### `GET /api/v1/events`
Returns a paginated list of security events, sorted newest first.

- **Query Parameters**:
  - `limit`: Integer records per page (default: `50`, min: `1`, max: `100`).
  - `offset`: Integer skip offset (default: `0`, min: `0`).
- **Response Headers**:
  - `X-Total-Count`: Integer total matching events count.
- **Response (`200 OK`)**: Array of `SecurityEvent` objects.

### `GET /api/v1/events/{id}`
Retrieves a single security event by its identifier.

- **Response (`200 OK`)**: `SecurityEvent` object.
- **Response (`404 Not Found`)**: `{"detail": "Security event '{id}' not found"}`.

---

## 3. SIEM Detections

### `POST /api/v1/detections/run`
Executes active detection rules across stored events.

- **Query Parameters**:
  - `lookback_minutes`: Optional integer (min: `1`, max: `1440`). If omitted, all historical events are evaluated.
- **Response (`200 OK`)**:
```json
{
  "events_evaluated": 6,
  "alerts_created": 2,
  "alerts_existing": 0,
  "new_alerts": [
    {
      "id": "37f71b3c-6a02-46e8-b914-b0b2049854a6",
      "rule_id": "NG-AUTH-001",
      "title": "Brute-Force Alert: 5 failed logins from 198.51.100.99",
      "description": "Observed 5 failed authentication attempts from IP 198.51.100.99 within 300 seconds (threshold: 5).",
      "severity": "high",
      "related_event_ids": ["..."],
      "evidence": {
        "rule_id": "NG-AUTH-001",
        "source_ip": "198.51.100.99",
        "failed_attempts_count": 5,
        "threshold": 5,
        "window_seconds": 300
      },
      "fingerprint": "a9f8b...",
      "status": "open",
      "created_at": "2026-10-16T10:05:00Z"
    }
  ]
}
```

---

## 4. Alerts

### `GET /api/v1/alerts`
Returns a paginated list of alerts.

- **Query Parameters**:
  - `severity`: Optional string filter (`low`, `medium`, `high`, `critical`).
  - `status`: Optional string filter (`open`, `investigating`, `contained`, `resolved`, `closed`).
  - `rule_id`: Optional rule ID filter (e.g. `NG-AUTH-001`).
  - `limit`: Integer records per page (default: `50`, min: `1`, max: `100`).
  - `offset`: Integer skip offset (default: `0`, min: `0`).
- **Response Headers**:
  - `X-Total-Count`: Integer total matching alert count.
- **Response (`200 OK`)**: Array of `Alert` objects.

### `GET /api/v1/alerts/{id}`
Retrieves a single alert with full evidence payload and supporting event IDs.

---

## 5. Incidents & Case Management

### `GET /api/v1/incidents`
Returns a paginated list of security incidents with linked alert IDs, investigation notes, and timeline.

- **Query Parameters**:
  - `status`: Optional filter (`open`, `investigating`, `contained`, `resolved`, `closed`).
  - `severity`: Optional filter (`low`, `medium`, `high`, `critical`).
  - `search`: Substring search against ID, title, description, or assignee.
  - `limit`: Integer records per page (default: `50`, min: `1`, max: `100`).
  - `offset`: Integer skip offset (default: `0`, min: `0`).
- **Response Headers**:
  - `X-Total-Count`: Integer count.
- **Response (`200 OK`)**: Array of `Incident` objects.

### `GET /api/v1/incidents/{id}`
Retrieves complete details for a single incident case.

### `POST /api/v1/incidents`
Creates a new incident case and optionally links alerts.

- **Request Body**:
```json
{
  "title": "Brute-force investigation from 198.51.100.99",
  "description": "High volume of failed authentication attempts followed by suspicious login.",
  "severity": "critical",
  "status": "open",
  "alert_ids": ["f7c06bde-a48d-4053-a17d-8e4c8d8bf635"],
  "assignee": "Saurav (SOC Lead)",
  "initial_note": "Triage started. Escalated from detection alert."
}
```
- **Validation Rules**:
  - `title`: Required, 5 to 200 characters.
  - `description`: Required, 10 to 2000 characters.
  - `severity`: Required enum (`low`, `medium`, `high`, `critical`).
  - `status`: Optional enum (`open`, `investigating`, `contained`, `resolved`, `closed`), defaults to `open`.
  - `assignee`: Optional string, max 100 characters.
  - `initial_note`: Optional string, max 4000 characters.
  - `alert_ids`: Optional array of strings; each ID must exist in the database.
- **Response (`201 Created`)**: Complete `Incident` object.

### `PATCH /api/v1/incidents/{id}/status`
Transitions an incident's lifecycle stage and appends an audit entry to the activity timeline.

- **Request Body**:
```json
{
  "status": "contained",
  "note": "Perimeter IP blocked and user credentials rotated.",
  "author": "Saurav (SOC Lead)"
}
```
- **Response (`200 OK`)**: Updated `Incident` object.

### `POST /api/v1/incidents/{id}/notes`
Adds an investigation or forensic note to the incident thread.

- **Request Body**:
```json
{
  "content": "Malware scan of target workstation completed with zero findings.",
  "author": "Forensic Analyst"
}
```
- **Response (`201 Created`)**: `IncidentNote` object.

### `POST /api/v1/incidents/{id}/alerts`
Links additional existing alert IDs to an incident case.

- **Request Body**:
```json
{
  "alert_ids": ["37f71b3c-6a02-46e8-b914-b0b2049854a6"]
}
```
- **Response (`200 OK`)**: Updated `Incident` object.
