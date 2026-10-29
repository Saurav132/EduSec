package com.edusec.backend.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.HashMap;
import java.util.Map;

/**
 * Request payload for ingesting a security event.
 * Captures known primary fields and preserves any extra top-level fields into metadata.
 */
public class CreateEventRequest {

    private String id;

    @JsonProperty("event_type")
    private String eventType;

    private String timestamp;

    @JsonProperty("source_ip")
    private String sourceIp;

    private String username;

    private String outcome;

    @JsonProperty("asset_id")
    private String assetId;

    private Map<String, Object> metadata = new HashMap<>();

    public CreateEventRequest() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public String getSourceIp() {
        return sourceIp;
    }

    public void setSourceIp(String sourceIp) {
        this.sourceIp = sourceIp;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getOutcome() {
        return outcome;
    }

    public void setOutcome(String outcome) {
        this.outcome = outcome;
    }

    public String getAssetId() {
        return assetId;
    }

    public void setAssetId(String assetId) {
        this.assetId = assetId;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        if (metadata != null) {
            this.metadata.putAll(metadata);
        }
    }

    @JsonAnySetter
    public void handleUnknownField(String key, Object value) {
        if (key != null && !this.metadata.containsKey(key)) {
            this.metadata.put(key, value);
        }
    }
}
