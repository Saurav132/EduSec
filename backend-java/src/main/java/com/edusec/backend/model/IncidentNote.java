package com.edusec.backend.model;

import java.time.Instant;

/**
 * Domain record representing an analyst note attached to an incident.
 */
public record IncidentNote(
    String id,
    String incidentId,
    String author,
    String content,
    Instant createdAt
) {}
