package com.edusec.backend.service;

import com.edusec.backend.dto.AddIncidentNoteRequest;
import com.edusec.backend.dto.CreateIncidentRequest;
import com.edusec.backend.dto.IncidentNoteResponse;
import com.edusec.backend.dto.IncidentResponse;
import com.edusec.backend.dto.LinkAlertsRequest;
import com.edusec.backend.dto.UpdateIncidentStatusRequest;
import com.edusec.backend.exception.IncidentNotFoundException;
import com.edusec.backend.exception.ValidationException;
import com.edusec.backend.model.Incident;
import com.edusec.backend.model.IncidentNote;
import com.edusec.backend.model.IncidentSeverity;
import com.edusec.backend.model.IncidentStatus;
import com.edusec.backend.model.IncidentTimelineEntry;
import com.edusec.backend.storage.AlertRepository;
import com.edusec.backend.storage.IncidentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Service orchestrating incident lifecycle management, validation, notes, timeline, and alert linking.
 */
@Service
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final AlertRepository alertRepository;

    public IncidentService(IncidentRepository incidentRepository, AlertRepository alertRepository) {
        this.incidentRepository = incidentRepository;
        this.alertRepository = alertRepository;
    }

    public record PaginatedIncidents(List<IncidentResponse> incidents, long total) {}

    public PaginatedIncidents listIncidents(String severity, String status, String search, int limit, int offset) {
        if (limit < 1 || limit > 100) {
            throw new ValidationException("limit must be between 1 and 100");
        }
        if (offset < 0) {
            throw new ValidationException("offset must be greater than or equal to 0");
        }

        String canonicalSeverity = null;
        if (severity != null && !severity.trim().isEmpty() && !severity.equalsIgnoreCase("all")) {
            try {
                canonicalSeverity = IncidentSeverity.fromValue(severity).getValue();
            } catch (IllegalArgumentException e) {
                throw new ValidationException("Invalid severity: " + severity);
            }
        }

        String canonicalStatus = null;
        if (status != null && !status.trim().isEmpty() && !status.equalsIgnoreCase("all")) {
            try {
                canonicalStatus = IncidentStatus.fromValue(status).getValue();
            } catch (IllegalArgumentException e) {
                throw new ValidationException("Invalid status: " + status);
            }
        }

        String normalizedSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;

        List<Incident> incidents = incidentRepository.findIncidents(canonicalSeverity, canonicalStatus, normalizedSearch, limit, offset);
        long total = incidentRepository.countIncidents(canonicalSeverity, canonicalStatus, normalizedSearch);

        List<IncidentResponse> dtos = incidents.stream()
            .map(IncidentResponse::fromDomain)
            .toList();

        return new PaginatedIncidents(dtos, total);
    }

    public IncidentResponse getIncidentById(String id) {
        if (id == null || id.trim().isEmpty()) {
            throw new IncidentNotFoundException(id);
        }

        return incidentRepository.findById(id.trim())
            .map(IncidentResponse::fromDomain)
            .orElseThrow(() -> new IncidentNotFoundException(id.trim()));
    }

    @Transactional
    public IncidentResponse createIncident(CreateIncidentRequest request) {
        if (request == null) {
            throw new ValidationException("Request body must not be null");
        }

        if (request.getTitle() == null || request.getTitle().trim().length() < 5 || request.getTitle().trim().length() > 200) {
            throw new ValidationException("title must be between 5 and 200 characters");
        }

        if (request.getDescription() == null || request.getDescription().trim().length() < 10 || request.getDescription().trim().length() > 2000) {
            throw new ValidationException("description must be between 10 and 2000 characters");
        }

        if (request.getAssignee() != null && request.getAssignee().trim().length() > 100) {
            throw new ValidationException("assignee exceeds maximum length of 100 characters");
        }

        if (request.getInitialNote() != null && request.getInitialNote().trim().length() > 4000) {
            throw new ValidationException("initial_note exceeds maximum length of 4000 characters");
        }

        IncidentSeverity severity;
        try {
            severity = IncidentSeverity.fromValue(request.getSeverity());
            if (severity == null) {
                throw new ValidationException("severity is required");
            }
        } catch (IllegalArgumentException e) {
            throw new ValidationException("Invalid severity: " + request.getSeverity());
        }

        IncidentStatus status = IncidentStatus.OPEN;
        if (request.getStatus() != null && !request.getStatus().trim().isEmpty()) {
            try {
                status = IncidentStatus.fromValue(request.getStatus());
            } catch (IllegalArgumentException e) {
                throw new ValidationException("Invalid status: " + request.getStatus());
            }
        }

        // Deduplicate and validate linked alerts
        List<String> rawAlertIds = request.getAlertIds() != null ? request.getAlertIds() : Collections.emptyList();
        Set<String> cleanAlertIds = new LinkedHashSet<>();
        for (String aid : rawAlertIds) {
            if (aid != null && !aid.trim().isEmpty()) {
                String cleanId = aid.trim();
                // Check that alert actually exists
                if (alertRepository.findById(cleanId).isEmpty()) {
                    throw new ValidationException(String.format("Alert '%s' does not exist", cleanId));
                }
                cleanAlertIds.add(cleanId);
            }
        }

        String incidentId = incidentRepository.generateNextIncidentId();
        Instant now = Instant.now();
        String actor = (request.getAssignee() != null && !request.getAssignee().isBlank())
            ? request.getAssignee().trim()
            : "Security Analyst";

        Incident incidentToStore = new Incident(
            incidentId,
            request.getTitle().trim(),
            request.getDescription().trim(),
            severity,
            status,
            new ArrayList<>(cleanAlertIds),
            Collections.emptyList(),
            Collections.emptyList(),
            request.getAssignee() != null && !request.getAssignee().isBlank() ? request.getAssignee().trim() : null,
            now,
            now
        );

        incidentRepository.insertIncident(incidentToStore);

        // Insert linked alerts
        for (String alertId : cleanAlertIds) {
            incidentRepository.insertAlertLink(incidentId, alertId, now);
        }

        // Initial timeline entry
        String timelineDetails = String.format("Created with severity %s. Linked %d alert(s).",
            severity.getValue().toUpperCase(), cleanAlertIds.size());
        IncidentTimelineEntry creationEntry = new IncidentTimelineEntry(
            "tl-" + UUID.randomUUID(),
            incidentId,
            now,
            "Incident Created",
            actor,
            timelineDetails
        );
        incidentRepository.insertTimelineEntry(creationEntry);

        // Initial note if provided
        if (request.getInitialNote() != null && !request.getInitialNote().trim().isEmpty()) {
            IncidentNote initialNote = new IncidentNote(
                "note-" + UUID.randomUUID(),
                incidentId,
                actor,
                request.getInitialNote().trim(),
                now
            );
            incidentRepository.insertNote(initialNote);
        }

        return getIncidentById(incidentId);
    }

    @Transactional
    public IncidentResponse updateStatus(String id, UpdateIncidentStatusRequest request) {
        if (id == null || id.trim().isEmpty()) {
            throw new IncidentNotFoundException(id);
        }

        Incident existing = incidentRepository.findById(id.trim())
            .orElseThrow(() -> new IncidentNotFoundException(id.trim()));

        if (request == null || request.getStatus() == null || request.getStatus().trim().isEmpty()) {
            throw new ValidationException("status is required");
        }

        IncidentStatus newStatus;
        try {
            newStatus = IncidentStatus.fromValue(request.getStatus());
        } catch (IllegalArgumentException e) {
            throw new ValidationException("Invalid status: " + request.getStatus());
        }

        Instant now = Instant.now();
        String actor = (request.getAuthor() != null && !request.getAuthor().isBlank())
            ? request.getAuthor().trim()
            : "Security Analyst";

        incidentRepository.updateStatus(existing.id(), newStatus, now);

        // If note provided with status change, save as note
        if (request.getNote() != null && !request.getNote().trim().isEmpty()) {
            IncidentNote note = new IncidentNote(
                "note-" + UUID.randomUUID(),
                existing.id(),
                actor,
                request.getNote().trim(),
                now
            );
            incidentRepository.insertNote(note);
        }

        // Log timeline event
        String action = "Status Changed to " + newStatus.getValue().substring(0, 1).toUpperCase() + newStatus.getValue().substring(1);
        String details = (request.getNote() != null && !request.getNote().trim().isEmpty())
            ? request.getNote().trim()
            : String.format("Transitioned from %s to %s", existing.status().getValue().toUpperCase(), newStatus.getValue().toUpperCase());

        IncidentTimelineEntry timelineEntry = new IncidentTimelineEntry(
            "tl-" + UUID.randomUUID(),
            existing.id(),
            now,
            action,
            actor,
            details
        );
        incidentRepository.insertTimelineEntry(timelineEntry);

        return getIncidentById(existing.id());
    }

    @Transactional
    public IncidentNoteResponse addNote(String id, AddIncidentNoteRequest request) {
        if (id == null || id.trim().isEmpty()) {
            throw new IncidentNotFoundException(id);
        }

        Incident existing = incidentRepository.findById(id.trim())
            .orElseThrow(() -> new IncidentNotFoundException(id.trim()));

        if (request == null || request.getContent() == null || request.getContent().trim().length() < 3 || request.getContent().trim().length() > 4000) {
            throw new ValidationException("content must be between 3 and 4000 characters");
        }

        if (request.getAuthor() == null || request.getAuthor().trim().isEmpty()) {
            throw new ValidationException("author must not be empty");
        }
        if (request.getAuthor().trim().length() > 100) {
            throw new ValidationException("author exceeds maximum length of 100 characters");
        }

        Instant now = Instant.now();
        String author = request.getAuthor().trim();
        String content = request.getContent().trim();

        IncidentNote note = new IncidentNote(
            "note-" + UUID.randomUUID(),
            existing.id(),
            author,
            content,
            now
        );
        incidentRepository.insertNote(note);

        // Timeline entry for note
        String preview = content.length() > 100 ? content.substring(0, 97) + "..." : content;
        IncidentTimelineEntry timelineEntry = new IncidentTimelineEntry(
            "tl-" + UUID.randomUUID(),
            existing.id(),
            now,
            "Investigation Note Added",
            author,
            preview
        );
        incidentRepository.insertTimelineEntry(timelineEntry);
        incidentRepository.updateUpdatedAt(existing.id(), now);

        return IncidentNoteResponse.fromDomain(note);
    }

    @Transactional
    public IncidentResponse linkAlerts(String id, LinkAlertsRequest request) {
        if (id == null || id.trim().isEmpty()) {
            throw new IncidentNotFoundException(id);
        }

        Incident existing = incidentRepository.findById(id.trim())
            .orElseThrow(() -> new IncidentNotFoundException(id.trim()));

        if (request == null || request.getAlertIds() == null || request.getAlertIds().isEmpty()) {
            throw new ValidationException("alert_ids must not be empty");
        }

        Instant now = Instant.now();
        Set<String> cleanAlertIds = new LinkedHashSet<>();
        for (String aid : request.getAlertIds()) {
            if (aid != null && !aid.trim().isEmpty()) {
                String cleanId = aid.trim();
                if (alertRepository.findById(cleanId).isEmpty()) {
                    throw new ValidationException(String.format("Alert '%s' does not exist", cleanId));
                }
                cleanAlertIds.add(cleanId);
            }
        }

        for (String aid : cleanAlertIds) {
            incidentRepository.insertAlertLink(existing.id(), aid, now);
        }

        IncidentTimelineEntry timelineEntry = new IncidentTimelineEntry(
            "tl-" + UUID.randomUUID(),
            existing.id(),
            now,
            "Alerts Linked",
            "Security Analyst",
            String.format("Linked %d alert(s): %s", cleanAlertIds.size(), String.join(", ", cleanAlertIds))
        );
        incidentRepository.insertTimelineEntry(timelineEntry);
        incidentRepository.updateUpdatedAt(existing.id(), now);

        return getIncidentById(existing.id());
    }
}
