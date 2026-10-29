package com.edusec.backend.storage;

import com.edusec.backend.exception.StorageException;
import com.edusec.backend.model.EventOutcome;
import com.edusec.backend.model.SecurityEvent;
import com.edusec.backend.util.DateTimeUtil;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Data access repository for security events in SQLite.
 */
@Repository
public class SecurityEventRepository {

    private static final Logger log = LoggerFactory.getLogger(SecurityEventRepository.class);

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final RowMapper<SecurityEvent> rowMapper;

    public SecurityEventRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.rowMapper = this::mapRowToEvent;
    }

    public SecurityEvent insert(SecurityEvent event) {
        String sql = """
            INSERT INTO security_events (
                id, event_type, timestamp, source_ip, username, outcome, asset_id, details, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """;

        String jsonDetails;
        try {
            jsonDetails = objectMapper.writeValueAsString(event.metadata());
        } catch (Exception e) {
            log.error("Failed to serialize metadata for event {}: {}", event.id(), e.getMessage());
            jsonDetails = "{}";
        }

        try {
            jdbcTemplate.update(
                sql,
                event.id(),
                event.eventType(),
                DateTimeUtil.toUtcIsoString(event.timestamp()),
                event.sourceIp(),
                event.username(),
                event.outcome().getValue(),
                event.assetId(),
                jsonDetails,
                DateTimeUtil.toUtcIsoString(event.createdAt())
            );
            return event;
        } catch (DataAccessException e) {
            log.error("Failed to insert security event: {}", e.getMessage(), e);
            throw new StorageException("Failed to persist security event to database", e);
        }
    }

    public Optional<SecurityEvent> findById(String id) {
        String sql = """
            SELECT id, event_type, timestamp, source_ip, username, outcome, asset_id, details, created_at
            FROM security_events
            WHERE id = ?;
        """;

        try {
            List<SecurityEvent> results = jdbcTemplate.query(sql, rowMapper, id);
            return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
        } catch (DataAccessException e) {
            log.error("Failed to fetch security event by id {}: {}", id, e.getMessage(), e);
            throw new StorageException("Failed to fetch security event from database", e);
        }
    }

    public List<SecurityEvent> findAll(int limit, int offset) {
        String sql = """
            SELECT id, event_type, timestamp, source_ip, username, outcome, asset_id, details, created_at
            FROM security_events
            ORDER BY timestamp DESC, created_at DESC
            LIMIT ? OFFSET ?;
        """;

        try {
            return jdbcTemplate.query(sql, rowMapper, limit, offset);
        } catch (DataAccessException e) {
            log.error("Failed to query security events: {}", e.getMessage(), e);
            throw new StorageException("Failed to retrieve security events from database", e);
        }
    }

    public List<SecurityEvent> findEventsForDetection(Integer lookbackSeconds) {
        StringBuilder sql = new StringBuilder("""
            SELECT id, event_type, timestamp, source_ip, username, outcome, asset_id, details, created_at
            FROM security_events
        """);
        List<Object> params = new java.util.ArrayList<>();

        if (lookbackSeconds != null && lookbackSeconds > 0) {
            Instant cutoff = Instant.now().minusSeconds(lookbackSeconds);
            sql.append(" WHERE timestamp >= ?");
            params.add(DateTimeUtil.toUtcIsoString(cutoff));
        }

        sql.append(" ORDER BY timestamp ASC, created_at ASC;");

        try {
            return jdbcTemplate.query(sql.toString(), rowMapper, params.toArray());
        } catch (DataAccessException e) {
            log.error("Failed to query events for detection: {}", e.getMessage(), e);
            throw new StorageException("Failed to retrieve events for detection from database", e);
        }
    }

    public long count() {
        String sql = "SELECT COUNT(*) FROM security_events;";
        try {
            Long count = jdbcTemplate.queryForObject(sql, Long.class);
            return count != null ? count : 0L;
        } catch (DataAccessException e) {
            log.error("Failed to count security events: {}", e.getMessage(), e);
            throw new StorageException("Failed to count security events in database", e);
        }
    }

    public boolean isDatabaseReady() {
        try {
            jdbcTemplate.queryForObject("SELECT 1;", Integer.class);
            List<String> tables = jdbcTemplate.query(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('security_events', 'alerts');",
                (rs, rowNum) -> rs.getString("name")
            );
            Set<String> tableSet = new HashSet<>(tables);
            return tableSet.contains("security_events") && tableSet.contains("alerts");
        } catch (Exception e) {
            log.warn("Database readiness check failed: {}", e.getMessage());
            return false;
        }
    }

    private SecurityEvent mapRowToEvent(ResultSet rs, int rowNum) throws SQLException {
        String rawDetails = rs.getString("details");
        Map<String, Object> metadata;
        try {
            if (rawDetails != null && !rawDetails.trim().isEmpty()) {
                metadata = objectMapper.readValue(rawDetails, new TypeReference<Map<String, Object>>() {});
            } else {
                metadata = Collections.emptyMap();
            }
        } catch (Exception e) {
            metadata = Collections.singletonMap("raw", rawDetails);
        }

        Instant timestamp = DateTimeUtil.parseToUtc(rs.getString("timestamp"));
        Instant createdAt = DateTimeUtil.parseToUtc(rs.getString("created_at"));
        EventOutcome outcome = EventOutcome.fromValue(rs.getString("outcome"));

        return new SecurityEvent(
            rs.getString("id"),
            rs.getString("event_type"),
            timestamp,
            rs.getString("source_ip"),
            rs.getString("username"),
            outcome,
            rs.getString("asset_id"),
            metadata,
            createdAt
        );
    }
}
