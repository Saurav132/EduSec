# EduSec Presentation Demo Walkthrough

This guide provides a repeatable, 9-step demonstration scenario designed for a college project evaluation or technical presentation.

---

## 1. Quick Automated Demonstration
 
 You can run the entire automated demo sequence with a single command:
 ```bash
 /home/saurav/Desktop/EduSec/scripts/demo_phase7.sh
 ```
 Or run the Python 3 script directly:
 ```bash
 python3 /home/saurav/Desktop/EduSec/scripts/demo_phase7.py
 ```
 *(Note: `scripts/demo_phase6.sh` is also retained for backward compatibility).*

---

## 2. Interactive Presentation Walkthrough (9 Steps)

### Step 1: Ingest 5 Failed Login Events
*Scenario: Attacker initiates a brute-force credential stuffing attack from `198.51.100.99`.*
```bash
BASE_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

for i in {1..5}; do
  curl -s -X POST http://localhost:8080/api/v1/events \
    -H "Content-Type: application/json" \
    -d '{
      "event_type": "authentication",
      "timestamp": "'"$BASE_TIME"'",
      "source_ip": "198.51.100.99",
      "username": "demo_admin",
      "outcome": "failure",
      "asset_id": "lab-auth-srv-01"
    }' | jq .
  sleep 1
done
```
**Talking Point**: The backend normalizes timestamps to UTC, validates the IP address format, and stores each event with a server-authoritative ingestion timestamp.

---

### Step 2: Ingest 1 Successful Authentication Event
*Scenario: Attacker successfully guesses the password or exploits weak credentials 15 seconds later.*
```bash
SUCCESS_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

curl -s -X POST http://localhost:8080/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "authentication",
    "timestamp": "'"$SUCCESS_TIME"'",
    "source_ip": "198.51.100.99",
    "username": "demo_admin",
    "outcome": "success",
    "asset_id": "lab-auth-srv-01"
  }' | jq .
```
**Talking Point**: We now have telemetry exhibiting two attack signatures: repeated failures and a compromise login.

---

### Step 3: Trigger SIEM Detection Engine
*Scenario: SOC analysts trigger correlation across telemetry.*
```bash
curl -s -X POST http://localhost:8080/api/v1/detections/run | jq .
```
**Expected Output**:
- `NG-AUTH-001` (Repeated Failed Logins): High Severity alert created with 5 supporting event IDs.
- `NG-AUTH-002` (Login After Failures): High Severity alert created correlating the preceding 5 failures with the successful login.

---

### Step 4: Verify Alert Deduplication
*Scenario: Re-triggering the detection engine over the same time window.*
```bash
curl -s -X POST http://localhost:8080/api/v1/detections/run | jq .
```
**Expected Output**:
- `alerts_created: 0`
- `alerts_existing: 2`
**Talking Point**: Alerts are deduplicated using a deterministic SHA-256 evidence fingerprint (`FingerprintUtil`). Duplicate alerts are suppressed, preventing alert fatigue.

---

### Step 5: Open the Alert in the Dashboard
1. Navigate to **`http://localhost:5173/`** in your browser.
2. Click **Alerts** in the sidebar.
3. Locate the alert for rule **NG-AUTH-002** (*Potential Compromise: Successful login after 5 failures*).
4. Click on the row to open the **Alert Detail Drawer**.
5. Inspect the evidence payload:
   - Attacking IP: `198.51.100.99`
   - Targeted user: `demo_admin`
   - Window: 300 seconds

---

### Step 6: Escalate the Alert to an Incident
1. Click **Escalate to Incident** in the Alert Detail Drawer (or click **Create Incident** on the Incidents tab).
2. Fill out the form:
   - **Title**: `[DEMO] Compromise Investigation from 198.51.100.99`
   - **Description**: `Correlated brute-force attempts followed by suspicious login to demo_admin.`
   - **Severity**: `Critical`
   - **Assignee**: `Saurav (SOC Lead)`
   - **Initial Note**: `Initial triage started during live presentation.`
3. Click **Create Incident**.

---

### Step 7: Add an Investigation Note
1. In the Incident Detail Drawer, navigate to the **Investigation Notes** tab.
2. Enter:
   - **Author**: `Forensic Analyst`
   - **Note**: `Perimeter firewall log corroborates 5 dropped SYNs followed by successful TCP handshake. Applied temporary firewall drop rule.`
3. Click **Add Note**.
**Talking Point**: Notes are appended chronologically and recorded in the incident activity timeline.

---

### Step 8: Change the Incident Status
1. Click the status badge dropdown at the top of the Incident Detail Drawer.
2. Select **Investigating**, add note `Commencing host isolation`, and click **Confirm**.
3. Select **Contained**, add note `Credentials rotated and host drop rule verified`, and click **Confirm**.
**Talking Point**: Status transitions are validated against lifecycle stages (`open` -> `investigating` -> `contained` -> `resolved` -> `closed`), and each transition is logged to the activity timeline.

---

### Step 9: Verify Data Persistence Across Restarts
1. Refresh the browser page (`F5`).
2. Verify that the incident status is **CONTAINED**, notes count is 3, and all timeline entries remain visible.
3. Restart the backend if desired (`kill` and `mvn spring-boot:run`); query `/api/v1/incidents` to verify all records remain intact in SQLite.

---

## 3. Demo Data Cleanup Instructions

To maintain project integrity, the demo script flags synthetic records with `[DEMO-PHASE6]` and IP `198.51.100.99`.

If you wish to remove only the synthetic demo events after your presentation:
```bash
sqlite3 backend-java/data/edusec.db "
  DELETE FROM incident_timeline WHERE incident_id IN (SELECT id FROM incidents WHERE title LIKE '%[DEMO%');
  DELETE FROM incident_notes WHERE incident_id IN (SELECT id FROM incidents WHERE title LIKE '%[DEMO%');
  DELETE FROM incident_alerts WHERE incident_id IN (SELECT id FROM incidents WHERE title LIKE '%[DEMO%');
  DELETE FROM incidents WHERE title LIKE '%[DEMO%';
  DELETE FROM alerts WHERE evidence LIKE '%198.51.100.99%';
  DELETE FROM security_events WHERE source_ip = '198.51.100.99';
"
```
*(Do not delete the SQLite database file itself)*.
