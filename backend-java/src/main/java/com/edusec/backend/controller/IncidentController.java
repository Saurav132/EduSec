package com.edusec.backend.controller;

import com.edusec.backend.dto.AddIncidentNoteRequest;
import com.edusec.backend.dto.CreateIncidentRequest;
import com.edusec.backend.dto.IncidentNoteResponse;
import com.edusec.backend.dto.IncidentResponse;
import com.edusec.backend.dto.LinkAlertsRequest;
import com.edusec.backend.dto.UpdateIncidentStatusRequest;
import com.edusec.backend.service.IncidentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller for security incident case management, status lifecycle, investigation notes, and alert linking.
 */
@RestController
@RequestMapping("/api/v1/incidents")
@CrossOrigin(
    origins = {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    },
    methods = {
        RequestMethod.GET,
        RequestMethod.POST,
        RequestMethod.PATCH,
        RequestMethod.PUT,
        RequestMethod.DELETE,
        RequestMethod.OPTIONS
    },
    exposedHeaders = {"X-Total-Count"}
)
public class IncidentController {

    private final IncidentService incidentService;

    public IncidentController(IncidentService incidentService) {
        this.incidentService = incidentService;
    }

    @GetMapping
    public ResponseEntity<List<IncidentResponse>> listIncidents(
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String severity,
        @RequestParam(required = false) String search,
        @RequestParam(defaultValue = "50") int limit,
        @RequestParam(defaultValue = "0") int offset
    ) {
        IncidentService.PaginatedIncidents result = incidentService.listIncidents(severity, status, search, limit, offset);
        return ResponseEntity.ok()
            .header("X-Total-Count", String.valueOf(result.total()))
            .body(result.incidents());
    }

    @GetMapping("/{id}")
    public ResponseEntity<IncidentResponse> getIncident(@PathVariable String id) {
        IncidentResponse response = incidentService.getIncidentById(id);
        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<IncidentResponse> createIncident(@RequestBody CreateIncidentRequest request) {
        IncidentResponse created = incidentService.createIncident(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<IncidentResponse> updateStatus(
        @PathVariable String id,
        @RequestBody UpdateIncidentStatusRequest request
    ) {
        IncidentResponse updated = incidentService.updateStatus(id, request);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{id}/notes")
    public ResponseEntity<IncidentNoteResponse> addNote(
        @PathVariable String id,
        @RequestBody AddIncidentNoteRequest request
    ) {
        IncidentNoteResponse note = incidentService.addNote(id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(note);
    }

    @PostMapping("/{id}/alerts")
    public ResponseEntity<IncidentResponse> linkAlerts(
        @PathVariable String id,
        @RequestBody LinkAlertsRequest request
    ) {
        IncidentResponse updated = incidentService.linkAlerts(id, request);
        return ResponseEntity.ok(updated);
    }
}
