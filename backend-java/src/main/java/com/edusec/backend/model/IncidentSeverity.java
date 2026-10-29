package com.edusec.backend.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Normalized severity levels for security incidents.
 */
public enum IncidentSeverity {
    LOW("low"),
    MEDIUM("medium"),
    HIGH("high"),
    CRITICAL("critical");

    private final String value;

    IncidentSeverity(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static IncidentSeverity fromValue(String value) {
        if (value == null) {
            return null;
        }
        String cleaned = value.trim().toLowerCase();
        for (IncidentSeverity s : values()) {
            if (s.value.equalsIgnoreCase(cleaned)) {
                return s;
            }
        }
        throw new IllegalArgumentException("Invalid incident severity: '" + value + "'. Must be low, medium, high, or critical.");
    }
}
