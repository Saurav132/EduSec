package com.edusec.backend.controller;

import com.edusec.backend.dto.DetectionRunSummaryResponse;
import com.edusec.backend.service.DetectionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for triggering SIEM detection cycles across stored events.
 */
@RestController
@RequestMapping("/api/v1/detections")
@CrossOrigin(
    origins = {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    }
)
public class DetectionController {

    private final DetectionService detectionService;

    public DetectionController(DetectionService detectionService) {
        this.detectionService = detectionService;
    }

    @PostMapping("/run")
    public ResponseEntity<DetectionRunSummaryResponse> runDetections(
        @RequestParam(name = "lookback_minutes", required = false) Integer lookbackMinutes
    ) {
        DetectionRunSummaryResponse summary = detectionService.runDetectionCycle(lookbackMinutes);
        return ResponseEntity.ok(summary);
    }
}
