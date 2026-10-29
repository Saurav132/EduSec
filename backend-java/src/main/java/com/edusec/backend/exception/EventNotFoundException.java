package com.edusec.backend.exception;

/**
 * Thrown when a requested security event ID is not found, corresponding to HTTP 404 Not Found.
 */
public class EventNotFoundException extends RuntimeException {
    public EventNotFoundException(String eventId) {
        super(String.format("Security event '%s' not found", eventId));
    }
}
