package com.edusec.backend.dto;

/**
 * Request payload for appending an investigation note to an incident.
 */
public class AddIncidentNoteRequest {

    private String content;
    private String author;

    public AddIncidentNoteRequest() {}

    public AddIncidentNoteRequest(String content, String author) {
        this.content = content;
        this.author = author;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }
}
