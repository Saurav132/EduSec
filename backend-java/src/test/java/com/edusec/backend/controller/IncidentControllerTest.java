package com.edusec.backend.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class IncidentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("DELETE FROM incident_timeline;");
        jdbcTemplate.execute("DELETE FROM incident_notes;");
        jdbcTemplate.execute("DELETE FROM incident_alerts;");
        jdbcTemplate.execute("DELETE FROM incidents;");
        jdbcTemplate.execute("DELETE FROM alerts;");
        jdbcTemplate.execute("DELETE FROM security_events;");
    }

    private void insertSampleAlert(String alertId, String title, String severity) {
        jdbcTemplate.update("""
            INSERT INTO alerts (id, rule_id, title, description, severity, related_event_ids, evidence, fingerprint, status, created_at)
            VALUES (?, 'NG-AUTH-001', ?, 'Sample alert description', ?, '[]', '{}', ?, 'open', '2026-10-15T09:00:00Z');
        """, alertId, title, severity, "fp-" + alertId);
    }

    @Test
    void emptyIncidentsListReturns200AndEmptyArray() throws Exception {
        mockMvc.perform(get("/api/v1/incidents"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "0"))
            .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void createIncidentValidationFailures() throws Exception {
        // Missing title
        String missingTitle = """
            {
                "description": "Valid long description of the security incident",
                "severity": "high"
            }
        """;
        mockMvc.perform(post("/api/v1/incidents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(missingTitle))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.detail", containsString("title")));

        // Title too short (< 5 chars)
        String shortTitle = """
            {
                "title": "Hi",
                "description": "Valid long description of the security incident",
                "severity": "high"
            }
        """;
        mockMvc.perform(post("/api/v1/incidents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(shortTitle))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.detail", containsString("title")));

        // Description too short (< 10 chars)
        String shortDesc = """
            {
                "title": "Valid Incident Title",
                "description": "Short",
                "severity": "high"
            }
        """;
        mockMvc.perform(post("/api/v1/incidents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(shortDesc))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.detail", containsString("description")));

        // Invalid severity
        String badSeverity = """
            {
                "title": "Valid Incident Title",
                "description": "Valid long description of the security incident",
                "severity": "extreme"
            }
        """;
        mockMvc.perform(post("/api/v1/incidents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(badSeverity))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.detail", containsString("severity")));

        // Non-existent alert ID
        String nonExistentAlert = """
            {
                "title": "Valid Incident Title",
                "description": "Valid long description of the security incident",
                "severity": "high",
                "alert_ids": ["does-not-exist-123"]
            }
        """;
        mockMvc.perform(post("/api/v1/incidents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(nonExistentAlert))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.detail", containsString("does-not-exist-123")));
    }

    @Test
    void createIncidentSuccessWithoutAlerts() throws Exception {
        String payload = """
            {
                "title": "Brute-force credential stuffing against portal admin",
                "description": "Multiple consecutive failed logins followed by anomaly on authentication service.",
                "severity": "high",
                "status": "open",
                "assignee": "Saurav (SOC Lead)",
                "initial_note": "Observed during morning triage. Initiating endpoint check."
            }
        """;

        MvcResult result = mockMvc.perform(post("/api/v1/incidents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id", containsString("INC-")))
            .andExpect(jsonPath("$.title", is("Brute-force credential stuffing against portal admin")))
            .andExpect(jsonPath("$.severity", is("high")))
            .andExpect(jsonPath("$.status", is("open")))
            .andExpect(jsonPath("$.assignee", is("Saurav (SOC Lead)")))
            .andExpect(jsonPath("$.alert_ids", hasSize(0)))
            .andExpect(jsonPath("$.notes", hasSize(1)))
            .andExpect(jsonPath("$.notes[0].content", is("Observed during morning triage. Initiating endpoint check.")))
            .andExpect(jsonPath("$.notes[0].author", is("Saurav (SOC Lead)")))
            .andExpect(jsonPath("$.timeline", hasSize(1)))
            .andExpect(jsonPath("$.timeline[0].action", is("Incident Created")))
            .andExpect(jsonPath("$.created_at", notNullValue()))
            .andExpect(jsonPath("$.updated_at", notNullValue()))
            .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        String generatedId = root.get("id").asText();
        assertNotNull(generatedId);

        // Retrieve by ID
        mockMvc.perform(get("/api/v1/incidents/" + generatedId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id", is(generatedId)))
            .andExpect(jsonPath("$.title", is("Brute-force credential stuffing against portal admin")));
    }

    @Test
    void createIncidentSuccessWithLinkedAlertAndDeduplication() throws Exception {
        insertSampleAlert("alert-001", "Repeated Failed Logins", "high");
        insertSampleAlert("alert-002", "Login After Failures", "critical");

        String payload = """
            {
                "title": "Correlated Authentication Breach Wave",
                "description": "Aggregated detection alerts indicating high confidence unauthorized access attempt.",
                "severity": "critical",
                "status": "open",
                "alert_ids": ["alert-001", "alert-002", "alert-001"]
            }
        """;

        MvcResult result = mockMvc.perform(post("/api/v1/incidents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.alert_ids", hasSize(2))) // Deduplicated
            .andExpect(jsonPath("$.severity", is("critical")))
            .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        String incidentId = root.get("id").asText();

        // Verify database persistence in join table
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM incident_alerts WHERE incident_id = ?",
            Integer.class,
            incidentId
        );
        assertEquals(2, count);
    }

    @Test
    void getIncidentNotFoundReturns404() throws Exception {
        mockMvc.perform(get("/api/v1/incidents/INC-2026-999"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.detail", is("Incident INC-2026-999 not found")));
    }

    @Test
    void updateIncidentStatusLifecycleAndTimelineLogging() throws Exception {
        String createPayload = """
            {
                "title": "Investigation into Unauthorized Access",
                "description": "Suspicious privilege escalation observed in audit log telemetry.",
                "severity": "high",
                "status": "open"
            }
        """;

        MvcResult createResult = mockMvc.perform(post("/api/v1/incidents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(createPayload))
            .andExpect(status().isCreated())
            .andReturn();

        String incId = objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText();

        // Update to INVESTIGATING without note
        String update1 = """
            {
                "status": "investigating",
                "author": "Analyst Alice"
            }
        """;
        mockMvc.perform(patch("/api/v1/incidents/" + incId + "/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content(update1))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("investigating")))
            .andExpect(jsonPath("$.timeline", hasSize(2))); // Created + Status Changed

        // Update to CONTAINED with note
        String update2 = """
            {
                "status": "contained",
                "note": "Revoked session tokens and blocked ingress IP 192.168.1.105",
                "author": "Analyst Bob"
            }
        """;
        mockMvc.perform(patch("/api/v1/incidents/" + incId + "/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content(update2))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("contained")))
            .andExpect(jsonPath("$.notes", hasSize(1)))
            .andExpect(jsonPath("$.notes[0].content", is("Revoked session tokens and blocked ingress IP 192.168.1.105")))
            .andExpect(jsonPath("$.timeline", hasSize(3)));

        // Invalid status returns 422
        String badUpdate = """
            {
                "status": "destroyed"
            }
        """;
        mockMvc.perform(patch("/api/v1/incidents/" + incId + "/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content(badUpdate))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.detail", containsString("status")));

        // Update status for unknown incident returns 404
        mockMvc.perform(patch("/api/v1/incidents/INC-UNKNOWN/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content(update1))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.detail", containsString("INC-UNKNOWN")));
    }

    @Test
    void addIncidentNoteSuccessAndValidation() throws Exception {
        String createPayload = """
            {
                "title": "Telemetry Anomaly Case",
                "description": "High frequency anomalous request flow on internal auth service.",
                "severity": "medium",
                "status": "investigating"
            }
        """;
        MvcResult createResult = mockMvc.perform(post("/api/v1/incidents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(createPayload))
            .andExpect(status().isCreated())
            .andReturn();

        String incId = objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText();

        // Valid note
        String notePayload = """
            {
                "content": "Workstation forensic dump completed with clean signatures.",
                "author": "Lead Investigator"
            }
        """;
        mockMvc.perform(post("/api/v1/incidents/" + incId + "/notes")
                .contentType(MediaType.APPLICATION_JSON)
                .content(notePayload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id", notNullValue()))
            .andExpect(jsonPath("$.incident_id", is(incId)))
            .andExpect(jsonPath("$.content", is("Workstation forensic dump completed with clean signatures.")))
            .andExpect(jsonPath("$.author", is("Lead Investigator")))
            .andExpect(jsonPath("$.created_at", notNullValue()));

        // Check that incident detail reflects note and timeline
        mockMvc.perform(get("/api/v1/incidents/" + incId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.notes", hasSize(1)))
            .andExpect(jsonPath("$.timeline", hasSize(2))); // Created + Note added

        // Content too short (< 3 chars)
        String shortNote = """
            {
                "content": "No",
                "author": "Lead Investigator"
            }
        """;
        mockMvc.perform(post("/api/v1/incidents/" + incId + "/notes")
                .contentType(MediaType.APPLICATION_JSON)
                .content(shortNote))
            .andExpect(status().isUnprocessableEntity());

        // Blank author
        String blankAuthor = """
            {
                "content": "Valid content for investigation note",
                "author": "   "
            }
        """;
        mockMvc.perform(post("/api/v1/incidents/" + incId + "/notes")
                .contentType(MediaType.APPLICATION_JSON)
                .content(blankAuthor))
            .andExpect(status().isUnprocessableEntity());

        // Note on non-existent incident
        mockMvc.perform(post("/api/v1/incidents/INC-NONEXIST/notes")
                .contentType(MediaType.APPLICATION_JSON)
                .content(notePayload))
            .andExpect(status().isNotFound());
    }

    @Test
    void linkAlertsToExistingIncident() throws Exception {
        insertSampleAlert("alert-010", "Brute-force alert 1", "high");
        insertSampleAlert("alert-020", "Brute-force alert 2", "high");

        String createPayload = """
            {
                "title": "Multi-host Incident Case",
                "description": "Initial anomaly investigation before linking alerts.",
                "severity": "medium",
                "status": "open"
            }
        """;
        MvcResult createResult = mockMvc.perform(post("/api/v1/incidents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(createPayload))
            .andExpect(status().isCreated())
            .andReturn();

        String incId = objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText();

        // Link valid alerts
        String linkPayload = """
            {
                "alert_ids": ["alert-010", "alert-020"]
            }
        """;
        mockMvc.perform(post("/api/v1/incidents/" + incId + "/alerts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(linkPayload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.alert_ids", hasSize(2)))
            .andExpect(jsonPath("$.timeline", hasSize(2))); // Created + Alerts Linked

        // Linking non-existent alert returns 422
        String badLinkPayload = """
            {
                "alert_ids": ["does-not-exist"]
            }
        """;
        mockMvc.perform(post("/api/v1/incidents/" + incId + "/alerts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(badLinkPayload))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.detail", containsString("does-not-exist")));
    }

    @Test
    void listIncidentsFilteringAndPagination() throws Exception {
        // Create 3 incidents
        mockMvc.perform(post("/api/v1/incidents").contentType(MediaType.APPLICATION_JSON).content("""
            {
                "title": "Alpha Incident Critical",
                "description": "Investigation into severe authentication wave",
                "severity": "critical",
                "status": "open",
                "assignee": "Analyst One"
            }
        """)).andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/incidents").contentType(MediaType.APPLICATION_JSON).content("""
            {
                "title": "Beta Incident High",
                "description": "Investigation into repeated spray attempts",
                "severity": "high",
                "status": "investigating",
                "assignee": "Analyst Two"
            }
        """)).andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/incidents").contentType(MediaType.APPLICATION_JSON).content("""
            {
                "title": "Gamma Incident Low",
                "description": "Operational automation test script anomaly",
                "severity": "low",
                "status": "closed",
                "assignee": "Analyst One"
            }
        """)).andExpect(status().isCreated());

        // Total count
        mockMvc.perform(get("/api/v1/incidents"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "3"))
            .andExpect(jsonPath("$", hasSize(3)));

        // Filter by status=open
        mockMvc.perform(get("/api/v1/incidents?status=open"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "1"))
            .andExpect(jsonPath("$[0].title", is("Alpha Incident Critical")));

        // Filter by severity=high
        mockMvc.perform(get("/api/v1/incidents?severity=high"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "1"))
            .andExpect(jsonPath("$[0].title", is("Beta Incident High")));

        // Search by assignee
        mockMvc.perform(get("/api/v1/incidents?search=Analyst One"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "2"))
            .andExpect(jsonPath("$", hasSize(2)));

        // Search by keyword in title/desc
        mockMvc.perform(get("/api/v1/incidents?search=spray"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "1"))
            .andExpect(jsonPath("$[0].title", is("Beta Incident High")));

        // Pagination
        mockMvc.perform(get("/api/v1/incidents?limit=2&offset=0"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "3"))
            .andExpect(jsonPath("$", hasSize(2)));

        mockMvc.perform(get("/api/v1/incidents?limit=2&offset=2"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "3"))
            .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void corsHeadersPresentForViteOrigin() throws Exception {
        mockMvc.perform(get("/api/v1/incidents")
                .header("Origin", "http://localhost:5173"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
            .andExpect(header().string("Access-Control-Expose-Headers", containsString("X-Total-Count")));

        mockMvc.perform(get("/api/v1/incidents")
                .header("Origin", "http://127.0.0.1:5173"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Origin", "http://127.0.0.1:5173"));
    }
}
