# EduSec Architecture Overview

EduSec is an educational Security Information and Event Management (SIEM) and Incident Response prototype designed for local laboratory demonstration, telemetry correlation, and defensive security training.

---

## 1. High-Level System Architecture

```
                    ┌────────────────────────────────────────┐
                    │      React 19 + Vite Frontend          │
                    │        (Port 5173 / Localhost)         │
                    └───────────────────┬────────────────────┘
                                        │ REST / JSON (HTTP)
                                        │ X-Total-Count Headers
                                        ▼
                    ┌────────────────────────────────────────┐
                    │    Primary Backend: Java Spring Boot   │
                    │        (Port 8080 / Localhost)         │
                    ├────────────────────────────────────────┤
                    │ • Event Ingestion & Normalization      │
                    │ • SIEM Rule Detectors (NG-AUTH-001/002)│
                    │ • Evidence Fingerprinting (Deduplication│
                    │ • Case Management & Incident Lifecycle │
                    │ • Transactional SQLite Repositories    │
                    └───────────────────┬────────────────────┘
                                        │ JDBC (HikariCP, Pool=1)
                                        │ PRAGMA foreign_keys = ON;
                                        ▼
                    ┌────────────────────────────────────────┐
                    │           SQLite 3 Database            │
                    │         `data/edusec.db` (File)        │
                    │  (Isolated Test: `target/test-data/`)  │
                    └────────────────────────────────────────┘

    [Preserved Component: `backend/` Python FastAPI Reference Implementation]
```

---

## 2. Component Responsibilities

### 2.1 Backend (`backend-java/`) — Primary Service (Port 8080)
- **Framework**: Spring Boot 4.1.1 on Java 17+ (running OpenJDK 21).
- **Controllers**:
  - `HealthController`: System readiness and SQLite table reachability diagnostics (`GET /api/v1/health`).
  - `EventController`: Ingests, validates, and paginates raw security telemetry (`/api/v1/events`).
  - `DetectionController`: Triggers on-demand SIEM correlation passes (`POST /api/v1/detections/run`).
  - `AlertController`: Queries, retrieves, and filters correlated alerts (`/api/v1/alerts`).
  - `IncidentController`: Manages incident cases, lifecycle transitions, analyst notes, and alert associations (`/api/v1/incidents`).
  - `GlobalExceptionHandler`: Maps internal exceptions to standardized RFC-compliant error payloads with sanitized details.
- **Service Layer**:
  - `SecurityEventService`: Normalizes timestamps to UTC, validates IPv4/IPv6 addresses, validates payload constraints, and coordinates atomic event storage.
  - `DetectionService`: Synchronously runs registered detection rules with reentrant execution locking and transactional alert persistence.
  - `IncidentService`: Manages case numbering (`INC-YYYY-###`), status transitions, notes, and activity timeline logging.
- **Detection Engine & Rules**:
  - `DetectionEngine`: Coordinates execution across active detection rule beans.
  - `RepeatedFailedLoginsRule` (`NG-AUTH-001`): Detects >= 5 failed logins within a 300-second window for a source IP.
  - `LoginAfterFailuresRule` (`NG-AUTH-002`): Detects successful login preceded by >= 5 failures within 300 seconds from the same source IP.
  - `FingerprintUtil`: Generates deterministic SHA-256 fingerprints across rule IDs and sorted supporting event IDs to prevent duplicate alerts.
- **Storage Layer**:
  - `DatabaseInitializer`: Automatically provisions database directories, tables, indexes, and migrations.
  - `SecurityEventRepository`, `AlertRepository`, `IncidentRepository`: Data access objects with 100% parameterized SQL queries via Spring `JdbcTemplate`.

### 2.2 Frontend (`frontend/`) — Operator Dashboard (Port 5173)
- **Framework**: React 19, TypeScript 6, Vite 8, TailwindCSS.
- **Views**:
  - **Overview**: Live status indicator, KPI metric cards, recent alerts table, ingestion activity chart, severity breakdown.
  - **Events Tab**: Paginated telemetry inspection table, outcome badges, search, and JSON detail modal.
  - **Alerts Tab**: Correlated alert table, rule filtering, severity badges, and drawer showing evidence context and escalation triggers.
  - **Incidents Tab**: Case management grid, lifecycle status badges (`open`, `investigating`, `contained`, `resolved`, `closed`), creation modal with alert pickers, analyst note thread, and audit activity timeline.
- **API Clients**:
  - `apiClient.ts` & `incidentsApi.ts`: Centralized, typed HTTP clients communicating with `http://127.0.0.1:8080` (configurable via `VITE_API_BASE_URL`).

### 2.3 Preserved Component (`backend/`) — Python FastAPI Reference
- The original Python implementation located in `/home/saurav/Desktop/EduSec/backend/` is preserved in its entirety as a reference implementation.

---

## 3. Communication & Port Mapping

| Service | Port | Protocol | Binding | Configuration Override |
| :--- | :---: | :---: | :---: | :--- |
| Spring Boot Backend | `8080` | HTTP/1.1 | `0.0.0.0` or `127.0.0.1` | Environment variable `PORT` |
| React/Vite Frontend | `5173` | HTTP/1.1 | `127.0.0.1` | `vite --port <PORT>` |
| SQLite Database | N/A | Local File | `data/edusec.db` | Environment variable `EDUSEC_DB_URL` |
