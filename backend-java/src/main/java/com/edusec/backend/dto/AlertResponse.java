package com.edusec.backend.dto;

import com.edusec.backend.model.Alert;
import com.edusec.backend.util.DateTimeUtil;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * Public REST response DTO for a security alert.
 */
public record AlertResponse(
    String id,
    @JsonProperty("rule_id") String ruleId,
    String title,
    String description,
    String severity,
    @JsonProperty("related_event_ids") List<String> relatedEventIds,
    Map<String, Object> evidence,
    String fingerprint,
    String status,
    @JsonProperty("created_at") String createdAt
) {
    public static AlertResponse fromDomain(Alert alert) {
        return new AlertResponse(
            alert.id(),
            alert.ruleId(),
            alert.title(),
            alert.description(),
            alert.severity().getValue(),
            alert.relatedEventIds(),
            alert.evidence(),
            alert.fingerprint(),
            alert.status().getValue(),
            DateTimeUtil.toUtcIsoString(alert.createdAt())
        );
    }
}
