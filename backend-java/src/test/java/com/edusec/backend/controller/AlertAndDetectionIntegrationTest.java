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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AlertAndDetectionIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("DELETE FROM alerts;");
        jdbcTemplate.execute("DELETE FROM security_events;");
    }

    private void ingestEvent(String eventType, String timestamp, String sourceIp, String username, String outcome) throws Exception {
        String payload = String.format("""
            {
                "event_type": "%s",
                "timestamp": "%s",
                "source_ip": "%s",
                "username": "%s",
                "outcome": "%s"
            }
        """, eventType, timestamp, sourceIp, username, outcome);

        mockMvc.perform(post("/api/v1/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isCreated());
    }

    @Test
    void runDetectionOnEmptyDatabaseReturnsZero() throws Exception {
        mockMvc.perform(post("/api/v1/detections/run"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.events_evaluated", is(0)))
            .andExpect(jsonPath("$.alerts_created", is(0)))
            .andExpect(jsonPath("$.alerts_existing", is(0)))
            .andExpect(jsonPath("$.new_alerts", hasSize(0)));
    }

    @Test
    void fiveFailuresGenerateNgAuth001AlertWithEvidence() throws Exception {
        for (int i = 0; i < 5; i++) {
            ingestEvent("authentication", String.format("2026-10-15T11:0%d:00Z", i), "198.51.100.25", "user_" + i, "failed");
        }

        mockMvc.perform(post("/api/v1/detections/run"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.events_evaluated", is(5)))
            .andExpect(jsonPath("$.alerts_created", is(1)))
            .andExpect(jsonPath("$.alerts_existing", is(0)))
            .andExpect(jsonPath("$.new_alerts", hasSize(1)))
            .andExpect(jsonPath("$.new_alerts[0].rule_id", is("NG-AUTH-001")))
            .andExpect(jsonPath("$.new_alerts[0].severity", is("high")))
            .andExpect(jsonPath("$.new_alerts[0].related_event_ids", hasSize(5)))
            .andExpect(jsonPath("$.new_alerts[0].evidence.source_ip", is("198.51.100.25")))
            .andExpect(jsonPath("$.new_alerts[0].fingerprint", notNullValue()));
    }

    @Test
    void repeatedDetectionRunsDeduplicateAlerts() throws Exception {
        for (int i = 0; i < 5; i++) {
            ingestEvent("authentication", String.format("2026-10-15T12:0%d:00Z", i), "198.51.100.50", "admin", "failed");
        }

        // Run 1: Alert created
        mockMvc.perform(post("/api/v1/detections/run"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.alerts_created", is(1)))
            .andExpect(jsonPath("$.alerts_existing", is(0)))
            .andExpect(jsonPath("$.new_alerts", hasSize(1)));

        // Run 2: Duplicate detected and suppressed
        mockMvc.perform(post("/api/v1/detections/run"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.alerts_created", is(0)))
            .andExpect(jsonPath("$.alerts_existing", is(1)))
            .andExpect(jsonPath("$.new_alerts", hasSize(0)));

        // Verify database still holds exactly 1 alert
        mockMvc.perform(get("/api/v1/alerts"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "1"))
            .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void distinctEvidenceSetsCreateDistinctAlerts() throws Exception {
        // 5 failures from IP 1
        for (int i = 0; i < 5; i++) {
            ingestEvent("authentication", String.format("2026-10-15T13:0%d:00Z", i), "203.0.113.1", "admin", "failed");
        }
        // 5 failures from IP 2
        for (int i = 0; i < 5; i++) {
            ingestEvent("authentication", String.format("2026-10-15T13:0%d:00Z", i), "203.0.113.2", "admin", "failed");
        }

        mockMvc.perform(post("/api/v1/detections/run"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.alerts_created", is(2)));

        mockMvc.perform(get("/api/v1/alerts"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "2"))
            .andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void alertListingFilteringAndDetailEndpoints() throws Exception {
        // Ingest 5 failures + 1 success from same IP to trigger NG-AUTH-001 and NG-AUTH-002
        for (int i = 0; i < 5; i++) {
            ingestEvent("authentication", String.format("2026-10-15T14:0%d:00Z", i), "198.51.100.99", "admin", "failed");
        }
        ingestEvent("authentication", "2026-10-15T14:04:45Z", "198.51.100.99", "admin", "success");

        mockMvc.perform(post("/api/v1/detections/run"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.alerts_created", is(2)));

        // 1. List all alerts
        MvcResult listResult = mockMvc.perform(get("/api/v1/alerts"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "2"))
            .andExpect(jsonPath("$", hasSize(2)))
            .andReturn();

        JsonNode alertsNode = objectMapper.readTree(listResult.getResponse().getContentAsString());
        String firstAlertId = alertsNode.get(0).get("id").asText();

        // 2. Lookup alert by ID
        mockMvc.perform(get("/api/v1/alerts/" + firstAlertId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id", is(firstAlertId)))
            .andExpect(jsonPath("$.evidence", notNullValue()))
            .andExpect(jsonPath("$.related_event_ids", notNullValue()));

        // 3. Filter by rule_id
        mockMvc.perform(get("/api/v1/alerts?rule_id=NG-AUTH-001"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "1"))
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].rule_id", is("NG-AUTH-001")));

        mockMvc.perform(get("/api/v1/alerts?rule_id=NG-AUTH-002"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "1"))
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].rule_id", is("NG-AUTH-002")));

        // 4. Filter by severity
        mockMvc.perform(get("/api/v1/alerts?severity=high"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "2"))
            .andExpect(jsonPath("$", hasSize(2)));

        mockMvc.perform(get("/api/v1/alerts?severity=low"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "0"))
            .andExpect(jsonPath("$", hasSize(0)));

        // 5. Pagination
        mockMvc.perform(get("/api/v1/alerts?limit=1&offset=0"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "2"))
            .andExpect(jsonPath("$", hasSize(1)));

        mockMvc.perform(get("/api/v1/alerts?limit=1&offset=1"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "2"))
            .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void unknownAlertIdReturns404() throws Exception {
        mockMvc.perform(get("/api/v1/alerts/nonexistent-uuid-12345"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.detail", containsString("not found")));
    }

    @Test
    void invalidFilterValuesReturn422() throws Exception {
        mockMvc.perform(get("/api/v1/alerts?severity=super_critical"))
            .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(get("/api/v1/alerts?status=invalid_status"))
            .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(get("/api/v1/alerts?limit=0"))
            .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(get("/api/v1/alerts?limit=150"))
            .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(get("/api/v1/alerts?offset=-1"))
            .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(post("/api/v1/detections/run?lookback_minutes=0"))
            .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(post("/api/v1/detections/run?lookback_minutes=2000"))
            .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void validLookbackMinutesAccepted() throws Exception {
        mockMvc.perform(post("/api/v1/detections/run?lookback_minutes=60"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.events_evaluated", is(0)));
    }
}
