package com.edusec.backend.service;

import com.edusec.backend.model.Alert;
import com.edusec.backend.storage.AlertRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "edusec.detection.auto-enabled=true",
    "edusec.detection.auto-interval-ms=100",
    "edusec.detection.auto-initial-delay-ms=50"
})
class AutomaticDetectionIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private DetectionService detectionService;

    @Autowired
    private SecurityEventService securityEventService;

    @Autowired
    private AlertRepository alertRepository;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("DELETE FROM alerts;");
        jdbcTemplate.execute("DELETE FROM security_events;");
        detectionService.setAutoEnabled(true);
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
    void testAutomaticDetectionTriggersAfterEventIngestion() throws Exception {
        long initialAlertCount = alertRepository.countAlerts(null, null, null);
        assertEquals(0, initialAlertCount);

        // Ingest 5 failed authentications from same IP
        for (int i = 0; i < 5; i++) {
            ingestEvent("authentication", String.format("2026-10-21T10:0%d:00Z", i), "198.51.100.11", "admin", "failed");
        }

        // Wait for scheduled detection to trigger and process automatically
        boolean detected = false;
        long deadline = System.currentTimeMillis() + 3000;
        while (System.currentTimeMillis() < deadline) {
            if (alertRepository.countAlerts(null, null, null) > 0) {
                detected = true;
                break;
            }
            Thread.sleep(50);
        }

        assertTrue(detected, "Automatic detection should generate an alert within scheduled window");
        List<Alert> alerts = alertRepository.findAlerts(null, null, null, 10, 0);
        assertEquals(1, alerts.size());
        assertEquals("NG-AUTH-001", alerts.get(0).ruleId());
        assertEquals("198.51.100.11", alerts.get(0).evidence().get("source_ip"));
    }

    @Test
    void testDisabledModePreventsScheduledDetectionButPermitsManual() throws Exception {
        detectionService.setAutoEnabled(false);
        assertFalse(detectionService.isAutoEnabled());

        for (int i = 0; i < 5; i++) {
            ingestEvent("authentication", String.format("2026-10-21T10:0%d:00Z", i), "198.51.100.22", "admin", "failed");
        }

        // Invoke scheduled method directly — should immediately return due to auto-enabled=false
        detectionService.runScheduledDetection();
        assertEquals(0, alertRepository.countAlerts(null, null, null), "No alerts should be generated when auto-enabled is false");

        // Verify manual detection endpoint still executes normally
        mockMvc.perform(post("/api/v1/detections/run"))
            .andExpect(status().isOk());

        assertEquals(1, alertRepository.countAlerts(null, null, null), "Manual detection should work even when auto detection is disabled");
    }

    @Test
    void testRepeatedScheduledRunsDeduplicateAlerts() throws Exception {
        for (int i = 0; i < 5; i++) {
            ingestEvent("authentication", String.format("2026-10-21T10:0%d:00Z", i), "198.51.100.33", "admin", "failed");
        }

        // First execution creates the alert
        detectionService.runScheduledDetection();
        assertEquals(1, alertRepository.countAlerts(null, null, null));

        // Subsequent executions over the same data must not create duplicate alerts
        detectionService.runScheduledDetection();
        detectionService.runScheduledDetection();

        assertEquals(1, alertRepository.countAlerts(null, null, null), "Duplicate alerts must be suppressed");
    }

    @Test
    void testManualAndScheduledConcurrencyHandledCleanly() throws Exception {
        for (int i = 0; i < 5; i++) {
            ingestEvent("authentication", String.format("2026-10-21T10:0%d:00Z", i), "198.51.100.44", "admin", "failed");
        }

        int threadCount = 8;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch finishLatch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            final boolean isManual = (i % 2 == 0);
            executor.submit(() -> {
                try {
                    startLatch.await();
                    if (isManual) {
                        detectionService.runDetectionCycle(null);
                    } else {
                        detectionService.runScheduledDetection();
                    }
                    successCount.incrementAndGet();
                } catch (Exception e) {
                    // unexpected error
                } finally {
                    finishLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean completed = finishLatch.await(5, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(completed, "All concurrent detection executions should complete cleanly");
        assertEquals(threadCount, successCount.get(), "No thread should fail or deadlock");
        assertEquals(1, alertRepository.countAlerts(null, null, null), "Exactly 1 alert should exist regardless of concurrency");
    }

    @Test
    void testEventsArrivingDuringDetectionCycleAreNotLost() throws Exception {
        // Ingest 4 failed events (threshold is 5, so no alert yet)
        for (int i = 0; i < 4; i++) {
            ingestEvent("authentication", String.format("2026-10-21T10:0%d:00Z", i), "198.51.100.55", "admin", "failed");
        }

        detectionService.runScheduledDetection();
        assertEquals(0, alertRepository.countAlerts(null, null, null), "4 events must not trigger threshold of 5");

        long lastProcessedGen = detectionService.getLastProcessedGeneration();

        // Ingest 5th event (now meeting threshold)
        ingestEvent("authentication", "2026-10-21T10:04:00Z", "198.51.100.55", "admin", "failed");

        long currentGen = securityEventService.getEventIngestionGeneration();
        assertTrue(currentGen > lastProcessedGen, "New event ingestion must advance generation past last processed");

        // Next scheduled cycle runs and detects the threshold
        detectionService.runScheduledDetection();
        assertEquals(1, alertRepository.countAlerts(null, null, null), "Alert should be generated on the cycle following new event");
    }
}
