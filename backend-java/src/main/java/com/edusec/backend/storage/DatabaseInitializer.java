package com.edusec.backend.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Initializes SQLite database tables, indexes, and directory structure.
 */
@Component
public class DatabaseInitializer implements InitializingBean {

    private static final Logger log = LoggerFactory.getLogger(DatabaseInitializer.class);

    private final JdbcTemplate jdbcTemplate;

    @Value("${spring.datasource.url:jdbc:sqlite:data/edusec.db}")
    private String datasourceUrl;

    public DatabaseInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void afterPropertiesSet() throws Exception {
        ensureDatabaseDirectoryExists();
        initializeSchema();
    }

    private void ensureDatabaseDirectoryExists() {
        try {
            if (datasourceUrl != null && datasourceUrl.startsWith("jdbc:sqlite:")) {
                String rawPath = datasourceUrl.substring("jdbc:sqlite:".length()).trim();
                if (!rawPath.isEmpty() && !rawPath.equals(":memory:") && !rawPath.contains("?mode=memory")) {
                    Path path = Paths.get(rawPath);
                    if (path.getParent() != null) {
                        Files.createDirectories(path.getParent());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Could not create database directory: {}", e.getMessage());
        }
    }

    public void initializeSchema() {
        log.info("Initializing EduSec SQLite database schema...");

        try {
            jdbcTemplate.execute("PRAGMA foreign_keys = ON;");
        } catch (Exception e) {
            log.debug("PRAGMA foreign_keys not supported on this connection: {}", e.getMessage());
        }

        // 1. Create security_events table
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS security_events (
                id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                source_ip TEXT,
                username TEXT,
                outcome TEXT NOT NULL,
                asset_id TEXT,
                details TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        """);

        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_events_timestamp ON security_events(timestamp);");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_events_event_type ON security_events(event_type);");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_events_source_ip ON security_events(source_ip);");

        // 2. Create alerts table
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id TEXT PRIMARY KEY,
                rule_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                severity TEXT NOT NULL,
                related_event_ids TEXT NOT NULL,
                evidence TEXT NOT NULL DEFAULT '{}',
                fingerprint TEXT,
                status TEXT NOT NULL DEFAULT 'open',
                created_at TEXT NOT NULL
            );
        """);

        // Safe column checks / migrations for alerts table
        try {
            List<String> columns = jdbcTemplate.query(
                "PRAGMA table_info(alerts);",
                (rs, rowNum) -> rs.getString("name")
            );
            Set<String> columnSet = new HashSet<>(columns);
            if (!columnSet.contains("evidence")) {
                jdbcTemplate.execute("ALTER TABLE alerts ADD COLUMN evidence TEXT NOT NULL DEFAULT '{}';");
            }
            if (!columnSet.contains("fingerprint")) {
                jdbcTemplate.execute("ALTER TABLE alerts ADD COLUMN fingerprint TEXT;");
            }
        } catch (Exception e) {
            log.debug("Safe column check for alerts completed with notice: {}", e.getMessage());
        }

        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_alerts_rule_id ON alerts(rule_id);");
        jdbcTemplate.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_fingerprint ON alerts(fingerprint);");

        // 3. Create incidents table
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
                status TEXT NOT NULL CHECK(status IN ('open', 'investigating', 'contained', 'resolved', 'closed')),
                assignee TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """);

        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);");

        // 4. Create incident_alerts join table
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS incident_alerts (
                incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
                alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
                linked_at TEXT NOT NULL,
                PRIMARY KEY (incident_id, alert_id)
            );
        """);

        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_incident_alerts_incident_id ON incident_alerts(incident_id);");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_incident_alerts_alert_id ON incident_alerts(alert_id);");

        // 5. Create incident_notes table
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS incident_notes (
                id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
                author TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        """);

        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_incident_notes_incident_id ON incident_notes(incident_id);");

        // 6. Create incident_timeline table
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS incident_timeline (
                id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
                timestamp TEXT NOT NULL,
                action TEXT NOT NULL,
                actor TEXT NOT NULL,
                details TEXT
            );
        """);

        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident_id ON incident_timeline(incident_id);");

        log.info("EduSec SQLite schema initialization complete.");
    }
}
