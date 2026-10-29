package com.edusec.backend.controller;

import com.edusec.backend.dto.DatabaseHealthResponse;
import com.edusec.backend.dto.HealthResponse;
import com.edusec.backend.storage.SecurityEventRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Health check REST controller providing service status and readiness diagnostics.
 */
@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
})
public class HealthController {

    private static final String APP_NAME = "EduSec";
    private static final String API_VERSION = "0.1.0";

    private final SecurityEventRepository repository;

    public HealthController(SecurityEventRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/health")
    public ResponseEntity<HealthResponse> getHealth() {
        boolean dbReady = repository.isDatabaseReady();
        if (!dbReady) {
            HealthResponse degraded = new HealthResponse(
                "degraded",
                APP_NAME,
                API_VERSION,
                new DatabaseHealthResponse(false, "Missing required database tables")
            );
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(degraded);
        }

        HealthResponse response = new HealthResponse(
            "healthy",
            APP_NAME,
            API_VERSION,
            new DatabaseHealthResponse(true, "Database initialized and reachable")
        );
        return ResponseEntity.ok(response);
    }
}
