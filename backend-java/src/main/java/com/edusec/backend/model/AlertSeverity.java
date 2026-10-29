package com.edusec.backend.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Normalized severity levels for generated security alerts.
 */
public enum AlertSeverity {
    LOW("low"),
    MEDIUM("medium"),
    HIGH("high"),
    CRITICAL("critical");

    private final String value;

    AlertSeverity(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static AlertSeverity fromValue(String value) {
        if (value == null) {
            return null;
        }
        String cleaned = value.trim().toLowerCase();
        for (AlertSeverity s : values()) {
            if (s.value.equalsIgnoreCase(cleaned)) {
                return s;
            }
        }
        throw new IllegalArgumentException("Invalid alert severity: '" + value + "'. Must be low, medium, high, or critical.");
    }
}
