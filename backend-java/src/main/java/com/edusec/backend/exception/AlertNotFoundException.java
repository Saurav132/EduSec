package com.edusec.backend.exception;

/**
 * Thrown when a requested alert is not found, corresponding to HTTP 404 Not Found.
 */
public class AlertNotFoundException extends RuntimeException {
    public AlertNotFoundException(String alertId) {
        super(String.format("Alert '%s' not found", alertId));
    }
}
