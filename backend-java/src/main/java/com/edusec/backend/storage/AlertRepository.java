package com.edusec.backend.storage;

import com.edusec.backend.exception.StorageException;
import com.edusec.backend.model.Alert;
import com.edusec.backend.model.AlertSeverity;
import com.edusec.backend.model.AlertStatus;
import com.edusec.backend.util.DateTimeUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Data access repository for security alerts in SQLite.
 */
@Repository
public class AlertRepository {

    private static final Logger log = LoggerFactory.getLogger(AlertRepository.class);

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final RowMapper<Alert> rowMapper;

    public AlertRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.rowMapper = this::mapRowToAlert;
    }

    public record InsertResult(Alert alert, boolean isNew) {}

    public Optional<Alert> findByFingerprint(String fingerprint) {
        if (fingerprint == null || fingerprint.trim().isEmpty()) {
            return Optional.empty();
        }

        String sql = """
            SELECT id, rule_id, title, description, severity, related_event_ids, evidence, fingerprint, status, created_at
            FROM alerts
            WHERE fingerprint = ?;
        """;

        try {
            List<Alert> results = jdbcTemplate.query(sql, rowMapper, fingerprint.trim());
            return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
        } catch (DataAccessException e) {
            log.error("Failed to fetch alert by fingerprint {}: {}", fingerprint, e.getMessage());
            throw new StorageException("Failed to fetch alert by fingerprint", e);
        }
    }

    public InsertResult insert(Alert alert) {
        // 1. Check if alert with identical fingerprint already exists
        if (alert.fingerprint() != null && !alert.fingerprint().trim().isEmpty()) {
            Optional<Alert> existing = findByFingerprint(alert.fingerprint());
            if (existing.isPresent()) {
                return new InsertResult(existing.get(), false);
            }
        }

        String sql = """
            INSERT INTO alerts (
                id, rule_id, title, description, severity, related_event_ids, evidence, fingerprint, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """;

        String jsonRelatedIds;
        try {
            jsonRelatedIds = objectMapper.writeValueAsString(alert.relatedEventIds());
        } catch (Exception e) {
            jsonRelatedIds = "[]";
        }

        String jsonEvidence;
        try {
            jsonEvidence = objectMapper.writeValueAsString(alert.evidence());
        } catch (Exception e) {
            jsonEvidence = "{}";
        }

        Instant createdAt = alert.createdAt() != null ? alert.createdAt() : Instant.now();
        Alert toStore = new Alert(
            alert.id(),
            alert.ruleId(),
            alert.title(),
            alert.description(),
            alert.severity(),
            alert.relatedEventIds(),
            alert.evidence(),
            alert.fingerprint(),
            alert.status() != null ? alert.status() : AlertStatus.OPEN,
            createdAt
        );

        try {
            jdbcTemplate.update(
                sql,
                toStore.id(),
                toStore.ruleId(),
                toStore.title(),
                toStore.description(),
                toStore.severity().getValue(),
                jsonRelatedIds,
                jsonEvidence,
                toStore.fingerprint(),
                toStore.status().getValue(),
                DateTimeUtil.toUtcIsoString(toStore.createdAt())
            );
            return new InsertResult(toStore, true);
        } catch (DuplicateKeyException e) {
            // Fingerprint collision race condition
            if (toStore.fingerprint() != null) {
                Optional<Alert> existing = findByFingerprint(toStore.fingerprint());
                if (existing.isPresent()) {
                    return new InsertResult(existing.get(), false);
                }
            }
            throw new StorageException("Failed to persist alert due to duplicate constraint", e);
        } catch (DataAccessException e) {
            log.error("Failed to insert alert: {}", e.getMessage(), e);
            throw new StorageException("Failed to persist alert to database", e);
        }
    }

    public Optional<Alert> findById(String alertId) {
        if (alertId == null || alertId.trim().isEmpty()) {
            return Optional.empty();
        }

        String sql = """
            SELECT id, rule_id, title, description, severity, related_event_ids, evidence, fingerprint, status, created_at
            FROM alerts
            WHERE id = ?;
        """;

        try {
            List<Alert> results = jdbcTemplate.query(sql, rowMapper, alertId.trim());
            return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
        } catch (DataAccessException e) {
            log.error("Failed to fetch alert by id {}: {}", alertId, e.getMessage(), e);
            throw new StorageException("Failed to fetch alert from database", e);
        }
    }

    public List<Alert> findAlerts(String severity, String status, String ruleId, int limit, int offset) {
        StringBuilder sql = new StringBuilder("""
            SELECT id, rule_id, title, description, severity, related_event_ids, evidence, fingerprint, status, created_at
            FROM alerts
            WHERE 1=1
        """);
        List<Object> params = new ArrayList<>();

        if (severity != null && !severity.trim().isEmpty()) {
            sql.append(" AND severity = ?");
            params.add(severity.trim());
        }
        if (status != null && !status.trim().isEmpty()) {
            sql.append(" AND status = ?");
            params.add(status.trim());
        }
        if (ruleId != null && !ruleId.trim().isEmpty()) {
            sql.append(" AND rule_id = ?");
            params.add(ruleId.trim());
        }

        sql.append(" ORDER BY created_at DESC LIMIT ? OFFSET ?;");
        params.add(limit);
        params.add(offset);

        try {
            return jdbcTemplate.query(sql.toString(), rowMapper, params.toArray());
        } catch (DataAccessException e) {
            log.error("Failed to query alerts: {}", e.getMessage(), e);
            throw new StorageException("Failed to retrieve alerts from database", e);
        }
    }

    public long countAlerts(String severity, String status, String ruleId) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM alerts WHERE 1=1");
        List<Object> params = new ArrayList<>();

        if (severity != null && !severity.trim().isEmpty()) {
            sql.append(" AND severity = ?");
            params.add(severity.trim());
        }
        if (status != null && !status.trim().isEmpty()) {
            sql.append(" AND status = ?");
            params.add(status.trim());
        }
        if (ruleId != null && !ruleId.trim().isEmpty()) {
            sql.append(" AND rule_id = ?");
            params.add(ruleId.trim());
        }

        try {
            Long count = jdbcTemplate.queryForObject(sql.toString(), Long.class, params.toArray());
            return count != null ? count : 0L;
        } catch (DataAccessException e) {
            log.error("Failed to count alerts: {}", e.getMessage(), e);
            throw new StorageException("Failed to count alerts in database", e);
        }
    }

    private Alert mapRowToAlert(ResultSet rs, int rowNum) throws SQLException {
        String rawRelatedIds = rs.getString("related_event_ids");
        List<String> relatedIds;
        try {
            if (rawRelatedIds != null && !rawRelatedIds.trim().isEmpty()) {
                relatedIds = objectMapper.readValue(rawRelatedIds, new TypeReference<List<String>>() {});
            } else {
                relatedIds = Collections.emptyList();
            }
        } catch (Exception e) {
            relatedIds = Collections.emptyList();
        }

        String rawEvidence = rs.getString("evidence");
        Map<String, Object> evidence;
        try {
            if (rawEvidence != null && !rawEvidence.trim().isEmpty()) {
                evidence = objectMapper.readValue(rawEvidence, new TypeReference<Map<String, Object>>() {});
            } else {
                evidence = Collections.emptyMap();
            }
        } catch (Exception e) {
            evidence = Collections.emptyMap();
        }

        AlertSeverity severity;
        try {
            severity = AlertSeverity.fromValue(rs.getString("severity"));
        } catch (Exception e) {
            severity = AlertSeverity.HIGH;
        }

        AlertStatus status;
        try {
            status = AlertStatus.fromValue(rs.getString("status"));
        } catch (Exception e) {
            status = AlertStatus.OPEN;
        }

        Instant createdAt = DateTimeUtil.parseToUtc(rs.getString("created_at"));

        return new Alert(
            rs.getString("id"),
            rs.getString("rule_id"),
            rs.getString("title"),
            rs.getString("description"),
            severity,
            relatedIds,
            evidence,
            rs.getString("fingerprint"),
            status,
            createdAt
        );
    }
}
