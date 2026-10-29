# EduSec Local Installation and Startup Guide

---

## 1. System Requirements & Prerequisites

The EduSec system requires:
- **Operating System**: Linux, macOS, or Windows (WSL recommended).
- **Java Development Kit (JDK)**: Java 17 or higher (tested on OpenJDK 21).
  - Verify with: `java -version`
- **Apache Maven**: Version 3.8 or higher (tested on Maven 3.9.12).
  - Verify with: `mvn -version`
- **Node.js**: Version 18 or higher (tested on Node.js v22.22).
  - Verify with: `node -v`
- **npm**: Version 9 or higher (tested on npm 9.2).
  - Verify with: `npm -v`

---

## 2. Port Requirements

| Service | Port | Description |
| :--- | :---: | :--- |
| **Java Spring Boot** | `8080` | Primary REST API & SIEM correlation engine |
| **React/Vite Frontend**| `5173` | SOC Analyst Dashboard |

### How to Check if Ports are Free:
```bash
# Check port 8080 (Backend)
lsof -i :8080 || echo "Port 8080 is free"

# Check port 5173 (Frontend)
lsof -i :5173 || echo "Port 5173 is free"
```

If a port is in use:
```bash
# Terminate process occupying port 8080
kill -9 $(lsof -t -i :8080)

# Terminate process occupying port 5173
kill -9 $(lsof -t -i :5173)
```

---

## 3. Starting the Application

### 3.1 Start the Java Backend (Terminal 1)
```bash
cd /home/saurav/Desktop/EduSec/backend-java
mvn spring-boot:run
```
Expected output:
```
 :: Spring Boot ::                (v4.1.1)
...
INFO ... c.e.backend.BackendApplication : Started BackendApplication in 2.1 seconds
```
Verify backend health in browser or via curl:
```bash
curl http://localhost:8080/api/v1/health
```

### 3.2 Start the React Frontend (Terminal 2)
```bash
cd /home/saurav/Desktop/EduSec/frontend
npm install   # (First run only)
npm run dev
```
Expected output:
```
  VITE v8.3.4  ready in 180 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```
Open **`http://localhost:5173`** in your browser.

---

## 4. Stopping the Application

To stop either service running in the foreground:
- Press `Ctrl + C` in the respective terminal window.

To stop background daemon processes:
```bash
kill $(lsof -t -i :8080) 2>/dev/null || true
kill $(lsof -t -i :5173) 2>/dev/null || true
```

---

## 5. Configuration & Environment Variables

### Backend Configuration
File: `backend-java/src/main/resources/application.properties`  
Example template: `backend-java/src/main/resources/application.properties.example`

| Variable | Property Key | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | `server.port` | `8080` | HTTP port for REST APIs |
| `EDUSEC_DB_URL` | `spring.datasource.url` | `jdbc:sqlite:data/edusec.db` | SQLite JDBC connection URL |
| `EDUSEC_CORS_ALLOWED_ORIGINS` | `edusec.cors.allowed-origins` | `http://localhost:5173,...` | Comma-delimited CORS origins |

### Frontend Configuration
File: `frontend/.env`  
Example template: `frontend/.env.example`

| Variable | Default | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8080` | URL of the Java backend REST API |
