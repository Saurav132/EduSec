# EduSec — Linux Systemd Journal Log Collector (Phase 8)

The **EduSec Journal Collector** is a lightweight, loss-resistant daemon that reads local Linux authentication and security events from `systemd-journald`, normalizes them into the EduSec SIEM event contract, and delivers them to the Spring Boot backend (`http://127.0.0.1:8080/api/v1/events`).

---

## 1. Architecture & Design Principles

```
  +--------------------------------------------------------+
  |              Linux Kernel / Host System                 |
  |   (sshd, sudo, su, pam_unix, systemd authentication)   |
  +--------------------------------------------------------+
                             │
                             ▼
  +--------------------------------------------------------+
  |                   systemd-journald                     |
  +--------------------------------------------------------+
                             │  `journalctl -o json --after-cursor`
                             ▼
  +--------------------------------------------------------+
  |            EduSec Journal Collector Agent              |
  |                                                        |
  |  1. Chronological Journal Reader                       |
  |  2. Conservative Parser & Normalizer (parser.py)       |
  |     - OpenSSH Failure/Success -> "authentication"      |
  |     - Local Sudo / PAM        -> "linux_auth"          |
  |     - Invalid User Deduplication (No Double-Count)     |
  |  3. Resilient HTTP Sender (sender.py)                  |
  |     - Deterministic ID (UUIDv5 from boot_id + cursor)  |
  |     - Idempotent Retry & GET /events/{id} Verification |
  |  4. Atomic Checkpoint Manager (checkpoint.py)          |
  |     - Persists last confirmed cursor to user state     |
  +--------------------------------------------------------+
                             │  HTTP POST /api/v1/events
                             ▼
  +--------------------------------------------------------+
  |         EduSec Spring Boot Backend (Port 8080)         |
  |       SQLite Database (backend-java/data/edusec.db)    |
  +--------------------------------------------------------+
```

### Key Design Highlights
1. **Least-Privilege Execution (No Root / No Sudo)**:
   - On Kali Linux, users belonging to group `adm` (GID 4) or `systemd-journal` have native read access to system journal records.
   - The collector runs as a standard user process without needing `sudo`, root privileges, or suid binaries.
2. **Loss-Resistant Chronological Ordering**:
   - The collector polls journalctl in forward order using `--after-cursor="<cursor>"`.
   - The persistent cursor is **only advanced after** the backend confirms receipt (`HTTP 201 Created` or verified write).
   - If delivery fails due to a network drop or server outage, processing pauses and the checkpoint remains at the uncommitted state.
3. **Idempotency & Duplicate Prevention**:
   - Generates a deterministic UUIDv5 for every event: `uuid.uuid5(NAMESPACE_URL, f"edusec:{boot_id}:{cursor}")`.
   - If a network failure occurs *after* the server writes the row but *before* the HTTP response reaches the client, the sender queries `GET /api/v1/events/{id}`. If the event exists with matching payload attributes, it is confirmed delivered without inserting duplicate rows.
4. **False Detection Prevention**:
   - **OpenSSH Double-Counting Guard**: When an invalid user attempts SSH login, OpenSSH logs both `Invalid user <user>` and `Failed password for invalid user <user>`. The parser ignores the informational notice line and triggers solely on the authentication decision line.
   - **Local Activity Isolation**: Local `sudo` / PAM events are assigned `event_type: "linux_auth"` with `source_ip: None`. They do NOT trigger `NG-AUTH-001` or `NG-AUTH-002`, protecting against false brute-force alerts from normal developer activity.

---

## 2. Configuration (`config.json`)

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `api_base_url` | string | `http://127.0.0.1:8080/api/v1` | Base URL of the Spring Boot backend REST API |
| `state_file` | string | `~/.local/state/edusec/collector_cursor.json` | Path to persistent checkpoint file (outside Git repository) |
| `poll_interval_seconds` | float | `2.0` | Sleep duration when no new journal events are present |
| `batch_size` | integer | `100` | Maximum journal entries fetched per iteration |
| `max_retries` | integer | `3` | Maximum retry attempts for transient API / network failures |
| `retry_backoff_base` | float | `1.5` | Exponential backoff multiplier for retries |
| `max_message_chars` | integer | `256` | Maximum characters captured for raw message metadata |
| `initial_position` | string | `tail` | Starting position when no checkpoint exists (`tail` or `head`) |

---

## 3. Supported Event Normalization

### A. Remote OpenSSH Authentication
- **Syslog Identifiers**: `sshd`, `ssh`
- **Failure**:
  - `event_type`: `"authentication"`
  - `outcome`: `"failure"`
  - `username`: `<parsed_user>`
  - `source_ip`: `<parsed_ip>` (validated IPv4 or IPv6)
- **Success**:
  - `event_type`: `"authentication"`
  - `outcome`: `"success"`
  - `username`: `<parsed_user>`
  - `source_ip`: `<parsed_ip>` (validated IPv4 or IPv6)

### B. Local Sudo & PAM Activity
- **Syslog Identifiers**: `sudo`, `su`, `pam_unix`, `pam`, `login`
- **Failure** (Incorrect password, authentication failure, failed su):
  - `event_type`: `"linux_auth"`
  - `outcome`: `"failure"`
  - `username`: `<caller_user>`
  - `source_ip`: `None` *(null)*
- **Success** (Sudo command execution, session opened):
  - `event_type`: `"linux_auth"`
  - `outcome`: `"success"`
  - `username`: `<caller_user>`
  - `source_ip`: `None` *(null)*

---

## 4. Usage & Execution Commands

### Running Unit & Integration Tests
```bash
python3 -m unittest discover -s collector/tests -v
```

### Running the Collector in Dry-Run Mode
Test parsing on live journal entries without transmitting to the backend:
```bash
python3 -m collector.agent --dry-run --once
```

### Running the Collector Normally
```bash
python3 -m collector.agent --config collector/config.json
```

### Inspecting Checkpoint State
```bash
cat ~/.local/state/edusec/collector_cursor.json
```
