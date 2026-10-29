package com.edusec.backend.model;

import java.time.Instant;
import java.util.Collections;
import java.util.List;

/**
 * Domain model representing a security incident case.
 */
public record Incident(
    String id,
    String title,
    String description,
    IncidentSeverity severity,
    IncidentStatus status,
    List<String> alertIds,
    List<IncidentNote> notes,
    List<IncidentTimelineEntry> timeline,
    String assignee,
    Instant createdAt,
    Instant updatedAt
) {
    public Incident {
        if (alertIds == null) {
            alertIds = Collections.emptyList();
        } else {
            alertIds = List.copyOf(alertIds);
        }
        if (notes == null) {
            notes = Collections.emptyList();
        } else {
            notes = List.copyOf(notes);
        }
        if (timeline == null) {
            timeline = Collections.emptyList();
        } else {
            timeline = List.copyOf(timeline);
        }
        if (status == null) {
            status = IncidentStatus.OPEN;
        }
    }
}
