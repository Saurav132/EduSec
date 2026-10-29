package com.edusec.backend.exception;

/**
 * Thrown when a database or storage error occurs without leaking internal details.
 */
public class StorageException extends RuntimeException {
    public StorageException(String message) {
        super(message);
    }

    public StorageException(String message, Throwable cause) {
        super(message, cause);
    }
}
