package com.edusec.backend.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class EventControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("DELETE FROM security_events;");
    }

    @Test
    void emptyEventsListReturns200AndEmptyArray() throws Exception {
        mockMvc.perform(get("/api/v1/events"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "0"))
            .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void validEventIngestedAndStoredSuccessfully() throws Exception {
        String payload = """
            {
                "event_type": "authentication",
                "timestamp": "2026-10-15T08:30:00Z",
                "source_ip": "192.168.1.50",
                "username": "testuser",
                "outcome": "failed",
                "asset_id": "lab-linux-01",
                "metadata": {
                    "source": "synthetic",
                    "message": "Simulated failed login"
                }
            }
        """;

        mockMvc.perform(post("/api/v1/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id", notNullValue()))
            .andExpect(jsonPath("$.event_type", is("authentication")))
            .andExpect(jsonPath("$.source_ip", is("192.168.1.50")))
            .andExpect(jsonPath("$.username", is("testuser")))
            .andExpect(jsonPath("$.outcome", is("failure"))) // normalized from "failed"
            .andExpect(jsonPath("$.asset_id", is("lab-linux-01")))
            .andExpect(jsonPath("$.metadata.source", is("synthetic")))
            .andExpect(jsonPath("$.metadata.message", is("Simulated failed login")))
            .andExpect(jsonPath("$.created_at", notNullValue()));
    }

    @Test
    void extraTopLevelFieldsPreservedInMetadata() throws Exception {
        String payload = """
            {
                "event_type": "network_flow",
                "timestamp": "2026-10-15T08:35:00Z",
                "source_ip": "10.0.0.15",
                "outcome": "success",
                "port": 443,
                "protocol": "tcp"
            }
        """;

        mockMvc.perform(post("/api/v1/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.metadata.port", is(443)))
            .andExpect(jsonPath("$.metadata.protocol", is("tcp")));
    }

    @Test
    void storedEventCanBeRetrievedViaListAndDetail() throws Exception {
        String payload = """
            {
                "event_type": "privilege_escalation",
                "timestamp": "2026-10-15T08:35:00Z",
                "source_ip": "10.0.0.15",
                "username": "root",
                "outcome": "success",
                "asset_id": "dc-server-01",
                "metadata": {"method": "sudo", "command": "/bin/su"}
            }
        """;

        String postResponse = mockMvc.perform(post("/api/v1/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();

        // Extract ID
        String eventId = postResponse.split("\"id\":\"")[1].split("\"")[0];

        // 1. Retrieve via list
        mockMvc.perform(get("/api/v1/events"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "1"))
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id", is(eventId)))
            .andExpect(jsonPath("$[0].event_type", is("privilege_escalation")))
            .andExpect(jsonPath("$[0].metadata.method", is("sudo")));

        // 2. Retrieve via detail
        mockMvc.perform(get("/api/v1/events/" + eventId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id", is(eventId)))
            .andExpect(jsonPath("$.username", is("root")))
            .andExpect(jsonPath("$.outcome", is("success")));
    }

    @Test
    void missingRequiredFieldsAreRejectedWith422() throws Exception {
        // Missing event_type
        mockMvc.perform(post("/api/v1/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"timestamp\": \"2026-10-15T08:30:00Z\", \"outcome\": \"success\"}"))
            .andExpect(status().isUnprocessableEntity());

        // Missing timestamp
        mockMvc.perform(post("/api/v1/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"event_type\": \"auth_login\", \"outcome\": \"success\"}"))
            .andExpect(status().isUnprocessableEntity());

        // Missing outcome
        mockMvc.perform(post("/api/v1/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"event_type\": \"auth_login\", \"timestamp\": \"2026-10-15T08:30:00Z\"}"))
            .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void invalidIpAddressesAreRejectedWith422() throws Exception {
        String[] invalidIps = {"999.999.999.999", "192.168.1.300", "not-an-ip", ""};
        for (String ip : invalidIps) {
            String payload = String.format("""
                {
                    "event_type": "network_connection",
                    "timestamp": "2026-10-15T08:30:00Z",
                    "source_ip": "%s",
                    "outcome": "failure"
                }
            """, ip);

            mockMvc.perform(post("/api/v1/events")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(payload))
                .andExpect(status().isUnprocessableEntity());
        }
    }

    @Test
    void malformedTimestampIsRejectedWith422() throws Exception {
        String[] malformedTimestamps = {"not-a-timestamp", "2026-99-99T99:99:99", "tomorrow"};
        for (String ts : malformedTimestamps) {
            String payload = String.format("""
                {
                    "event_type": "auth_login",
                    "timestamp": "%s",
                    "outcome": "failure"
                }
            """, ts);

            mockMvc.perform(post("/api/v1/events")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(payload))
                .andExpect(status().isUnprocessableEntity());
        }
    }

    @Test
    void invalidOutcomeIsRejectedWith422() throws Exception {
        String payload = """
            {
                "event_type": "auth_login",
                "timestamp": "2026-10-15T08:30:00Z",
                "outcome": "unknown_status"
            }
        """;

        mockMvc.perform(post("/api/v1/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void optionalFieldsCanBeOmitted() throws Exception {
        String payload = """
            {
                "event_type": "system_heartbeat",
                "timestamp": "2026-10-15T08:40:00Z",
                "outcome": "success"
            }
        """;

        mockMvc.perform(post("/api/v1/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id", notNullValue()))
            .andExpect(jsonPath("$.source_ip").doesNotExist())
            .andExpect(jsonPath("$.username").doesNotExist())
            .andExpect(jsonPath("$.asset_id").doesNotExist())
            .andExpect(jsonPath("$.metadata", notNullValue()))
            .andExpect(jsonPath("$.created_at", notNullValue()));
    }

    @Test
    void paginationWorksCorrectly() throws Exception {
        // Insert 5 events in sequence
        for (int i = 1; i <= 5; i++) {
            String payload = String.format("""
                {
                    "event_type": "seq_test",
                    "timestamp": "2026-10-15T09:0%d:00Z",
                    "username": "user_%d",
                    "outcome": "success"
                }
            """, i, i);

            mockMvc.perform(post("/api/v1/events")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(payload))
                .andExpect(status().isCreated());
        }

        // Page 1: limit 2, offset 0 -> user_5, user_4 (newest first)
        mockMvc.perform(get("/api/v1/events?limit=2&offset=0"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Total-Count", "5"))
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].username", is("user_5")))
            .andExpect(jsonPath("$[1].username", is("user_4")));

        // Page 2: limit 2, offset 2 -> user_3, user_2
        mockMvc.perform(get("/api/v1/events?limit=2&offset=2"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].username", is("user_3")))
            .andExpect(jsonPath("$[1].username", is("user_2")));

        // Page 3: limit 2, offset 4 -> user_1
        mockMvc.perform(get("/api/v1/events?limit=2&offset=4"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].username", is("user_1")));

        // Page beyond: limit 2, offset 10 -> empty array []
        mockMvc.perform(get("/api/v1/events?limit=2&offset=10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(0)));

        // Invalid pagination bounds -> 422
        mockMvc.perform(get("/api/v1/events?limit=0")).andExpect(status().isUnprocessableEntity());
        mockMvc.perform(get("/api/v1/events?limit=101")).andExpect(status().isUnprocessableEntity());
        mockMvc.perform(get("/api/v1/events?offset=-1")).andExpect(status().isUnprocessableEntity());
    }

    @Test
    void getNonExistentEventReturns404() throws Exception {
        mockMvc.perform(get("/api/v1/events/non-existent-event-12345"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.detail", is("Security event 'non-existent-event-12345' not found")));
    }
}
