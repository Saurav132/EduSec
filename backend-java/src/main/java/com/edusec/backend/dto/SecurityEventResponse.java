package com.edusec.backend.dto;

import com.edusec.backend.model.SecurityEvent;
import com.edusec.backend.util.DateTimeUtil;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * Response DTO representing a security event matching EduSec REST schema.
 */
public record SecurityEventResponse(
    String id,
    @JsonProperty("event_type") String eventType,
    String timestamp,
    @JsonProperty("source_ip") String sourceIp,
    String username,
    String outcome,
    @JsonProperty("asset_id") String assetId,
    Map<String, Object> metadata,
    @JsonProperty("created_at") String createdAt
) {
    public static SecurityEventResponse fromDomain(SecurityEvent event) {
        return new SecurityEventResponse(
            event.id(),
            event.eventType(),
            DateTimeUtil.toUtcIsoString(event.timestamp()),
            event.sourceIp(),
            event.username(),
            event.outcome().getValue(),
            event.assetId(),
            event.metadata(),
            DateTimeUtil.toUtcIsoString(event.createdAt())
        );
    }
}
