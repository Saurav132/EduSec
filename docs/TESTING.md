# EduSec Testing and Verification Guide

---

## 1. Test Suite Overview

EduSec features automated test suites verifying:
- Event ingestion and parameter boundary validation.
- Detection rule accuracy for `NG-AUTH-001` (Brute-Force) and `NG-AUTH-002` (Login After Failures).
- SHA-256 evidence fingerprint deduplication.
- Case management lifecycle (`open` -> `investigating` -> `contained`).
- Referential integrity with SQLite `PRAGMA foreign_keys = ON;`.
- Restart persistence across SQLite contexts.
- SQL injection immunity on search and ID queries.
- CORS headers and error response sanitization.

---

## 2. Running Automated Tests

### 2.1 Backend Java Test Suite
```bash
cd /home/saurav/Desktop/EduSec/backend-java
mvn test
```
- **Execution Results**:
  ```
  [INFO] Results:
  [INFO] 
  [INFO] Tests run: 70, Failures: 0, Errors: 0, Skipped: 0
  [INFO] 
  [INFO] ------------------------------------------------------------------------
  [INFO] BUILD SUCCESS
  [INFO] Total time: 9.336 s
  ```
- **Test Isolation**: All automated tests run against an isolated test database (`target/test-data/edusec-test.db`). The development database `data/edusec.db` is completely untouched.

### 2.2 Frontend Linter
```bash
cd /home/saurav/Desktop/EduSec/frontend
npm run lint
```
- **Result**: `0 errors` (oxlint verified across 28 frontend TypeScript files).

### 2.3 Frontend Production Build
```bash
cd /home/saurav/Desktop/EduSec/frontend
npm run build
```
- **Result**: `tsc -b && vite build` built production bundle in `dist/` with 0 errors.

---

## 3. Automated Test Inventory

| Test Class | Focus Area | Tests Run | Pass |
| :--- | :--- | :---: | :---: |
| `EndToEndWorkflowIntegrationTest` | E2E lifecycle, deduplication, restart persistence, SQL injection, CORS | 11 | 11 |
| `IncidentControllerTest` | Incident CRUD, status transitions, notes, timeline, filters | 10 | 10 |
| `EventControllerTest` | Ingestion, validation limits, pagination, query headers | 11 | 11 |
| `AlertAndDetectionIntegrationTest` | Detection passes, evidence payload integrity, alert filtering | 7 | 7 |
| `LoginAfterFailuresRuleTest` | Unit tests for NG-AUTH-002 algorithm and time windows | 7 | 7 |
| `RepeatedFailedLoginsRuleTest` | Unit tests for NG-AUTH-001 sliding window logic | 8 | 8 |
| `FingerprintUtilTest` | SHA-256 evidence hash determinism | 4 | 4 |
| `IpAddressValidatorTest` | IPv4 & IPv6 CIDR and string normalization | 10 | 10 |
| `DateTimeUtilTest` | ISO-8601 UTC timestamp parsing and serialization | 1 | 1 |
| `HealthControllerTest` | Service readiness, 404 sanitization, 405 error responses | 3 | 3 |
| **Total** | | **72** | **72** |
