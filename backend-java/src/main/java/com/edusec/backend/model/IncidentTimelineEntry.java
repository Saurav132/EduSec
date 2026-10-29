package com.edusec.backend.model;

import java.time.Instant;

/**
 * Domain record representing an audit/activity timeline event for an incident.
 */
public record IncidentTimelineEntry(
    String id,
    String incidentId,
    Instant timestamp,
    String action,
    String actor,
    String details
) {}
