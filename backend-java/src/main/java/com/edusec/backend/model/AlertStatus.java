package com.edusec.backend.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Lifecycle status of a security alert.
 */
public enum AlertStatus {
    OPEN("open"),
    ACKNOWLEDGED("acknowledged"),
    RESOLVED("resolved"),
    CLOSED("closed");

    private final String value;

    AlertStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static AlertStatus fromValue(String value) {
        if (value == null) {
            return null;
        }
        String cleaned = value.trim().toLowerCase();
        for (AlertStatus s : values()) {
            if (s.value.equalsIgnoreCase(cleaned)) {
                return s;
            }
        }
        throw new IllegalArgumentException("Invalid alert status: '" + value + "'. Must be open, acknowledged, resolved, or closed.");
    }
}
