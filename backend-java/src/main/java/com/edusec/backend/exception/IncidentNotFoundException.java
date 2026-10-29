package com.edusec.backend.exception;

/**
 * Thrown when a requested incident is not found, corresponding to HTTP 404 Not Found.
 */
public class IncidentNotFoundException extends RuntimeException {
    public IncidentNotFoundException(String incidentId) {
        super(String.format("Incident %s not found", incidentId));
    }
}
