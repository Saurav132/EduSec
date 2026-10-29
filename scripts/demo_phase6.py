#!/usr/bin/env python3
"""
EduSec Phase 6 — College Presentation Live Demonstration Script
Zero-dependency Python 3 script verifying the end-to-end SIEM workflow:
1. Synthetic Event Ingestion
2. SIEM Detection Rules (NG-AUTH-001 & NG-AUTH-002)
3. Deterministic Alert Deduplication
4. Incident Case Escalation & Alert Linking
5. Forensic Note Addition & Timeline Generation
6. Status Lifecycle Transitions (Open -> Investigating -> Contained)
7. Persistence Verification & Record Inspection
"""

import sys
import json
import time
from datetime import datetime, timezone, timedelta
import urllib.request
import urllib.error

API_BASE = "http://localhost:8080/api/v1"

# ANSI Terminal Colors
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"

def log_step(step_num: int, title: str):
    print(f"\n{BOLD}{CYAN}=== STEP {step_num}: {title} ==={RESET}")

def log_success(msg: str):
    print(f" {GREEN}✔{RESET} {msg}")

def log_info(msg: str):
    print(f" {YELLOW}ℹ{RESET} {msg}")

def log_warn(msg: str):
    print(f" {RED}⚠{RESET} {msg}")

def http_req(endpoint: str, method: str = "GET", data: dict = None) -> tuple[int, dict]:
    url = f"{API_BASE}{endpoint}"
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    body = json.dumps(data).encode("utf-8") if data else None

    try:
        with urllib.request.urlopen(req, data=body, timeout=10) as resp:
            status = resp.status
            content = resp.read().decode("utf-8")
            parsed = json.loads(content) if content else {}
            return status, parsed
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = {"error": content}
        return e.code, parsed
    except urllib.error.URLError as e:
        print(f"\n{RED}{BOLD}Failed to connect to backend at {url}{RESET}")
        print(f"Please ensure the Java backend is running on port 8080: (cd backend-java && mvn spring-boot:run)\n")
        sys.exit(1)

def main():
    print(f"{BOLD}{YELLOW}╔════════════════════════════════════════════════════════════════╗{RESET}")
    print(f"{BOLD}{YELLOW}║      EduSec SIEM — Phase 6 End-to-End Live Demonstration       ║{RESET}")
    print(f"{BOLD}{YELLOW}║      Spring Boot Backend (8080) & SQLite Persistence           ║{RESET}")
    print(f"{BOLD}{YELLOW}╚════════════════════════════════════════════════════════════════╝{RESET}")

    # Health Check
    log_step(0, "Backend Health Verification")
    status, health = http_req("/health")
    if status != 200 or health.get("status") != "healthy":
        log_warn(f"Backend unhealthy or not ready: HTTP {status} - {health}")
        sys.exit(1)
    log_success(f"Backend is healthy ({health.get('app_name')} v{health.get('version')})")
    log_info(f"Database readiness: {health.get('database', {}).get('message')}")

    # Step 1: Submit Synthetic Events
    log_step(1, "Ingesting Synthetic Brute-Force Telemetry")
    synthetic_ip = "198.51.100.99"
    target_user = "demo_admin"
    now_utc = datetime.now(timezone.utc)
    base_time = now_utc - timedelta(seconds=120)

    event_ids = []
    # 5 failed authentications
    for i in range(5):
        event_time = (base_time + timedelta(seconds=i * 15)).isoformat()
        payload = {
            "event_type": "authentication",
            "timestamp": event_time,
            "source_ip": synthetic_ip,
            "username": target_user,
            "outcome": "failure",
            "asset_id": "lab-auth-srv-01",
            "metadata": {
                "demo_tag": "Phase6Demo",
                "attempt_number": i + 1,
                "protocol": "SSH-2.0"
            }
        }
        st, res = http_req("/events", method="POST", data=payload)
        assert st == 201, f"Failed to ingest event {i}: {res}"
        event_ids.append(res.get("id"))
        print(f"  → Ingested FAILURE event #{i+1} from {synthetic_ip} at {event_time} (ID: {res.get('id')})")

    # 1 success authentication 10 seconds later
    success_time = (base_time + timedelta(seconds=5 * 15 + 10)).isoformat()
    success_payload = {
        "event_type": "authentication",
        "timestamp": success_time,
        "source_ip": synthetic_ip,
        "username": target_user,
        "outcome": "success",
        "asset_id": "lab-auth-srv-01",
        "metadata": {
            "demo_tag": "Phase6Demo",
            "attempt_number": 6,
            "protocol": "SSH-2.0"
        }
    }
    st, res = http_req("/events", method="POST", data=success_payload)
    assert st == 201, f"Failed to ingest success event: {res}"
    event_ids.append(res.get("id"))
    print(f"  → Ingested SUCCESS event from {synthetic_ip} at {success_time} (ID: {res.get('id')})")
    log_success(f"Successfully ingested 6 synthetic events from {synthetic_ip}")

    # Step 2: Trigger Detection Engine
    log_step(2, "Triggering SIEM Detection Engine")
    st, summary = http_req("/detections/run", method="POST")
    assert st == 200, f"Detection run failed: {summary}"
    log_success(f"Evaluated {summary.get('events_evaluated')} events")
    log_info(f"New alerts created: {summary.get('alerts_created')} | Existing duplicates: {summary.get('alerts_existing')}")

    auth001_id = None
    auth002_id = None
    for alert in summary.get("new_alerts", []):
        rule_id = alert.get("rule_id")
        alert_id = alert.get("id")
        severity = alert.get("severity")
        title = alert.get("title")
        print(f"  ⚡ [{severity.upper()}] {rule_id}: {title} (ID: {alert_id})")
        if rule_id == "NG-AUTH-001":
            auth001_id = alert_id
        elif rule_id == "NG-AUTH-002":
            auth002_id = alert_id

    # Fallback to lookup if already created in earlier demo run
    if not auth002_id:
        st, all_alerts = http_req(f"/alerts?limit=10")
        for a in all_alerts:
            evidence = a.get("evidence", {})
            if evidence.get("source_ip") == synthetic_ip:
                if a.get("rule_id") == "NG-AUTH-001":
                    auth001_id = a.get("id")
                elif a.get("rule_id") == "NG-AUTH-002":
                    auth002_id = a.get("id")

    # Step 3: Alert Deduplication Verification
    log_step(3, "Demonstrating Alert Deduplication (Fingerprint Idempotency)")
    st, dedup_summary = http_req("/detections/run", method="POST")
    assert st == 200, f"Deduplication run failed: {dedup_summary}"
    log_success(f"Detection executed again over identical events:")
    print(f"  → New Alerts Created: {dedup_summary.get('alerts_created')} (Expected: 0)")
    print(f"  → Existing Suppressed: {dedup_summary.get('alerts_existing')} (Expected: >= 2)")
    if dedup_summary.get("alerts_created") == 0:
        log_success("Deterministic SHA-256 evidence fingerprint deduplication confirmed!")
    else:
        log_warn("Deduplication anomaly detected!")

    # Step 4: Create Security Incident
    log_step(4, "Incident Escalation & Alert Linking")
    incident_payload = {
        "title": f"[DEMO-PHASE6] Credential Stuffing & Compromise from {synthetic_ip}",
        "description": "Detection engine observed 5 consecutive failed logins followed immediately by successful authentication to demo_admin.",
        "severity": "critical",
        "status": "open",
        "alert_ids": [auth002_id] if auth002_id else [],
        "assignee": "Saurav (SOC Lead)",
        "initial_note": "Incident created during college presentation live demonstration."
    }
    st, inc = http_req("/incidents", method="POST", data=incident_payload)
    assert st == 201, f"Failed to create incident: {inc}"
    inc_id = inc.get("id")
    log_success(f"Incident Created: {inc_id} - '{inc.get('title')}'")
    log_info(f"Status: {inc.get('status')} | Severity: {inc.get('severity')} | Assignee: {inc.get('assignee')}")
    log_info(f"Linked Alert Count: {len(inc.get('alert_ids', []))}")

    # Link the NG-AUTH-001 alert as well if available
    if auth001_id:
        st, inc = http_req(f"/incidents/{inc_id}/alerts", method="POST", data={"alert_ids": [auth001_id]})
        log_success(f"Linked secondary alert {auth001_id} (NG-AUTH-001) to {inc_id}")

    # Step 5: Add Investigation Note
    log_step(5, "Forensic Investigation Note Addition")
    note_payload = {
        "author": "Forensic Analyst",
        "content": f"Host {synthetic_ip} verified as simulated external adversary. Temporary iptables drop rule applied to test host."
    }
    st, note = http_req(f"/incidents/{inc_id}/notes", method="POST", data=note_payload)
    assert st == 201, f"Failed to add note: {note}"
    log_success(f"Forensic Note Added by '{note.get('author')}' (ID: {note.get('id')}):")
    print(f"  \"{note.get('content')}\"")

    # Step 6: Status Lifecycle Transitions
    log_step(6, "Incident Lifecycle Status Progression")
    # 6a. Transition to investigating
    st, inc = http_req(f"/incidents/{inc_id}/status", method="PATCH", data={
        "status": "investigating",
        "note": "Commencing user session token revocation and host telemetry dump.",
        "author": "Saurav (SOC Lead)"
    })
    log_success(f"Status transitioned: OPEN → {inc.get('status').upper()}")

    # 6b. Transition to contained
    st, inc = http_req(f"/incidents/{inc_id}/status", method="PATCH", data={
        "status": "contained",
        "note": "Host egress restricted, password reset enforced, incident isolated.",
        "author": "Saurav (SOC Lead)"
    })
    log_success(f"Status transitioned: INVESTIGATING → {inc.get('status').upper()}")

    # Step 7: Persistence Verification & Summary Display
    log_step(7, "Persistence Verification & Forensic Summary")
    st, fresh_inc = http_req(f"/incidents/{inc_id}")
    assert st == 200, f"Failed to retrieve incident: {fresh_inc}"

    print(f"\n{BOLD}=================== STORED INCIDENT RECORD ==================={RESET}")
    print(f" ID:             {fresh_inc.get('id')}")
    print(f" Title:          {fresh_inc.get('title')}")
    print(f" Severity:       {fresh_inc.get('severity').upper()}")
    print(f" Status:         {fresh_inc.get('status').upper()}")
    print(f" Assignee:       {fresh_inc.get('assignee')}")
    print(f" Created (UTC):  {fresh_inc.get('created_at')}")
    print(f" Updated (UTC):  {fresh_inc.get('updated_at')}")
    print(f" Linked Alerts:  {fresh_inc.get('alert_ids')}")

    print(f"\n{BOLD}Investigation Notes ({len(fresh_inc.get('notes', []))}):{RESET}")
    for n in fresh_inc.get("notes", []):
        print(f"  • [{n.get('created_at')[:19]}] {n.get('author')}: {n.get('content')}")

    print(f"\n{BOLD}Incident Activity Timeline ({len(fresh_inc.get('timeline', []))}):{RESET}")
    for t in fresh_inc.get("timeline", []):
        print(f"  ▸ [{t.get('timestamp')[:19]}] {t.get('action')} (by {t.get('actor')}): {t.get('details')}")

    print(f"\n{BOLD}{GREEN}✔ Phase 6 SIEM End-to-End Validation & Live Demo Completed Successfully!{RESET}\n")

if __name__ == "__main__":
    main()
