package com.edusec.backend.dto;

import com.edusec.backend.model.Incident;
import com.edusec.backend.util.DateTimeUtil;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Collections;
import java.util.List;

/**
 * Public REST response DTO for a security incident case.
 */
public record IncidentResponse(
    String id,
    String title,
    String description,
    String severity,
    String status,
    @JsonProperty("alert_ids") List<String> alertIds,
    List<IncidentNoteResponse> notes,
    List<IncidentTimelineResponse> timeline,
    String assignee,
    @JsonProperty("created_at") String createdAt,
    @JsonProperty("updated_at") String updatedAt
) {
    public IncidentResponse {
        if (alertIds == null) alertIds = Collections.emptyList();
        if (notes == null) notes = Collections.emptyList();
        if (timeline == null) timeline = Collections.emptyList();
    }

    public static IncidentResponse fromDomain(Incident incident) {
        List<IncidentNoteResponse> noteDtos = incident.notes() != null
            ? incident.notes().stream().map(IncidentNoteResponse::fromDomain).toList()
            : Collections.emptyList();

        List<IncidentTimelineResponse> timelineDtos = incident.timeline() != null
            ? incident.timeline().stream().map(IncidentTimelineResponse::fromDomain).toList()
            : Collections.emptyList();

        return new IncidentResponse(
            incident.id(),
            incident.title(),
            incident.description(),
            incident.severity().getValue(),
            incident.status().getValue(),
            incident.alertIds(),
            noteDtos,
            timelineDtos,
            incident.assignee(),
            DateTimeUtil.toUtcIsoString(incident.createdAt()),
            DateTimeUtil.toUtcIsoString(incident.updatedAt())
        );
    }
}
