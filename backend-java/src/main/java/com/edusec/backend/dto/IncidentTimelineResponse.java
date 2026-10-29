package com.edusec.backend.dto;

import com.edusec.backend.model.IncidentTimelineEntry;
import com.edusec.backend.util.DateTimeUtil;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Public REST response DTO for an incident activity timeline entry.
 */
public record IncidentTimelineResponse(
    String id,
    @JsonProperty("incident_id") String incidentId,
    String timestamp,
    String action,
    String actor,
    String details
) {
    public static IncidentTimelineResponse fromDomain(IncidentTimelineEntry entry) {
        return new IncidentTimelineResponse(
            entry.id(),
            entry.incidentId(),
            DateTimeUtil.toUtcIsoString(entry.timestamp()),
            entry.action(),
            entry.actor(),
            entry.details()
        );
    }
}
