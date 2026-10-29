package com.edusec.backend.controller;

import com.edusec.backend.dto.CreateEventRequest;
import com.edusec.backend.dto.SecurityEventResponse;
import com.edusec.backend.service.SecurityEventService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller for security event ingestion, pagination, and detail inspection.
 */
@RestController
@RequestMapping("/api/v1/events")
@CrossOrigin(
    origins = {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    },
    exposedHeaders = {"X-Total-Count"}
)
public class EventController {

    private final SecurityEventService service;

    public EventController(SecurityEventService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<SecurityEventResponse> ingestEvent(@RequestBody CreateEventRequest request) {
        SecurityEventResponse response = service.ingestEvent(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<SecurityEventResponse>> listEvents(
        @RequestParam(defaultValue = "50") int limit,
        @RequestParam(defaultValue = "0") int offset
    ) {
        SecurityEventService.PaginatedEvents result = service.listEvents(limit, offset);
        return ResponseEntity.ok()
            .header("X-Total-Count", String.valueOf(result.total()))
            .body(result.events());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SecurityEventResponse> getEvent(@PathVariable String id) {
        SecurityEventResponse response = service.getEventById(id);
        return ResponseEntity.ok(response);
    }
}
