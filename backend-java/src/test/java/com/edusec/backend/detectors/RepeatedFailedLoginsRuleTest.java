package com.edusec.backend.detectors;

import com.edusec.backend.model.AlertSeverity;
import com.edusec.backend.model.DetectionResult;
import com.edusec.backend.model.EventOutcome;
import com.edusec.backend.model.SecurityEvent;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RepeatedFailedLoginsRuleTest {

    private SecurityEvent makeEvent(String eventType, String timestampIso, String sourceIp, String username, EventOutcome outcome) {
        return new SecurityEvent(
            java.util.UUID.randomUUID().toString(),
            eventType,
            Instant.parse(timestampIso),
            sourceIp,
            username,
            outcome,
            "srv-01",
            Collections.emptyMap(),
            Instant.now()
        );
    }

    @Test
    void fourFailedAttemptsDoNotTriggerRule() {
        RepeatedFailedLoginsRule rule = new RepeatedFailedLoginsRule(5, 300);
        List<SecurityEvent> events = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            events.add(makeEvent("authentication", String.format("2026-10-15T10:0%d:00Z", i), "192.168.1.100", "admin", EventOutcome.FAILURE));
        }

        List<DetectionResult> results = rule.evaluate(events);
        assertTrue(results.isEmpty());
    }

    @Test
    void fiveFailedAttemptsWithinWindowTriggerRule() {
        RepeatedFailedLoginsRule rule = new RepeatedFailedLoginsRule(5, 300);
        List<SecurityEvent> events = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            events.add(makeEvent("authentication", String.format("2026-10-15T10:0%d:00Z", i), "192.168.1.100", "admin", EventOutcome.FAILURE));
        }

        List<DetectionResult> results = rule.evaluate(events);
        assertEquals(1, results.size());

        DetectionResult match = results.get(0);
        assertEquals("NG-AUTH-001", match.ruleId());
        assertEquals(AlertSeverity.HIGH, match.severity());
        assertEquals(5, match.relatedEventIds().size());

        Map<String, Object> evidence = match.evidence();
        assertEquals("192.168.1.100", evidence.get("source_ip"));
        assertEquals(5, evidence.get("failed_attempts_count"));
        assertEquals(5, evidence.get("threshold"));
        assertEquals(300, evidence.get("window_seconds"));
        assertNotNull(match.fingerprint());
    }

    @Test
    void fiveAttemptsSpreadOutsideWindowDoNotTrigger() {
        RepeatedFailedLoginsRule rule = new RepeatedFailedLoginsRule(5, 300);
        List<SecurityEvent> events = new ArrayList<>();
        // Spaced 6 minutes apart (360 seconds > 300 seconds window)
        for (int i = 0; i < 5; i++) {
            events.add(makeEvent("authentication", String.format("2026-10-15T10:%02d:00Z", i * 6), "192.168.1.100", "admin", EventOutcome.FAILURE));
        }

        List<DetectionResult> results = rule.evaluate(events);
        assertTrue(results.isEmpty());
    }

    @Test
    void eventsFromDifferentIpsAreNotCombined() {
        RepeatedFailedLoginsRule rule = new RepeatedFailedLoginsRule(5, 300);
        List<SecurityEvent> events = List.of(
            makeEvent("authentication", "2026-10-15T10:00:10Z", "10.0.0.1", "user1", EventOutcome.FAILURE),
            makeEvent("authentication", "2026-10-15T10:00:20Z", "10.0.0.2", "user2", EventOutcome.FAILURE),
            makeEvent("authentication", "2026-10-15T10:00:30Z", "10.0.0.1", "user1", EventOutcome.FAILURE),
            makeEvent("authentication", "2026-10-15T10:00:40Z", "10.0.0.2", "user2", EventOutcome.FAILURE),
            makeEvent("authentication", "2026-10-15T10:00:50Z", "10.0.0.1", "user1", EventOutcome.FAILURE),
            makeEvent("authentication", "2026-10-15T10:01:00Z", "10.0.0.2", "user2", EventOutcome.FAILURE)
        );

        List<DetectionResult> results = rule.evaluate(events);
        assertTrue(results.isEmpty());
    }

    @Test
    void nonAuthenticationEventsAreIgnored() {
        RepeatedFailedLoginsRule rule = new RepeatedFailedLoginsRule(5, 300);
        List<SecurityEvent> events = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            events.add(makeEvent("network_flow", String.format("2026-10-15T10:0%d:00Z", i), "192.168.1.100", "admin", EventOutcome.FAILURE));
        }

        List<DetectionResult> results = rule.evaluate(events);
        assertTrue(results.isEmpty());
    }

    @Test
    void successfulLoginsAreIgnored() {
        RepeatedFailedLoginsRule rule = new RepeatedFailedLoginsRule(5, 300);
        List<SecurityEvent> events = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            events.add(makeEvent("authentication", String.format("2026-10-15T10:0%d:00Z", i), "192.168.1.100", "admin", EventOutcome.SUCCESS));
        }

        List<DetectionResult> results = rule.evaluate(events);
        assertTrue(results.isEmpty());
    }

    @Test
    void missingSourceIpDoesNotCrashOrTrigger() {
        RepeatedFailedLoginsRule rule = new RepeatedFailedLoginsRule(5, 300);
        List<SecurityEvent> events = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            events.add(makeEvent("authentication", String.format("2026-10-15T10:0%d:00Z", i), null, "admin", EventOutcome.FAILURE));
        }

        List<DetectionResult> results = rule.evaluate(events);
        assertTrue(results.isEmpty());
    }

    @Test
    void emptyEventsListReturnsEmpty() {
        RepeatedFailedLoginsRule rule = new RepeatedFailedLoginsRule(5, 300);
        assertTrue(rule.evaluate(Collections.emptyList()).isEmpty());
        assertTrue(rule.evaluate(null).isEmpty());
    }
}
