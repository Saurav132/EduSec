# EduSec — Security Monitoring System
> **Academic SIEM-Oriented Defensive Security Monitoring Prototype**  
> Developed for Security Event Detection, Analysis, and Incident Response.

EduSec is a lightweight, defensive security-monitoring and SIEM case-management application. It ingests distributed telemetry into a Common Event Schema, executes explainable rule-based correlation, generates forensic alerts with SHA-256 evidence fingerprint deduplication, and manages end-to-end incident lifecycles with an immutable audit timeline.

---

## 1. System Architecture

```text
┌────────────────────────────────────────────────────────┐
│                   React SOC Dashboard                  │
│       Vite + TypeScript + TailwindCSS (Port 5173)      │
└───────────────────────────┬────────────────────────────┘
                            │ REST API (JSON / HTTP)
                            ▼
┌────────────────────────────────────────────────────────┐
│             Primary Java Spring Boot Backend           │
│        Spring Boot 4.1.1 + OpenJDK 21 (Port 8080)       │
├───────────────────────────┬────────────────────────────┤
│ • Event Ingestion & Normal │ • Sliding Window Rules     │
│ • SHA-256 Deduplication   │ • Incident Case Management │
│ • Input Bounds & CORS     │ • Foreign Key Integrity    │
└───────────────────────────┬────────────────────────────┘
                            │ JDBC (PRAGMA foreign_keys = ON;)
                            ▼
┌────────────────────────────────────────────────────────┐
│                 SQLite Local Database                  │
│               backend-java/data/edusec.db              │
└────────────────────────────────────────────────────────┘

Reference Architecture:
• backend/ (FastAPI Reference Implementation on Port 8000, preserved).
```

---

## 2. Quickstart Guide

### 2.1 System Prerequisites
- **Java**: OpenJDK 17 or 21 (`java -version`)
- **Maven**: 3.8+ (`mvn -version`)
- **Node.js**: 18+ (`node -v`)
- **npm**: 9+ (`npm -v`)
- **No Docker or virtual machines required.**

### 2.2 Launching the Application

1. **Start the Java Backend** (Terminal 1):
   ```bash
   cd /home/saurav/Desktop/EduSec/backend-java
   mvn spring-boot:run
   ```
   *Verified ready when `curl http://localhost:8080/api/v1/health` returns `status: "healthy"`.*

2. **Start the React Frontend** (Terminal 2):
   ```bash
   cd /home/saurav/Desktop/EduSec/frontend
   npm install   # If not already installed
   npm run dev
   ```
   *Open `http://localhost:5173` in your browser.*

---

## 3. Live Presentation Demonstration (9 Steps)

EduSec includes an automated runner that executes the complete 9-step college presentation sequence:

```bash
/home/saurav/Desktop/EduSec/scripts/demo_phase7.sh
```

### Demonstration Sequence:
1. **Submit Failed Telemetry**: Ingests 5 consecutive failed authentications from a test IP (`198.51.100.x`).
2. **Submit Compromise Telemetry**: Ingests a successful authentication within the 10-minute sliding window.
3. **Execute Detection Engine**: Triggers rule `NG-AUTH-001` (Brute-Force) and `NG-AUTH-002` (Login After Failures).
4. **Demonstrate Idempotency**: Re-evaluates detection; verifies 0 duplicate alerts are created via SHA-256 evidence fingerprinting.
5. **Dashboard Triage**: Inspects alerts, evidence payloads, and event correlation on `http://localhost:5173`.
6. **Incident Escalation**: Escalates alert to a security incident with severity and assignee.
7. **Forensic Notes**: Appends timestamped investigator notes.
8. **Status Progression**: Transitions lifecycle (`open` → `investigating` → `contained`).
9. **Persistence Audit**: Inspects immutable timeline and verifies SQLite persistence across restarts.

---

## 4. Documentation Suite

Full technical documentation is available in the [`docs/`](file:///home/saurav/Desktop/EduSec/docs) directory:

| Document | Purpose |
| :--- | :--- |
| [**Architecture Overview**](file:///home/saurav/Desktop/EduSec/docs/ARCHITECTURE.md) | Multi-tier architecture, component boundaries, and data flows. |
| [**Local Setup & Startup**](file:///home/saurav/Desktop/EduSec/docs/SETUP_GUIDE.md) | Prerequisites, environment configuration, and startup/shutdown procedures. |
| [**REST API Reference**](file:///home/saurav/Desktop/EduSec/docs/API_REFERENCE.md) | Endpoint specifications, schemas, status codes, and curl examples. |
| [**Database Schema**](file:///home/saurav/Desktop/EduSec/docs/DATABASE_SCHEMA.md) | SQLite table definitions, indexes, relations, and foreign keys. |
| [**Defensive Security Review**](file:///home/saurav/Desktop/EduSec/docs/SECURITY_REVIEW.md) | Hardening measures, SQL parameterization, payload limits, and scope boundaries. |
| [**Testing & Verification**](file:///home/saurav/Desktop/EduSec/docs/TESTING.md) | Automated test inventory, execution commands, and isolated test database details. |
| [**Presentation Demo Walkthrough**](file:///home/saurav/Desktop/EduSec/docs/DEMO_WALKTHROUGH.md) | Step-by-step presentation script with sample payloads and talking points. |
| [**Troubleshooting Guide**](file:///home/saurav/Desktop/EduSec/docs/TROUBLESHOOTING.md) | Solutions for port conflicts, database locks, CORS issues, and build errors. |

---

## 5. Automated Verification

- **Backend Test Suite**:
  ```bash
  cd backend-java && mvn test
  ```
  *Result*: **72 tests run, 0 failures, 0 errors** (isolated in `target/test-data/edusec-test.db`).
- **Frontend Linter**:
  ```bash
  cd frontend && npm run lint
  ```
  *Result*: **0 errors** across 28 TypeScript files.
- **Frontend Production Build**:
  ```bash
  cd frontend && npm run build
  ```
  *Result*: Built production bundle in `dist/` with **0 errors**.

---

## 6. Academic Prototype Scope Declaration

EduSec is developed as an academic proof-of-concept for defensive security telemetry correlation.  
- **REST Endpoints are Unauthenticated**: No bearer token or user authorization boundary is enforced.
- **Cleartext HTTP**: Local traffic communicates over HTTP/1.1; TLS termination should be provided via reverse proxy in production.
- **Embedded Persistence**: Employs SQLite with single-writer serialization (`HikariCP` pool size: 1).
