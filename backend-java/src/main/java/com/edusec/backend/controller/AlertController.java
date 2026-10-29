package com.edusec.backend.controller;

import com.edusec.backend.dto.AlertResponse;
import com.edusec.backend.service.AlertService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller for security alert retrieval, filtering, and detail inspection.
 */
@RestController
@RequestMapping("/api/v1/alerts")
@CrossOrigin(
    origins = {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    },
    exposedHeaders = {"X-Total-Count"}
)
public class AlertController {

    private final AlertService alertService;

    public AlertController(AlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping
    public ResponseEntity<List<AlertResponse>> listAlerts(
        @RequestParam(required = false) String severity,
        @RequestParam(required = false) String status,
        @RequestParam(name = "rule_id", required = false) String ruleId,
        @RequestParam(defaultValue = "50") int limit,
        @RequestParam(defaultValue = "0") int offset
    ) {
        AlertService.PaginatedAlerts result = alertService.listAlerts(severity, status, ruleId, limit, offset);
        return ResponseEntity.ok()
            .header("X-Total-Count", String.valueOf(result.total()))
            .body(result.alerts());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AlertResponse> getAlert(@PathVariable String id) {
        AlertResponse response = alertService.getAlertById(id);
        return ResponseEntity.ok(response);
    }
}
