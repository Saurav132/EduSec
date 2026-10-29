package com.edusec.backend.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Lifecycle status stages for a security incident.
 */
public enum IncidentStatus {
    OPEN("open"),
    INVESTIGATING("investigating"),
    CONTAINED("contained"),
    RESOLVED("resolved"),
    CLOSED("closed");

    private final String value;

    IncidentStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static IncidentStatus fromValue(String value) {
        if (value == null) {
            return null;
        }
        String cleaned = value.trim().toLowerCase();
        for (IncidentStatus s : values()) {
            if (s.value.equalsIgnoreCase(cleaned)) {
                return s;
            }
        }
        throw new IllegalArgumentException("Invalid incident status: '" + value + "'. Must be open, investigating, contained, resolved, or closed.");
    }
}
