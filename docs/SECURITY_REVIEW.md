# EduSec Defensive Security Hardening & Review

---

## 1. Prototype Scope and Boundary Declaration

> **Academic Prototype Notice**:  
> EduSec is a defensive security monitoring and SIEM case management prototype developed for educational lab demonstrations. It is not an enterprise-certified SIEM.

### Declared Limitations:
1. **Unauthenticated REST Endpoints**: Endpoints (`/api/v1/events`, `/api/v1/detections/run`, `/api/v1/incidents`, etc.) do not require authentication or bearer tokens. Anyone with network access to port 8080 can submit events and update incidents.
2. **Cleartext Transport**: Traffic on port 8080 runs over HTTP/1.1 without TLS/HTTPS encryption.
3. **Embedded Single-Writer Persistence**: SQLite handles concurrent reads, but write operations are serialized through HikariCP with a pool size of 1.

---

## 2. Defensive Hardening Implementations

### 2.1 SQL Injection Resistance
- **Audit**: All data queries in `SecurityEventRepository`, `AlertRepository`, and `IncidentRepository` use Spring `JdbcTemplate` with positional parameter binding (`?`).
- **Verification**: Evaluated with injection strings:
  - Search filter: `?search=' OR '1'='1' --` → Safely bound; returns 0 records.
  - Path variable: `/incidents/INC-001' UNION SELECT 'hacked'--` → Safely parameterized; returns HTTP 404.

### 2.2 Input Validation & Boundary Enforcement
- **Event Ingestion**:
  - `event_type`: Required string, 1 to 100 characters.
  - `timestamp`: Strictly validated against ISO-8601 UTC formats.
  - `outcome`: Restricted to enum values (`success`, `failure`).
  - `source_ip`: Validated with standard IPv4/IPv6 regex.
  - `id`: Client-supplied ID constrained to 64 characters max.
  - `username`: Constrained to 150 characters max.
- **Incidents & Notes**:
  - `title`: 5 to 200 characters.
  - `description`: 10 to 2000 characters.
  - `assignee`: 1 to 100 characters max.
  - `initial_note` & `note content`: 3 to 4000 characters.
  - `author`: 1 to 100 characters max.
  - `status`: Restricted to lifecycle enum values (`open`, `investigating`, `contained`, `resolved`, `closed`).
- **Server Payload Limits**:
  - `spring.servlet.multipart.max-file-size=5MB`
  - `spring.servlet.multipart.max-request-size=5MB`
  - `server.tomcat.max-http-form-post-size=5MB`

### 2.3 Information Disclosure Prevention
- `server.error.include-stacktrace=never`: Spring Boot default error controller never outputs stack traces.
- `server.error.include-message=never`: Default error messages are suppressed.
- `GlobalExceptionHandler`:
  - `HttpMessageNotReadableException` returns a generic `"Malformed or unparseable JSON payload"`, concealing internal Jackson parser classes (`StreamReadConstraints`).
  - `StorageException` returns `"A database error occurred while processing the request"`, concealing SQLite table structures and constraint names.
  - `NoResourceFoundException` mapped to HTTP 404 with sanitized `"Resource not found"` message instead of exposing unmapped internal dispatch errors.
  - `HttpRequestMethodNotSupportedException` mapped to HTTP 405 with sanitized `"Method '<method>' not allowed for this endpoint"` message.

### 2.4 Referential Integrity & Transactions
- SQLite connection initialization pragma:
  ```properties
  spring.datasource.hikari.connection-init-sql=PRAGMA foreign_keys = ON;
  ```
  Enforces `ON DELETE CASCADE` across `incident_alerts`, `incident_notes`, and `incident_timeline`.
- Service-level `@Transactional` annotations on `createIncident`, `updateStatus`, `addNote`, `linkAlerts`, `ingestEvent`, and `runDetectionCycle` guarantee atomic multi-table writes.

### 2.5 Cross-Origin Resource Sharing (CORS)
- Explicit allowed origins:
  - `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:3000`, `http://127.0.0.1:3000`
- Configurable via `EDUSEC_CORS_ALLOWED_ORIGINS` environment variable.
- Exposed headers: `X-Total-Count`.
- Credentials allowed: `false` (no cookie/credential leakage).
