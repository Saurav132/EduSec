package com.edusec.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

/**
 * Request payload for creating a new security incident case.
 */
public class CreateIncidentRequest {

    private String title;
    private String description;
    private String severity;
    private String status = "open";

    @JsonProperty("alert_ids")
    private List<String> alertIds = new ArrayList<>();

    private String assignee;

    @JsonProperty("initial_note")
    private String initialNote;

    public CreateIncidentRequest() {}

    public CreateIncidentRequest(String title, String description, String severity, String status, List<String> alertIds, String assignee, String initialNote) {
        this.title = title;
        this.description = description;
        this.severity = severity;
        if (status != null) this.status = status;
        if (alertIds != null) this.alertIds = alertIds;
        this.assignee = assignee;
        this.initialNote = initialNote;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public List<String> getAlertIds() {
        return alertIds;
    }

    public void setAlertIds(List<String> alertIds) {
        this.alertIds = alertIds != null ? alertIds : new ArrayList<>();
    }

    public String getAssignee() {
        return assignee;
    }

    public void setAssignee(String assignee) {
        this.assignee = assignee;
    }

    public String getInitialNote() {
        return initialNote;
    }

    public void setInitialNote(String initialNote) {
        this.initialNote = initialNote;
    }
}
