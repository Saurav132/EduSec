package com.edusec.backend.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Normalized outcomes for security events.
 */
public enum EventOutcome {
    SUCCESS("success"),
    FAILURE("failure"),
    UNKNOWN("unknown");

    private final String value;

    EventOutcome(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static EventOutcome fromValue(String value) {
        if (value == null) {
            return null;
        }
        String cleaned = value.trim().toLowerCase();
        if (cleaned.equals("success") || cleaned.equals("successful") || cleaned.equals("succeeded")) {
            return SUCCESS;
        }
        if (cleaned.equals("failure") || cleaned.equals("failed") || cleaned.equals("fail")) {
            return FAILURE;
        }
        if (cleaned.equals("unknown")) {
            return UNKNOWN;
        }
        throw new IllegalArgumentException("Invalid event outcome: '" + value + "'. Must be success, failure, or unknown.");
    }
}
