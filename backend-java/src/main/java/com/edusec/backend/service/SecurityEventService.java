package com.edusec.backend.service;

import com.edusec.backend.dto.CreateEventRequest;
import com.edusec.backend.dto.SecurityEventResponse;
import com.edusec.backend.exception.EventNotFoundException;
import com.edusec.backend.exception.ValidationException;
import com.edusec.backend.model.EventOutcome;
import com.edusec.backend.model.SecurityEvent;
import com.edusec.backend.storage.SecurityEventRepository;
import com.edusec.backend.util.DateTimeUtil;
import com.edusec.backend.util.IpAddressValidator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Service orchestrating validation, normalization, and persistence of security events.
 */
@Service
public class SecurityEventService {

    private final SecurityEventRepository repository;
    private final AtomicLong eventIngestionGeneration = new AtomicLong(0);

    public SecurityEventService(SecurityEventRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public SecurityEventResponse ingestEvent(CreateEventRequest request) {
        if (request == null) {
            throw new ValidationException("Request body cannot be null");
        }

        // 1. Validate event_type
        String eventType = request.getEventType();
        if (eventType == null || eventType.trim().isEmpty()) {
            throw new ValidationException("event_type must not be empty or whitespace only");
        }
        eventType = eventType.trim();
        if (eventType.length() > 100) {
            throw new ValidationException("event_type exceeds maximum length of 100 characters");
        }

        // 2. Validate timestamp
        Instant timestamp = DateTimeUtil.parseToUtc(request.getTimestamp());

        // 3. Validate outcome
        String rawOutcome = request.getOutcome();
        if (rawOutcome == null || rawOutcome.trim().isEmpty()) {
            throw new ValidationException("outcome must not be empty");
        }
        EventOutcome outcome;
        try {
            outcome = EventOutcome.fromValue(rawOutcome);
        } catch (IllegalArgumentException e) {
            throw new ValidationException(e.getMessage());
        }

        // 4. Validate source_ip
        String sourceIp = IpAddressValidator.validateAndNormalize(request.getSourceIp());

        // 5. Optional username & asset_id validation
        String username = request.getUsername();
        if (username != null && username.length() > 150) {
            throw new ValidationException("username exceeds maximum length of 150 characters");
        }

        String assetId = request.getAssetId();
        if (assetId != null && assetId.length() > 100) {
            throw new ValidationException("asset_id exceeds maximum length of 100 characters");
        }

        // 6. ID generation or normalization
        String id = request.getId();
        if (id == null || id.trim().isEmpty()) {
            id = UUID.randomUUID().toString();
        } else {
            id = id.trim();
            if (id.length() > 64) {
                throw new ValidationException("id exceeds maximum length of 64 characters");
            }
        }

        // 7. Server-authoritative ingestion timestamp
        Instant createdAt = Instant.now();

        SecurityEvent event = new SecurityEvent(
            id,
            eventType,
            timestamp,
            sourceIp,
            username,
            outcome,
            assetId,
            request.getMetadata() != null ? request.getMetadata() : Collections.emptyMap(),
            createdAt
        );

        SecurityEvent stored = repository.insert(event);
        eventIngestionGeneration.incrementAndGet();
        return SecurityEventResponse.fromDomain(stored);
    }

    public long getEventIngestionGeneration() {
        return eventIngestionGeneration.get();
    }

    public SecurityEventResponse getEventById(String eventId) {
        if (eventId == null || eventId.trim().isEmpty()) {
            throw new EventNotFoundException(eventId);
        }

        SecurityEvent event = repository.findById(eventId.trim())
            .orElseThrow(() -> new EventNotFoundException(eventId.trim()));

        return SecurityEventResponse.fromDomain(event);
    }

    public PaginatedEvents listEvents(int limit, int offset) {
        if (limit < 1 || limit > 100) {
            throw new ValidationException("limit must be between 1 and 100");
        }
        if (offset < 0) {
            throw new ValidationException("offset must be greater than or equal to 0");
        }

        List<SecurityEvent> events = repository.findAll(limit, offset);
        long total = repository.count();

        List<SecurityEventResponse> dtoList = events.stream()
            .map(SecurityEventResponse::fromDomain)
            .toList();

        return new PaginatedEvents(dtoList, total);
    }

    public record PaginatedEvents(List<SecurityEventResponse> events, long total) {}
}
