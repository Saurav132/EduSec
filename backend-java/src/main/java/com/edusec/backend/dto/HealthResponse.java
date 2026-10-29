package com.edusec.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Health check response model matching the EduSec API contract.
 */
public record HealthResponse(
    String status,
    @JsonProperty("app_name") String appName,
    @JsonProperty("api_version") String apiVersion,
    DatabaseHealthResponse database
) {}
