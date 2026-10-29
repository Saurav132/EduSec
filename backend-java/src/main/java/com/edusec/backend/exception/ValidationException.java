package com.edusec.backend.exception;

/**
 * Thrown when input validation fails, corresponding to HTTP 422 Unprocessable Entity.
 */
public class ValidationException extends RuntimeException {
    public ValidationException(String message) {
        super(message);
    }
}
