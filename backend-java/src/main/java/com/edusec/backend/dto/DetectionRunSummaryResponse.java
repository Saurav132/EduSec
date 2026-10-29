package com.edusec.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Collections;
import java.util.List;

/**
 * Summary of a detection execution run.
 */
public record DetectionRunSummaryResponse(
    @JsonProperty("events_evaluated") int eventsEvaluated,
    @JsonProperty("alerts_created") int alertsCreated,
    @JsonProperty("alerts_existing") int alertsExisting,
    @JsonProperty("new_alerts") List<AlertResponse> newAlerts
) {
    public DetectionRunSummaryResponse {
        if (newAlerts == null) {
            newAlerts = Collections.emptyList();
        } else {
            newAlerts = List.copyOf(newAlerts);
        }
    }
}
