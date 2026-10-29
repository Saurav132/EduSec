package com.edusec.backend.dto;

/**
 * Nested database readiness status for the health check response.
 */
public record DatabaseHealthResponse(
    boolean ready,
    String details
) {}
