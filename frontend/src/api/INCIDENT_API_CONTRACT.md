# EduSec Phase 6 — Proposed Incident API Contract

> **Target Audience:** Backend Developers (Java / Spring Boot or Python FastAPI)  
> **Status:** Proposed Specification for Backend Implementation  
> **Base Path:** `/api/v1/incidents`  
> **Content-Type:** `application/json`

---

## 1. Domain Models & Status Transitions

### 1.1 Incident Status Lifecycle
An incident progresses through 5 lifecycle stages:
```
           ┌──────────┐
           │   open   │
           └────┬─────┘
                │ (assign / triage)
                ▼
        ┌───────────────┐
        │ investigating │
        └───────┬───────┘
                │ (isolate / block)
                ▼
         ┌─────────────┐
         │  contained  │
         └──────┬──────┘
                │ (remediate / verify)
                ▼
         ┌─────────────┐
         │  resolved   │
         └──────┬──────┘
                │ (archive / root-cause review)
                ▼
          ┌────────────┐
          │   closed   │
          └────────────┘
```

* **`open`**: Newly created case awaiting investigation assignment.
* **`investigating`**: Security analyst actively evaluating telemetry, scope, and impact.
* **`contained`**: Immediate active threat neutralized (e.g. account disabled, egress IP blacklisted, credentials revoked).
* **`resolved`**: Root cause mitigated and system verified safe.
* **`closed`**: Post-incident review completed, report finalized.

### 1.2 Severity Levels
* `critical`: Confirmed compromise or widespread active credential exploitation.
* `high`: Sustained attack signatures (e.g., repeated brute-force waves).
* `medium`: Anomalous burst or repeated failure clusters without confirmed breach.
* `low`: Low-risk or suspected benign operational failures (e.g., misconfigured automation script).

---

## 2. API Endpoints

### 2.1 List Incidents (`GET /api/v1/incidents`)

Returns a paginated list of security incidents, sorted by creation timestamp descending (`newest first`).

#### Query Parameters:
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :---: | :---: | :--- |
| `status` | string | No | `all` | Filter by status (`open`, `investigating`, `contained`, `resolved`, `closed`). |
| `severity` | string | No | `all` | Filter by severity (`low`, `medium`, `high`, `critical`). |
| `search` | string | No | - | Substring search against incident ID, title, description, or assignee. |
| `limit` | integer | No | `50` | Maximum records per page (1 to 100). |
| `offset` | integer | No | `0` | Number of records to skip. |

#### Response Headers:
* `X-Total-Count`: Integer representing total matching records (e.g. `12`).

#### Success Response (`200 OK`):
```json
[
  {
    "id": "INC-2026-001",
    "title": "Repeated Brute-Force Authentication Attack from 192.168.1.105",
    "description": "High volume of failed login attempts (>5 in 300s window) targeting administrator accounts.",
    "severity": "high",
    "status": "investigating",
    "alert_ids": ["ffbe0488-3b38-4bec-865a-2cf6e2a25550"],
    "assignee": "Saurav (SOC Lead)",
    "created_at": "2026-10-15T04:22:00.000Z",
    "updated_at": "2026-10-15T05:10:00.000Z"
  }
]
```

---

### 2.2 Get Incident Details (`GET /api/v1/incidents/{id}`)

Fetches a single incident with all linked alerts, investigation notes, and activity timeline entries.

#### Success Response (`200 OK`):
```json
{
  "id": "INC-2026-001",
  "title": "Repeated Brute-Force Authentication Attack from 192.168.1.105",
  "description": "High volume of failed login attempts (>5 in 300s window) targeting administrator accounts.",
  "severity": "high",
  "status": "investigating",
  "alert_ids": ["ffbe0488-3b38-4bec-865a-2cf6e2a25550"],
  "assignee": "Saurav (SOC Lead)",
  "created_at": "2026-10-15T04:22:00.000Z",
  "updated_at": "2026-10-15T05:10:00.000Z",
  "notes": [
    {
      "id": "note-001",
      "incident_id": "INC-2026-001",
      "author": "Saurav (SOC Lead)",
      "content": "Initial triage started. Host 192.168.1.105 is an internal subnet endpoint.",
      "created_at": "2026-10-15T04:30:00.000Z"
    }
  ],
  "timeline": [
    {
      "id": "tl-001",
      "incident_id": "INC-2026-001",
      "timestamp": "2026-10-15T04:22:00.000Z",
      "action": "Incident Created",
      "actor": "Detection Automation",
      "details": "Escalated from alert ffbe0488..."
    },
    {
      "id": "tl-002",
      "incident_id": "INC-2026-001",
      "timestamp": "2026-10-15T04:30:00.000Z",
      "action": "Status Changed to Investigating",
      "actor": "Saurav (SOC Lead)",
      "details": "Assigned for scope evaluation."
    }
  ]
}
```

#### Error Response (`404 Not Found`):
```json
{
  "detail": "Incident INC-2026-999 not found"
}
```

---

### 2.3 Create Incident (`POST /api/v1/incidents`)

Creates a new incident case and optionally links one or more existing alert IDs.

#### Request Body:
```json
{
  "title": "Brute-force credential stuffing against portal admin",
  "description": "Multiple consecutive failed logins followed by anomaly on authentication service.",
  "severity": "high",
  "status": "open",
  "alert_ids": [
    "ffbe0488-3b38-4bec-865a-2cf6e2a25550"
  ],
  "assignee": "Security Analyst",
  "initial_note": "Observed during morning triage. Initiating endpoint check."
}
```

#### Validation Constraints:
* `title`: string, min 5 characters, max 200 characters. Required.
* `description`: string, min 10 characters, max 2000 characters. Required.
* `severity`: enum `low`, `medium`, `high`, `critical`. Required.
* `status`: enum `open`, `investigating`, `contained`, `resolved`, `closed`. Optional (default: `open`).
* `alert_ids`: array of UUID strings. Optional (default: `[]`).
* `assignee`: string or null. Optional.
* `initial_note`: string. Optional. If provided, backend automatically records an initial note in `notes` and appends a creation entry in `timeline`.

#### Success Response (`201 Created`):
Returns the complete created `Incident` object with auto-generated ID (e.g. `INC-2026-005` or UUID).

---

### 2.4 Update Incident Status (`PATCH /api/v1/incidents/{id}/status`)

Transitions the lifecycle state of an incident and automatically logs the transition to the incident activity timeline.

#### Request Body:
```json
{
  "status": "contained",
  "note": "Revoked victim_admin active tokens and placed temporary egress ACL.",
  "author": "Incident Responder"
}
```

#### Field Specifications:
* `status`: Target status (`open`, `investigating`, `contained`, `resolved`, `closed`). Required.
* `note`: Optional comment explaining the reason for transition. If provided, appended to `notes`.
* `author`: String identifying analyst executing the transition. Optional (default: `"Security Analyst"`).

#### Success Response (`200 OK`):
Returns the updated `Incident` object.

---

### 2.5 Add Investigation Note (`POST /api/v1/incidents/{id}/notes`)

Appends a new analyst investigation finding or forensic note.

#### Request Body:
```json
{
  "content": "Malware scan of workstation 192.168.1.105 returned negative. Suspected misconfigured stress test script.",
  "author": "Security Analyst 2"
}
```

#### Field Specifications:
* `content`: string, min 3 characters, max 4000 characters. Required.
* `author`: string. Required.

#### Success Response (`201 Created`):
```json
{
  "id": "note-173456789",
  "incident_id": "INC-2026-001",
  "author": "Security Analyst 2",
  "content": "Malware scan of workstation 192.168.1.105 returned negative. Suspected misconfigured stress test script.",
  "created_at": "2026-10-15T05:35:00.000Z"
}
```

---

## 3. Database Schema Recommendations

### 3.1 `incidents` Table
```sql
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,                       -- e.g. 'INC-2026-001'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL CHECK(status IN ('open', 'investigating', 'contained', 'resolved', 'closed')),
    assignee TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);
```

### 3.2 `incident_alerts` Join Table (Many-to-Many)
```sql
CREATE TABLE IF NOT EXISTS incident_alerts (
    incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    linked_at TEXT NOT NULL,
    PRIMARY KEY (incident_id, alert_id)
);
```

### 3.3 `incident_notes` Table
```sql
CREATE TABLE IF NOT EXISTS incident_notes (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incident_notes_incident_id ON incident_notes(incident_id);
```

### 3.4 `incident_timeline` Table
```sql
CREATE TABLE IF NOT EXISTS incident_timeline (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    details TEXT
);

CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident_id ON incident_timeline(incident_id);
```
