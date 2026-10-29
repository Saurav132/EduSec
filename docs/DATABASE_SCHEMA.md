# EduSec SQLite Database Schema

Storage engine: SQLite 3  
Production Database file: `backend-java/data/edusec.db`  
Isolated Test Database: `backend-java/target/test-data/edusec-test.db`

---

## 1. Relational Schema Diagram

```
  ┌─────────────────────────┐           ┌─────────────────────────┐
  │     security_events     │           │         alerts          │
  ├─────────────────────────┤           ├─────────────────────────┤
  │ id (TEXT, PK)           │           │ id (TEXT, PK)           │
  │ event_type (TEXT)       │           │ rule_id (TEXT)          │
  │ timestamp (TEXT, ISO)   │           │ title (TEXT)            │
  │ source_ip (TEXT)        │           │ description (TEXT)      │
  │ username (TEXT)         │           │ severity (TEXT)         │
  │ outcome (TEXT)          │           │ related_event_ids (TEXT)│
  │ asset_id (TEXT)         │           │ evidence (TEXT, JSON)   │
  │ details (TEXT, JSON)    │           │ fingerprint (TEXT, UQ)  │
  │ created_at (TEXT, ISO)  │           │ status (TEXT)           │
  └─────────────────────────┘           │ created_at (TEXT, ISO)  │
                                        └───────────┬─────────────┘
                                                    │ 1
                                                    │
                                                    │ *
                                        ┌───────────┴─────────────┐
                                        │     incident_alerts     │
                                        ├─────────────────────────┤
                                        │ incident_id (TEXT, FK)  │
                                        │ alert_id (TEXT, FK)     │
                                        │ linked_at (TEXT, ISO)   │
                                        │ PRIMARY KEY (inc, alert)│
                                        └───────────┬─────────────┘
                                                    │ *
                                                    │
                                                    │ 1
  ┌─────────────────────────┐           ┌───────────┴─────────────┐
  │     incident_notes      │           │        incidents        │
  ├─────────────────────────┤           ├─────────────────────────┤
  │ id (TEXT, PK)           │     *     │ id (TEXT, PK)           │
  │ incident_id (TEXT, FK)  ├───────────┤ title (TEXT)            │
  │ author (TEXT)           │           │ description (TEXT)      │
  │ content (TEXT)          │           │ severity (TEXT)         │
  │ created_at (TEXT, ISO)  │           │ status (TEXT)           │
  └─────────────────────────┘           │ assignee (TEXT)         │
                                        │ created_at (TEXT, ISO)  │
  ┌─────────────────────────┐           │ updated_at (TEXT, ISO)  │
  │    incident_timeline    │           └─────────────────────────┘
  ├─────────────────────────┤                        │ 1
  │ id (TEXT, PK)           │                        │
  │ incident_id (TEXT, FK)  ├────────────────────────┘ *
  │ timestamp (TEXT, ISO)   │
  │ action (TEXT)           │
  │ actor (TEXT)            │
  │ details (TEXT)          │
  └─────────────────────────┘
```

---

## 2. Table Specifications

### 2.1 `security_events`
Stores raw normalized security events.
```sql
CREATE TABLE IF NOT EXISTS security_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    source_ip TEXT,
    username TEXT,
    outcome TEXT NOT NULL,
    asset_id TEXT,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_source_ip ON security_events(source_ip);
```

### 2.2 `alerts`
Stores detection rule match alerts. Deduplication is enforced via a unique index on `fingerprint`.
```sql
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL,
    related_event_ids TEXT NOT NULL,
    evidence TEXT NOT NULL DEFAULT '{}',
    fingerprint TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_rule_id ON alerts(rule_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_fingerprint ON alerts(fingerprint);
```

### 2.3 `incidents`
Stores case management cases.
```sql
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
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

### 2.4 `incident_alerts` (Join Table)
Many-to-many relationship linking security alerts to incidents with foreign keys and cascading deletes.
```sql
CREATE TABLE IF NOT EXISTS incident_alerts (
    incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    linked_at TEXT NOT NULL,
    PRIMARY KEY (incident_id, alert_id)
);

CREATE INDEX IF NOT EXISTS idx_incident_alerts_incident_id ON incident_alerts(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_alerts_alert_id ON incident_alerts(alert_id);
```

### 2.5 `incident_notes`
Investigation and forensic notes appended to an incident.
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

### 2.6 `incident_timeline`
Audit timeline recording all lifecycle updates and forensic transitions.
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

---

## 3. SQLite Connection Hardening

SQLite does not enable foreign key enforcement by default. In EduSec, HikariCP pool connections are initialized with:
```properties
spring.datasource.hikari.connection-init-sql=PRAGMA foreign_keys = ON;
```
This guarantees referential integrity and cascading deletes across all operations.
