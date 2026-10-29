package com.edusec.backend.dto;

/**
 * Standard error response DTO matching FastAPI error format: {"detail": "..."}.
 */
public record ErrorResponse(
    Object detail
) {}
