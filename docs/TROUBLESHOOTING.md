# EduSec Troubleshooting Guide

---

## 1. Port Conflicts

### Symptom: `Port 8080 was already in use` or `Address already in use`
- **Cause**: Another instance of the Spring Boot backend or a conflicting process is already running on port 8080.
- **Resolution**:
  ```bash
  # Identify the process listening on port 8080
  lsof -i :8080

  # Terminate the process
  kill -9 $(lsof -t -i :8080)
  ```

### Symptom: `Port 5173 is in use, trying another port...`
- **Cause**: Vite detected port 5173 is occupied and automatically incremented to 5174. The frontend will not be reachable on the expected port.
- **Resolution**:
  ```bash
  kill -9 $(lsof -t -i :5173)
  cd /home/saurav/Desktop/EduSec/frontend
  npm run dev
  ```

---

## 2. Backend & SQLite Issues

### Symptom: `org.sqlite.SQLiteException: [SQLITE_BUSY] The database file is locked`
- **Cause**: Multiple write operations attempted simultaneously, or an external SQLite browser has locked the database file.
- **Resolution**:
  1. Close external GUI SQLite tools (e.g. DB Browser for SQLite).
  2. Verify that Hikari pool size is set to 1 in `application.properties`:
     ```properties
     spring.datasource.hikari.maximum-pool-size=1
     ```

### Symptom: `Database directory does not exist`
- **Cause**: The `data/` directory was not automatically created.
- **Resolution**:
  `DatabaseInitializer` automatically creates parent directories on startup. If running manual scripts, ensure:
  ```bash
  mkdir -p /home/saurav/Desktop/EduSec/backend-java/data
  ```

---

## 3. Frontend & Connectivity Issues

### Symptom: Header displays `Backend Offline` (Red Badge)
- **Cause**: The React frontend is unable to reach `http://localhost:8080/api/v1/health`.
- **Troubleshooting Steps**:
  1. Verify the Java backend is running:
     ```bash
     curl -i http://localhost:8080/api/v1/health
     ```
  2. Check `frontend/.env` to confirm the API base URL matches:
     ```properties
     VITE_API_BASE_URL="http://127.0.0.1:8080"
     ```
  3. Inspect browser developer tools (F12) Console and Network tabs for CORS or network refusal errors.

### Symptom: CORS Error in Browser Console (`Access to fetch ... has been blocked by CORS policy`)
- **Cause**: The frontend origin is not in the backend's allowed origins list.
- **Resolution**:
  In `backend-java/src/main/resources/application.properties`, verify:
  ```properties
  edusec.cors.allowed-origins=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000
  ```

---

## 4. Test Suite Execution Issues

### Symptom: `mvn test` fails with foreign key violations
- **Cause**: The isolated test database configuration was not loaded.
- **Resolution**:
  Verify that `backend-java/src/test/resources/application.properties` exists and specifies:
  ```properties
  spring.datasource.url=jdbc:sqlite:target/test-data/edusec-test.db
  spring.datasource.hikari.connection-init-sql=PRAGMA foreign_keys = ON;
  ```
