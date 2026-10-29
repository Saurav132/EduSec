package com.edusec.backend.model;

import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Domain model representing a validated, normalized security event.
 */
public record SecurityEvent(
    String id,
    String eventType,
    Instant timestamp,
    String sourceIp,
    String username,
    EventOutcome outcome,
    String assetId,
    Map<String, Object> metadata,
    Instant createdAt
) {
    public SecurityEvent {
        if (metadata == null) {
            metadata = Collections.emptyMap();
        } else {
            metadata = Collections.unmodifiableMap(new HashMap<>(metadata));
        }
    }
}
