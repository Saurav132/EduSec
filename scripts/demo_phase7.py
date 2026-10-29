#!/usr/bin/env python3
"""
EduSec Phase 7 — College Presentation Live Demonstration Script
Zero-dependency Python 3 script demonstrating the end-to-end SIEM workflow:
1. Submit five failed authentication events from one test IP.
2. Submit a successful authentication event within the detection window.
3. Run detection and verify both rules (NG-AUTH-001 & NG-AUTH-002).
4. Run detection again and verify duplicate alerts are not created.
5. Provide instructions to inspect the alert in the React dashboard.
6. Escalate the alert to a managed security incident.
7. Add a forensic investigation note.
8. Transition incident lifecycle status (open -> investigating -> contained).
9. Verify persistence and inspect the audit timeline.
"""

import sys
import json
import time
from datetime import datetime, timezone, timedelta
import urllib.request
import urllib.error

API_BASE = "http://localhost:8080/api/v1"
DASHBOARD_URL = "http://localhost:5173"

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
    except urllib.error.URLError:
        print(f"\n{RED}{BOLD}Failed to connect to backend at {url}{RESET}")
        print(f"Please ensure the Java backend is running on port 8080: (cd backend-java && mvn spring-boot:run)\n")
        sys.exit(1)

def main():
    print(f"{BOLD}{YELLOW}╔════════════════════════════════════════════════════════════════╗{RESET}")
    print(f"{BOLD}{YELLOW}║      EduSec SIEM — Phase 7 College Presentation Demo          ║{RESET}")
    print(f"{BOLD}{YELLOW}║      Defensive Security-Monitoring Prototype                   ║{RESET}")
    print(f"{BOLD}{YELLOW}╚════════════════════════════════════════════════════════════════╝{RESET}")

    # Health Check
    log_step(0, "Backend Health & Storage Readiness Check")
    status, health = http_req("/health")
    if status != 200 or health.get("status") != "healthy":
        log_warn(f"Backend unhealthy or not ready: HTTP {status} - {health}")
        sys.exit(1)
    log_success(f"Backend is healthy ({health.get('app_name')} v{health.get('api_version')})")
    log_info(f"Database readiness: {health.get('database', {}).get('details')}")

    # Step 1: Submit 5 failed authentication events from one test IP
    log_step(1, "Submit Five Failed Authentication Events")
    # Use a unique demo run IP to isolate each live demonstration
    run_epoch = int(time.time())
    synthetic_ip = f"198.51.100.{(run_epoch % 200) + 10}"
    target_user = "demo_admin"
    now_utc = datetime.now(timezone.utc)
    base_time = now_utc - timedelta(seconds=150)

    event_ids = []
    for i in range(5):
        event_time = (base_time + timedelta(seconds=i * 20)).isoformat()
        payload = {
            "event_type": "authentication",
            "timestamp": event_time,
            "source_ip": synthetic_ip,
            "username": target_user,
            "outcome": "failure",
            "asset_id": "lab-auth-srv-01",
            "metadata": {
                "demo_tag": f"Phase7Demo-{run_epoch}",
                "attempt_number": i + 1,
                "protocol": "SSH-2.0"
            }
        }
        st, res = http_req("/events", method="POST", data=payload)
        assert st == 201, f"Failed to ingest event {i}: {res}"
        event_ids.append(res.get("id"))
        print(f"  → Ingested FAILURE event #{i+1} from {synthetic_ip} at {event_time} (ID: {res.get('id')})")
    log_success(f"5 failed authentication events successfully ingested from {synthetic_ip}")

    # Step 2: Submit a successful authentication event within detection window
    log_step(2, "Submit Successful Authentication Event Within Window")
    success_time = (base_time + timedelta(seconds=5 * 20 + 15)).isoformat()
    success_payload = {
        "event_type": "authentication",
        "timestamp": success_time,
        "source_ip": synthetic_ip,
        "username": target_user,
        "outcome": "success",
        "asset_id": "lab-auth-srv-01",
        "metadata": {
            "demo_tag": f"Phase7Demo-{run_epoch}",
            "attempt_number": 6,
            "protocol": "SSH-2.0"
        }
    }
    st, res = http_req("/events", method="POST", data=success_payload)
    assert st == 201, f"Failed to ingest success event: {res}"
    event_ids.append(res.get("id"))
    print(f"  → Ingested SUCCESS event from {synthetic_ip} at {success_time} (ID: {res.get('id')})")
    log_success(f"Success event ingested within detection window (<10 min after failures)")

    # Step 3: Run detection and verify both rules
    log_step(3, "Execute Detection Engine & Verify Both Rules")
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

    # Fallback to query if already generated
    if not (auth001_id and auth002_id):
        st, all_alerts = http_req("/alerts?limit=20")
        for a in all_alerts:
            evidence = a.get("evidence", {})
            if evidence.get("source_ip") == synthetic_ip:
                if a.get("rule_id") == "NG-AUTH-001" and not auth001_id:
                    auth001_id = a.get("id")
                elif a.get("rule_id") == "NG-AUTH-002" and not auth002_id:
                    auth002_id = a.get("id")

    assert auth001_id is not None, "Rule NG-AUTH-001 (Repeated Failed Logins) was not triggered!"
    assert auth002_id is not None, "Rule NG-AUTH-002 (Successful Login After Repeated Failures) was not triggered!"
    log_success("Both detection rules verified: NG-AUTH-001 (High) and NG-AUTH-002 (Critical)")

    # Step 4: Run detection again and verify deduplication
    log_step(4, "Run Detection Again to Verify Alert Deduplication")
    st, dedup_summary = http_req("/detections/run", method="POST")
    assert st == 200, f"Deduplication run failed: {dedup_summary}"
    print(f"  → New Alerts Created: {dedup_summary.get('alerts_created')} (Expected: 0)")
    print(f"  → Existing Suppressed: {dedup_summary.get('alerts_existing')} (Expected: >= 2)")
    assert dedup_summary.get("alerts_created") == 0, f"Expected 0 new alerts, got {dedup_summary.get('alerts_created')}"
    log_success("Deterministic SHA-256 evidence fingerprint deduplication confirmed! (Zero duplicates created)")

    # Step 5: Dashboard verification instructions
    log_step(5, "Inspect Alert in Dashboard")
    log_info(f"Navigate browser to: {DASHBOARD_URL}")
    log_info(f"Select 'Alerts' tab to view generated alert:")
    print(f"  Alert ID:   {auth002_id}")
    print(f"  Rule:       NG-AUTH-002 (Successful Login After Repeated Failures)")
    print(f"  Target:     {synthetic_ip} -> {target_user}")
    log_success("Alert verified and ready for triage")

    # Step 6: Escalate alert to an incident
    log_step(6, "Escalate Alert to a Security Incident")
    incident_payload = {
        "title": f"[DEMO] Credential Compromise from {synthetic_ip} ({target_user})",
        "description": f"Automated detection observed 5 failed authentication attempts followed by successful login to {target_user} from {synthetic_ip}.",
        "severity": "critical",
        "status": "open",
        "alert_ids": [auth002_id],
        "assignee": "Lead Analyst",
        "initial_note": "Incident escalated from SIEM alert NG-AUTH-002 during college final demonstration."
    }
    st, inc = http_req("/incidents", method="POST", data=incident_payload)
    assert st == 201, f"Failed to create incident: {inc}"
    inc_id = inc.get("id")
    log_success(f"Incident Created: {inc_id} - '{inc.get('title')}'")
    log_info(f"Status: {inc.get('status')} | Severity: {inc.get('severity')} | Assignee: {inc.get('assignee')}")

    # Link the NG-AUTH-001 alert as well
    st, inc = http_req(f"/incidents/{inc_id}/alerts", method="POST", data={"alert_ids": [auth001_id]})
    assert st == 200, f"Failed to link alert: {inc}"
    log_success(f"Linked secondary alert {auth001_id} (NG-AUTH-001) to incident {inc_id}")

    # Step 7: Add an investigation note
    log_step(7, "Add Forensic Investigation Note")
    note_payload = {
        "author": "Forensic Investigator",
        "content": f"Threat actor IP {synthetic_ip} identified as brute-force tool. Security perimeter rule deployed; user account flagged for credential reset."
    }
    st, note = http_req(f"/incidents/{inc_id}/notes", method="POST", data=note_payload)
    assert st == 201, f"Failed to add note: {note}"
    log_success(f"Forensic Note Added by '{note.get('author')}' (ID: {note.get('id')}):")
    print(f"  \"{note.get('content')}\"")

    # Step 8: Change incident status
    log_step(8, "Progress Incident Lifecycle Status")
    # Transition open -> investigating
    st, inc = http_req(f"/incidents/{inc_id}/status", method="PATCH", data={
        "status": "investigating",
        "note": "SOC triage complete. Commencing active forensic analysis and host telemetry review.",
        "author": "Lead Analyst"
    })
    assert st == 200, f"Status update failed: {inc}"
    log_success(f"Status changed: OPEN → {inc.get('status').upper()}")

    # Transition investigating -> contained
    st, inc = http_req(f"/incidents/{inc_id}/status", method="PATCH", data={
        "status": "contained",
        "note": "Compromised account disabled and network session terminated. Threat contained.",
        "author": "Lead Analyst"
    })
    assert st == 200, f"Status update failed: {inc}"
    log_success(f"Status changed: INVESTIGATING → {inc.get('status').upper()}")

    # Step 9: Refresh dashboard and verify persistence
    log_step(9, "Persistence Verification & Dashboard Audit")
    st, fresh_inc = http_req(f"/incidents/{inc_id}")
    assert st == 200, f"Failed to retrieve incident: {fresh_inc}"
    assert fresh_inc.get("status") == "contained", "Expected status 'contained'"
    assert len(fresh_inc.get("alert_ids", [])) == 2, "Expected 2 linked alerts"
    assert len(fresh_inc.get("notes", [])) >= 2, "Expected at least 2 notes (initial + added)"
    assert len(fresh_inc.get("timeline", [])) >= 4, "Expected at least 4 timeline events"

    print(f"\n{BOLD}=================== STORED INCIDENT RECORD ==================={RESET}")
    print(f" ID:             {fresh_inc.get('id')}")
    print(f" Title:          {fresh_inc.get('title')}")
    print(f" Severity:       {fresh_inc.get('severity').upper()}")
    print(f" Status:         {fresh_inc.get('status').upper()}")
    print(f" Assignee:       {fresh_inc.get('assignee')}")
    print(f" Linked Alerts:  {fresh_inc.get('alert_ids')}")

    print(f"\n{BOLD}Forensic Investigation Notes ({len(fresh_inc.get('notes', []))}):{RESET}")
    for n in fresh_inc.get("notes", []):
        print(f"  • [{n.get('created_at')[:19]}] {n.get('author')}: {n.get('content')}")

    print(f"\n{BOLD}Immutable Audit Timeline ({len(fresh_inc.get('timeline', []))}):{RESET}")
    for t in fresh_inc.get("timeline", []):
        print(f"  ▸ [{t.get('timestamp')[:19]}] {t.get('action')} (by {t.get('actor')}): {t.get('details')}")

    print(f"\n{BOLD}{GREEN}✔ Phase 7 Live Demonstration Completed Successfully!{RESET}")
    print(f"{CYAN}To view in browser:{RESET} Open {DASHBOARD_URL} and click 'Incidents' to inspect incident {inc_id}.\n")

    # Safe isolated cleanup instruction
    print(f"{YELLOW}Demo Cleanup Guidance:{RESET}")
    print(f"• In production/testing, incidents can be closed via:")
    print(f"  curl -X PATCH {API_BASE}/incidents/{inc_id}/status -H 'Content-Type: application/json' -d '{{\"status\":\"closed\",\"note\":\"Demo concluded.\"}}'")
    print(f"• Real project data in 'data/edusec.db' is strictly preserved and never dropped.\n")

if __name__ == "__main__":
    main()
