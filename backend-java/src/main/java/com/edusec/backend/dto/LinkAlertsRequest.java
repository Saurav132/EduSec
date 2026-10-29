package com.edusec.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

/**
 * Request payload for linking alerts to an existing incident.
 */
public class LinkAlertsRequest {

    @JsonProperty("alert_ids")
    private List<String> alertIds = new ArrayList<>();

    public LinkAlertsRequest() {}

    public LinkAlertsRequest(List<String> alertIds) {
        if (alertIds != null) this.alertIds = alertIds;
    }

    public List<String> getAlertIds() {
        return alertIds;
    }

    public void setAlertIds(List<String> alertIds) {
        this.alertIds = alertIds != null ? alertIds : new ArrayList<>();
    }
}
