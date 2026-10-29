package com.edusec.backend.dto;

/**
 * Request payload for updating the status of an incident.
 */
public class UpdateIncidentStatusRequest {

    private String status;
    private String note;
    private String author = "Security Analyst";

    public UpdateIncidentStatusRequest() {}

    public UpdateIncidentStatusRequest(String status, String note, String author) {
        this.status = status;
        this.note = note;
        if (author != null && !author.isBlank()) this.author = author;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }
}
