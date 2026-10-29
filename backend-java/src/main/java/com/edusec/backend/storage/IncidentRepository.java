package com.edusec.backend.storage;

import com.edusec.backend.exception.StorageException;
import com.edusec.backend.model.Incident;
import com.edusec.backend.model.IncidentNote;
import com.edusec.backend.model.IncidentSeverity;
import com.edusec.backend.model.IncidentStatus;
import com.edusec.backend.model.IncidentTimelineEntry;
import com.edusec.backend.util.DateTimeUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Data access repository for security incidents, notes, timeline, and linked alerts in SQLite.
 */
@Repository
public class IncidentRepository {

    private static final Logger log = LoggerFactory.getLogger(IncidentRepository.class);

    private final JdbcTemplate jdbcTemplate;

    public IncidentRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public synchronized String generateNextIncidentId() {
        String currentYear = String.valueOf(java.time.Year.now().getValue());
        String prefix = "INC-" + currentYear + "-";
        String sql = "SELECT id FROM incidents WHERE id LIKE ? ORDER BY id DESC LIMIT 100";
        try {
            List<String> ids = jdbcTemplate.queryForList(sql, String.class, prefix + "%");
            int maxSeq = 0;
            for (String id : ids) {
                if (id != null && id.startsWith(prefix)) {
                    try {
                        int seq = Integer.parseInt(id.substring(prefix.length()));
                        if (seq > maxSeq) {
                            maxSeq = seq;
                        }
                    } catch (NumberFormatException ignored) {}
                }
            }
            return String.format("%s%03d", prefix, maxSeq + 1);
        } catch (DataAccessException e) {
            log.error("Failed to generate next incident ID: {}", e.getMessage());
            throw new StorageException("Failed to generate incident ID", e);
        }
    }

    public void insertIncident(Incident incident) {
        String sql = """
            INSERT INTO incidents (
                id, title, description, severity, status, assignee, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """;

        try {
            jdbcTemplate.update(
                sql,
                incident.id(),
                incident.title(),
                incident.description(),
                incident.severity().getValue(),
                incident.status().getValue(),
                incident.assignee(),
                DateTimeUtil.toUtcIsoString(incident.createdAt()),
                DateTimeUtil.toUtcIsoString(incident.updatedAt())
            );
        } catch (DataAccessException e) {
            log.error("Failed to insert incident {}: {}", incident.id(), e.getMessage());
            throw new StorageException("Failed to insert incident", e);
        }
    }

    public void updateStatus(String id, IncidentStatus status, Instant updatedAt) {
        String sql = "UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?;";
        try {
            int updated = jdbcTemplate.update(
                sql,
                status.getValue(),
                DateTimeUtil.toUtcIsoString(updatedAt),
                id
            );
            if (updated == 0) {
                throw new StorageException("No incident row updated for id: " + id);
            }
        } catch (DataAccessException e) {
            log.error("Failed to update status for incident {}: {}", id, e.getMessage());
            throw new StorageException("Failed to update incident status", e);
        }
    }

    public void updateIncident(Incident incident) {
        String sql = """
            UPDATE incidents
            SET title = ?, description = ?, severity = ?, status = ?, assignee = ?, updated_at = ?
            WHERE id = ?;
        """;
        try {
            jdbcTemplate.update(
                sql,
                incident.title(),
                incident.description(),
                incident.severity().getValue(),
                incident.status().getValue(),
                incident.assignee(),
                DateTimeUtil.toUtcIsoString(incident.updatedAt()),
                incident.id()
            );
        } catch (DataAccessException e) {
            log.error("Failed to update incident {}: {}", incident.id(), e.getMessage());
            throw new StorageException("Failed to update incident", e);
        }
    }

    public void updateUpdatedAt(String id, Instant updatedAt) {
        String sql = "UPDATE incidents SET updated_at = ? WHERE id = ?;";
        try {
            jdbcTemplate.update(sql, DateTimeUtil.toUtcIsoString(updatedAt), id);
        } catch (DataAccessException e) {
            log.error("Failed to touch updated_at for incident {}: {}", id, e.getMessage());
            throw new StorageException("Failed to update incident timestamp", e);
        }
    }

    public Optional<Incident> findById(String id) {
        if (id == null || id.trim().isEmpty()) {
            return Optional.empty();
        }

        String sql = """
            SELECT id, title, description, severity, status, assignee, created_at, updated_at
            FROM incidents
            WHERE id = ?;
        """;

        try {
            List<Incident> results = jdbcTemplate.query(sql, this::mapRowToIncidentBase, id.trim());
            if (results.isEmpty()) {
                return Optional.empty();
            }

            Incident base = results.get(0);
            List<String> alertIds = findAlertIdsByIncidentId(base.id());
            List<IncidentNote> notes = findNotesByIncidentId(base.id());
            List<IncidentTimelineEntry> timeline = findTimelineByIncidentId(base.id());

            return Optional.of(new Incident(
                base.id(),
                base.title(),
                base.description(),
                base.severity(),
                base.status(),
                alertIds,
                notes,
                timeline,
                base.assignee(),
                base.createdAt(),
                base.updatedAt()
            ));
        } catch (DataAccessException e) {
            log.error("Failed to fetch incident {}: {}", id, e.getMessage());
            throw new StorageException("Failed to fetch incident", e);
        }
    }

    public List<String> findAlertIdsByIncidentId(String incidentId) {
        String sql = "SELECT alert_id FROM incident_alerts WHERE incident_id = ? ORDER BY linked_at ASC;";
        try {
            return jdbcTemplate.queryForList(sql, String.class, incidentId);
        } catch (DataAccessException e) {
            log.error("Failed to fetch alert IDs for incident {}: {}", incidentId, e.getMessage());
            throw new StorageException("Failed to fetch linked alert IDs", e);
        }
    }

    public void insertAlertLink(String incidentId, String alertId, Instant linkedAt) {
        String sql = "INSERT OR IGNORE INTO incident_alerts (incident_id, alert_id, linked_at) VALUES (?, ?, ?);";
        try {
            jdbcTemplate.update(sql, incidentId, alertId, DateTimeUtil.toUtcIsoString(linkedAt));
        } catch (DataAccessException e) {
            log.error("Failed to link alert {} to incident {}: {}", alertId, incidentId, e.getMessage());
            throw new StorageException("Failed to link alert to incident", e);
        }
    }

    public List<IncidentNote> findNotesByIncidentId(String incidentId) {
        String sql = """
            SELECT id, incident_id, author, content, created_at
            FROM incident_notes
            WHERE incident_id = ?
            ORDER BY created_at DESC, id DESC;
        """;
        try {
            return jdbcTemplate.query(sql, this::mapRowToIncidentNote, incidentId);
        } catch (DataAccessException e) {
            log.error("Failed to fetch notes for incident {}: {}", incidentId, e.getMessage());
            throw new StorageException("Failed to fetch incident notes", e);
        }
    }

    public void insertNote(IncidentNote note) {
        String sql = """
            INSERT INTO incident_notes (id, incident_id, author, content, created_at)
            VALUES (?, ?, ?, ?, ?);
        """;
        try {
            jdbcTemplate.update(
                sql,
                note.id(),
                note.incidentId(),
                note.author(),
                note.content(),
                DateTimeUtil.toUtcIsoString(note.createdAt())
            );
        } catch (DataAccessException e) {
            log.error("Failed to insert note for incident {}: {}", note.incidentId(), e.getMessage());
            throw new StorageException("Failed to insert incident note", e);
        }
    }

    public List<IncidentTimelineEntry> findTimelineByIncidentId(String incidentId) {
        String sql = """
            SELECT id, incident_id, timestamp, action, actor, details
            FROM incident_timeline
            WHERE incident_id = ?
            ORDER BY timestamp DESC, id DESC;
        """;
        try {
            return jdbcTemplate.query(sql, this::mapRowToTimelineEntry, incidentId);
        } catch (DataAccessException e) {
            log.error("Failed to fetch timeline for incident {}: {}", incidentId, e.getMessage());
            throw new StorageException("Failed to fetch incident timeline", e);
        }
    }

    public void insertTimelineEntry(IncidentTimelineEntry entry) {
        String sql = """
            INSERT INTO incident_timeline (id, incident_id, timestamp, action, actor, details)
            VALUES (?, ?, ?, ?, ?, ?);
        """;
        try {
            jdbcTemplate.update(
                sql,
                entry.id(),
                entry.incidentId(),
                DateTimeUtil.toUtcIsoString(entry.timestamp()),
                entry.action(),
                entry.actor(),
                entry.details()
            );
        } catch (DataAccessException e) {
            log.error("Failed to insert timeline entry for incident {}: {}", entry.incidentId(), e.getMessage());
            throw new StorageException("Failed to insert timeline entry", e);
        }
    }

    public List<Incident> findIncidents(String severity, String status, String search, int limit, int offset) {
        StringBuilder sql = new StringBuilder("""
            SELECT id, title, description, severity, status, assignee, created_at, updated_at
            FROM incidents
        """);

        List<Object> params = new ArrayList<>();
        List<String> conditions = new ArrayList<>();

        if (severity != null && !severity.trim().isEmpty()) {
            conditions.add("severity = ?");
            params.add(severity.trim().toLowerCase());
        }

        if (status != null && !status.trim().isEmpty()) {
            conditions.add("status = ?");
            params.add(status.trim().toLowerCase());
        }

        if (search != null && !search.trim().isEmpty()) {
            String pattern = "%" + search.trim().toLowerCase() + "%";
            conditions.add("(LOWER(id) LIKE ? OR LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(COALESCE(assignee, '')) LIKE ?)");
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
        }

        if (!conditions.isEmpty()) {
            sql.append(" WHERE ").append(String.join(" AND ", conditions));
        }

        sql.append(" ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?;");
        params.add(limit);
        params.add(offset);

        try {
            List<Incident> baseList = jdbcTemplate.query(sql.toString(), this::mapRowToIncidentBase, params.toArray());
            List<Incident> fullList = new ArrayList<>();
            for (Incident base : baseList) {
                List<String> alertIds = findAlertIdsByIncidentId(base.id());
                List<IncidentNote> notes = findNotesByIncidentId(base.id());
                List<IncidentTimelineEntry> timeline = findTimelineByIncidentId(base.id());

                fullList.add(new Incident(
                    base.id(),
                    base.title(),
                    base.description(),
                    base.severity(),
                    base.status(),
                    alertIds,
                    notes,
                    timeline,
                    base.assignee(),
                    base.createdAt(),
                    base.updatedAt()
                ));
            }
            return fullList;
        } catch (DataAccessException e) {
            log.error("Failed to query incidents: {}", e.getMessage());
            throw new StorageException("Failed to query incidents", e);
        }
    }

    public long countIncidents(String severity, String status, String search) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM incidents");
        List<Object> params = new ArrayList<>();
        List<String> conditions = new ArrayList<>();

        if (severity != null && !severity.trim().isEmpty()) {
            conditions.add("severity = ?");
            params.add(severity.trim().toLowerCase());
        }

        if (status != null && !status.trim().isEmpty()) {
            conditions.add("status = ?");
            params.add(status.trim().toLowerCase());
        }

        if (search != null && !search.trim().isEmpty()) {
            String pattern = "%" + search.trim().toLowerCase() + "%";
            conditions.add("(LOWER(id) LIKE ? OR LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(COALESCE(assignee, '')) LIKE ?)");
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
        }

        if (!conditions.isEmpty()) {
            sql.append(" WHERE ").append(String.join(" AND ", conditions));
        }

        try {
            Long count = jdbcTemplate.queryForObject(sql.toString(), Long.class, params.toArray());
            return count != null ? count : 0L;
        } catch (DataAccessException e) {
            log.error("Failed to count incidents: {}", e.getMessage());
            throw new StorageException("Failed to count incidents", e);
        }
    }

    private Incident mapRowToIncidentBase(ResultSet rs, int rowNum) throws SQLException {
        String id = rs.getString("id");
        String title = rs.getString("title");
        String description = rs.getString("description");
        String severityStr = rs.getString("severity");
        String statusStr = rs.getString("status");
        String assignee = rs.getString("assignee");
        String createdAtStr = rs.getString("created_at");
        String updatedAtStr = rs.getString("updated_at");

        IncidentSeverity severity = IncidentSeverity.fromValue(severityStr);
        IncidentStatus status = IncidentStatus.fromValue(statusStr);
        Instant createdAt = DateTimeUtil.parseToUtc(createdAtStr);
        Instant updatedAt = DateTimeUtil.parseToUtc(updatedAtStr);

        return new Incident(
            id,
            title,
            description,
            severity,
            status,
            Collections.emptyList(),
            Collections.emptyList(),
            Collections.emptyList(),
            assignee,
            createdAt,
            updatedAt
        );
    }

    private IncidentNote mapRowToIncidentNote(ResultSet rs, int rowNum) throws SQLException {
        String id = rs.getString("id");
        String incidentId = rs.getString("incident_id");
        String author = rs.getString("author");
        String content = rs.getString("content");
        String createdAtStr = rs.getString("created_at");

        Instant createdAt = DateTimeUtil.parseToUtc(createdAtStr);
        return new IncidentNote(id, incidentId, author, content, createdAt);
    }

    private IncidentTimelineEntry mapRowToTimelineEntry(ResultSet rs, int rowNum) throws SQLException {
        String id = rs.getString("id");
        String incidentId = rs.getString("incident_id");
        String timestampStr = rs.getString("timestamp");
        String action = rs.getString("action");
        String actor = rs.getString("actor");
        String details = rs.getString("details");

        Instant timestamp = DateTimeUtil.parseToUtc(timestampStr);
        return new IncidentTimelineEntry(id, incidentId, timestamp, action, actor, details);
    }
}
