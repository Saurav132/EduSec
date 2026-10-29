package com.edusec.backend.dto;

import com.edusec.backend.model.IncidentNote;
import com.edusec.backend.util.DateTimeUtil;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Public REST response DTO for an incident investigation note.
 */
public record IncidentNoteResponse(
    String id,
    @JsonProperty("incident_id") String incidentId,
    String author,
    String content,
    @JsonProperty("created_at") String createdAt
) {
    public static IncidentNoteResponse fromDomain(IncidentNote note) {
        return new IncidentNoteResponse(
            note.id(),
            note.incidentId(),
            note.author(),
            note.content(),
            DateTimeUtil.toUtcIsoString(note.createdAt())
        );
    }
}
