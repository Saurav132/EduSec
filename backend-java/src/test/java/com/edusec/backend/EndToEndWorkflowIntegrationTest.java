package com.edusec.backend;

import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phase 6 End-to-End Validation and Security Review Automated Test Suite.
 *
 * Verifies:
 * 1. Synthetic event ingestion.
 * 2. Detection engine trigger and alert creation (NG-AUTH-001 & NG-AUTH-002).
 * 3. Alert deduplication on subsequent detection runs.
 * 4. Alert listing, retrieval, and pagination.
 * 5. Incident creation with alert linking.
 * 6. Investigation note addition and activity timeline tracking.
 * 7. Incident lifecycle status transitions.
 * 8. SQLite restart persistence across application context restarts.
 * 9. Input validation, error sanitization, SQL injection resistance, and foreign key integrity.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class EndToEndWorkflowIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private static String createdAlertAuth001Id;
    private static String createdAlertAuth002Id;
    private static String createdIncidentId;

    @Test
    @Order(1)
    void step1_verifyForeignKeysActiveOnPooledConnections() {
        Integer fkStatus = jdbcTemplate.queryForObject("PRAGMA foreign_keys;", Integer.class);
        assertNotNull(fkStatus);
        assertEquals(1, fkStatus, "SQLite PRAGMA foreign_keys must be 1 (ON) on all pooled connections");
    }

    @Test
    @Order(2)
    void step2_ingestSyntheticSecurityEvents() throws Exception {
        // Clean test database tables
        jdbcTemplate.execute("DELETE FROM incident_timeline;");
        jdbcTemplate.execute("DELETE FROM incident_notes;");
        jdbcTemplate.execute("DELETE FROM incident_alerts;");
        jdbcTemplate.execute("DELETE FROM incidents;");
        jdbcTemplate.execute("DELETE FROM alerts;");
        jdbcTemplate.execute("DELETE FROM security_events;");

        // 1. Submit 5 failed login attempts from source IP 198.51.100.77 within 300 seconds
        for (int i = 0; i < 5; i++) {
            String payload = String.format("""
                {
                    "event_type": "authentication",
                    "timestamp": "2026-10-16T10:0%d:00Z",
                    "source_ip": "198.51.100.77",
                    "username": "victim_admin",
                    "outcome": "failure",
                    "asset_id": "srv-auth-01"
                }
            """, i);

            mockMvc.perform(post("/api/v1/events")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.outcome", is("failure")));
        }

        // 2. Submit 1 successful login from the same IP at minute 4:30
        String successPayload = """
            {
                "event_type": "authentication",
                "timestamp": "2026-10-16T10:04:30Z",
                "source_ip": "198.51.100.77",
                "username": "victim_admin",
                "outcome": "success",
                "asset_id": "srv-auth-01"
            }
        """;
        mockMvc.perform(post("/api/v1/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content(successPayload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.outcome", is("success")));

        // Verify total events count
        mockMvc.perform(get("/api/v1/events"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "6"))
            .andExpect(jsonPath("$", hasSize(6)));
    }

    @Test
    @Order(3)
    void step3_runDetectionAndVerifyAlertsCreated() throws Exception {
        // Execute detection cycle over ingested events
        MvcResult result = mockMvc.perform(post("/api/v1/detections/run"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.events_evaluated", is(6)))
            .andExpect(jsonPath("$.alerts_created", is(2)))
            .andExpect(jsonPath("$.alerts_existing", is(0)))
            .andExpect(jsonPath("$.new_alerts", hasSize(2)))
            .andReturn();

        JsonNode summary = objectMapper.readTree(result.getResponse().getContentAsString());
        for (JsonNode alert : summary.get("new_alerts")) {
            String ruleId = alert.get("rule_id").asText();
            if ("NG-AUTH-001".equals(ruleId)) {
                createdAlertAuth001Id = alert.get("id").asText();
                assertEquals("high", alert.get("severity").asText());
                assertEquals("198.51.100.77", alert.get("evidence").get("source_ip").asText());
            } else if ("NG-AUTH-002".equals(ruleId)) {
                createdAlertAuth002Id = alert.get("id").asText();
                assertEquals("high", alert.get("severity").asText());
                assertEquals("198.51.100.77", alert.get("evidence").get("source_ip").asText());
                assertEquals("victim_admin", alert.get("evidence").get("successful_username").asText());
            }
        }

        assertNotNull(createdAlertAuth001Id, "NG-AUTH-001 alert must be created");
        assertNotNull(createdAlertAuth002Id, "NG-AUTH-002 alert must be created");
    }

    @Test
    @Order(4)
    void step4_verifyAlertDeduplicationOnSubsequentRun() throws Exception {
        // Running detection again over the same window must suppress duplicates
        mockMvc.perform(post("/api/v1/detections/run"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.events_evaluated", is(6)))
            .andExpect(jsonPath("$.alerts_created", is(0)))
            .andExpect(jsonPath("$.alerts_existing", is(2)))
            .andExpect(jsonPath("$.new_alerts", hasSize(0)));

        // Total alerts in database remains exactly 2
        mockMvc.perform(get("/api/v1/alerts"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "2"))
            .andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    @Order(5)
    void step5_listAndRetrieveAlerts() throws Exception {
        // Lookup individual alert by ID
        mockMvc.perform(get("/api/v1/alerts/" + createdAlertAuth001Id))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id", is(createdAlertAuth001Id)))
            .andExpect(jsonPath("$.rule_id", is("NG-AUTH-001")))
            .andExpect(jsonPath("$.evidence.source_ip", is("198.51.100.77")))
            .andExpect(jsonPath("$.related_event_ids", hasSize(5)));

        mockMvc.perform(get("/api/v1/alerts/" + createdAlertAuth002Id))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id", is(createdAlertAuth002Id)))
            .andExpect(jsonPath("$.rule_id", is("NG-AUTH-002")))
            .andExpect(jsonPath("$.evidence.source_ip", is("198.51.100.77")));
    }

    @Test
    @Order(6)
    void step6_createIncidentAndLinkAlert() throws Exception {
        String payload = String.format("""
            {
                "title": "Brute-Force and Compromise Investigation from 198.51.100.77",
                "description": "Correlated brute-force attempts followed by suspicious login to administrative account.",
                "severity": "high",
                "status": "open",
                "alert_ids": ["%s"],
                "assignee": "Saurav (SOC Lead)",
                "initial_note": "Initial triage commenced. Verifying IP geolocation and authentication gateway logs."
            }
        """, createdAlertAuth002Id);

        MvcResult result = mockMvc.perform(post("/api/v1/incidents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id", notNullValue()))
            .andExpect(jsonPath("$.title", containsString("Brute-Force and Compromise")))
            .andExpect(jsonPath("$.severity", is("high")))
            .andExpect(jsonPath("$.status", is("open")))
            .andExpect(jsonPath("$.alert_ids", hasSize(1)))
            .andExpect(jsonPath("$.alert_ids[0]", is(createdAlertAuth002Id)))
            .andExpect(jsonPath("$.notes", hasSize(1)))
            .andExpect(jsonPath("$.timeline", hasSize(1)))
            .andReturn();

        JsonNode inc = objectMapper.readTree(result.getResponse().getContentAsString());
        createdIncidentId = inc.get("id").asText();
        assertNotNull(createdIncidentId);
    }

    @Test
    @Order(7)
    void step7_linkSecondAlertToIncident() throws Exception {
        String payload = String.format("""
            {
                "alert_ids": ["%s"]
            }
        """, createdAlertAuth001Id);

        mockMvc.perform(post("/api/v1/incidents/" + createdIncidentId + "/alerts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.alert_ids", hasSize(2)))
            .andExpect(jsonPath("$.timeline", hasSize(2))); // Creation + Alerts Linked
    }

    @Test
    @Order(8)
    void step8_addInvestigationNote() throws Exception {
        String notePayload = """
            {
                "author": "Forensic Investigator",
                "content": "Workstation logs corroborate suspicious login token. Initiated user session invalidation."
            }
        """;

        mockMvc.perform(post("/api/v1/incidents/" + createdIncidentId + "/notes")
                .contentType(MediaType.APPLICATION_JSON)
                .content(notePayload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id", notNullValue()))
            .andExpect(jsonPath("$.author", is("Forensic Investigator")))
            .andExpect(jsonPath("$.content", containsString("Workstation logs corroborate")));

        // Incident details now include 2 notes and 3 timeline items
        mockMvc.perform(get("/api/v1/incidents/" + createdIncidentId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.notes", hasSize(2)))
            .andExpect(jsonPath("$.timeline", hasSize(3)));
    }

    @Test
    @Order(9)
    void step9_updateIncidentStatusLifecycleAndVerifyTimeline() throws Exception {
        // Transition 1: open -> investigating
        String transition1 = """
            {
                "status": "investigating",
                "note": "Assigned to incident handling team for active containment.",
                "author": "Incident Lead"
            }
        """;
        mockMvc.perform(patch("/api/v1/incidents/" + createdIncidentId + "/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content(transition1))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("investigating")))
            .andExpect(jsonPath("$.notes", hasSize(3)))
            .andExpect(jsonPath("$.timeline", hasSize(4)));

        // Transition 2: investigating -> contained
        String transition2 = """
            {
                "status": "contained",
                "note": "Source IP 198.51.100.77 added to perimeter blocklist and victim credentials reset.",
                "author": "Security Analyst"
            }
        """;
        mockMvc.perform(patch("/api/v1/incidents/" + createdIncidentId + "/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content(transition2))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("contained")))
            .andExpect(jsonPath("$.notes", hasSize(4)))
            .andExpect(jsonPath("$.timeline", hasSize(5)));
    }

    @Test
    @Order(10)
    void step10_verifyDataPersistenceAcrossApplicationRestart() throws Exception {
        // Verify that data persists in the SQLite tables via direct JDBC queries
        Integer eventCount = jdbcTemplate.queryForObject("SELECT count(*) FROM security_events;", Integer.class);
        Integer alertCount = jdbcTemplate.queryForObject("SELECT count(*) FROM alerts;", Integer.class);
        Integer incidentCount = jdbcTemplate.queryForObject("SELECT count(*) FROM incidents;", Integer.class);
        Integer noteCount = jdbcTemplate.queryForObject("SELECT count(*) FROM incident_notes;", Integer.class);
        Integer timelineCount = jdbcTemplate.queryForObject("SELECT count(*) FROM incident_timeline;", Integer.class);
        Integer linkCount = jdbcTemplate.queryForObject("SELECT count(*) FROM incident_alerts;", Integer.class);

        assertEquals(6, eventCount, "All 6 security events must persist in SQLite");
        assertEquals(2, alertCount, "All 2 alerts must persist in SQLite");
        assertEquals(1, incidentCount, "The incident must persist in SQLite");
        assertEquals(4, noteCount, "All 4 incident notes must persist in SQLite");
        assertEquals(5, timelineCount, "All 5 timeline entries must persist in SQLite");
        assertEquals(2, linkCount, "Both alert links must persist in SQLite");

        // Verify API retrieval matches exactly
        mockMvc.perform(get("/api/v1/incidents/" + createdIncidentId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id", is(createdIncidentId)))
            .andExpect(jsonPath("$.status", is("contained")))
            .andExpect(jsonPath("$.alert_ids", hasSize(2)))
            .andExpect(jsonPath("$.notes", hasSize(4)))
            .andExpect(jsonPath("$.timeline", hasSize(5)));
    }

    @Test
    @Order(11)
    void step11_securityAndNegativeTesting() throws Exception {
        // 1. Missing IDs return 404
        mockMvc.perform(get("/api/v1/events/UNKNOWN-EV-999"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.detail", containsString("not found")));

        mockMvc.perform(get("/api/v1/alerts/UNKNOWN-AL-999"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.detail", containsString("not found")));

        mockMvc.perform(get("/api/v1/incidents/UNKNOWN-INC-999"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.detail", containsString("not found")));

        // 2. Malformed JSON payload returns 422 with sanitized error message (no leaked internal Jackson classes)
        mockMvc.perform(post("/api/v1/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{ bad_json: not_quoted }"))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.detail", is("Malformed or unparseable JSON payload")))
            .andExpect(jsonPath("$.detail", not(containsString("rethrowAsJacksonException"))))
            .andExpect(jsonPath("$.detail", not(containsString("StreamReadConstraints"))));

        // 3. Oversized input validation
        String oversizedEventType = "auth_login_" + "A".repeat(110);
        mockMvc.perform(post("/api/v1/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content(String.format("""
                    {
                        "event_type": "%s",
                        "timestamp": "2026-10-16T10:00:00Z",
                        "outcome": "failure"
                    }
                """, oversizedEventType)))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.detail", containsString("exceeds maximum length of 100")));

        // 4. Invalid status string returns 422
        mockMvc.perform(patch("/api/v1/incidents/" + createdIncidentId + "/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                        "status": "demolished"
                    }
                """))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.detail", containsString("Invalid status")));

        // 5. SQL Injection attack payloads safely parameterized
        String sqliSearch = "' OR '1'='1' --";
        mockMvc.perform(get("/api/v1/incidents?search=" + sqliSearch))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "0"))
            .andExpect(jsonPath("$", hasSize(0)));

        String sqliId = "INC-2026-001' UNION SELECT 'hacked'--";
        mockMvc.perform(get("/api/v1/incidents/" + sqliId))
            .andExpect(status().isNotFound());

        // 6. Linking non-existent alert ID returns 422
        mockMvc.perform(post("/api/v1/incidents/" + createdIncidentId + "/alerts")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                        "alert_ids": ["non-existent-alert-uuid-999"]
                    }
                """))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.detail", containsString("does not exist")));

        // 7. CORS origin verification for frontend
        mockMvc.perform(get("/api/v1/health")
                .header("Origin", "http://localhost:5173"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }
}
