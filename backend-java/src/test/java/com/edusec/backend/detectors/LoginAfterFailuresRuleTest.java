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

class LoginAfterFailuresRuleTest {

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
    void successfulLoginAfterFiveFailuresTriggersRule() {
        LoginAfterFailuresRule rule = new LoginAfterFailuresRule(5, 300);
        List<SecurityEvent> events = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            events.add(makeEvent("authentication", String.format("2026-10-15T10:0%d:00Z", i), "192.168.1.100", "admin", EventOutcome.FAILURE));
        }
        SecurityEvent successEvent = makeEvent("authentication", "2026-10-15T10:04:30Z", "192.168.1.100", "admin", EventOutcome.SUCCESS);
        events.add(successEvent);

        List<DetectionResult> results = rule.evaluate(events);
        assertEquals(1, results.size());

        DetectionResult match = results.get(0);
        assertEquals("NG-AUTH-002", match.ruleId());
        assertEquals(AlertSeverity.HIGH, match.severity());
        assertEquals(6, match.relatedEventIds().size()); // 1 success + 5 failures
        assertEquals(successEvent.id(), match.relatedEventIds().get(0));

        Map<String, Object> evidence = match.evidence();
        assertEquals("192.168.1.100", evidence.get("source_ip"));
        assertEquals(successEvent.id(), evidence.get("successful_event_id"));
        assertEquals(5, evidence.get("preceding_failed_count"));
        assertEquals(5, evidence.get("threshold"));
        assertEquals(300, evidence.get("window_seconds"));
        assertNotNull(match.fingerprint());
    }

    @Test
    void successfulLoginWithoutQualifyingFailuresDoesNotTrigger() {
        LoginAfterFailuresRule rule = new LoginAfterFailuresRule(5, 300);
        // Only 2 preceding failures
        List<SecurityEvent> events = List.of(
            makeEvent("authentication", "2026-10-15T10:00:00Z", "192.168.1.100", "admin", EventOutcome.FAILURE),
            makeEvent("authentication", "2026-10-15T10:01:00Z", "192.168.1.100", "admin", EventOutcome.FAILURE),
            makeEvent("authentication", "2026-10-15T10:02:00Z", "192.168.1.100", "admin", EventOutcome.SUCCESS)
        );

        List<DetectionResult> results = rule.evaluate(events);
        assertTrue(results.isEmpty());
    }

    @Test
    void failuresAfterSuccessfulLoginNotCountedAsPreceding() {
        LoginAfterFailuresRule rule = new LoginAfterFailuresRule(5, 300);
        // Success first, then 5 failures afterwards
        List<SecurityEvent> events = new ArrayList<>();
        events.add(makeEvent("authentication", "2026-10-15T10:00:00Z", "192.168.1.100", "admin", EventOutcome.SUCCESS));
        for (int i = 1; i <= 5; i++) {
            events.add(makeEvent("authentication", String.format("2026-10-15T10:0%d:00Z", i), "192.168.1.100", "admin", EventOutcome.FAILURE));
        }

        List<DetectionResult> results = rule.evaluate(events);
        assertTrue(results.isEmpty());
    }

    @Test
    void failuresOutsidePrecedingWindowNotCounted() {
        LoginAfterFailuresRule rule = new LoginAfterFailuresRule(5, 300);
        // 5 failures at 09:00:00 - 09:04:00 (1 hour before success at 10:05:00)
        List<SecurityEvent> events = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            events.add(makeEvent("authentication", String.format("2026-10-15T09:0%d:00Z", i), "192.168.1.100", "admin", EventOutcome.FAILURE));
        }
        events.add(makeEvent("authentication", "2026-10-15T10:05:00Z", "192.168.1.100", "admin", EventOutcome.SUCCESS));

        List<DetectionResult> results = rule.evaluate(events);
        assertTrue(results.isEmpty());
    }

    @Test
    void differentIpsDoNotCombineForLoginAfterFailures() {
        LoginAfterFailuresRule rule = new LoginAfterFailuresRule(5, 300);
        // 5 failures from IP1, success from IP2
        List<SecurityEvent> events = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            events.add(makeEvent("authentication", String.format("2026-10-15T10:0%d:00Z", i), "10.0.0.1", "admin", EventOutcome.FAILURE));
        }
        events.add(makeEvent("authentication", "2026-10-15T10:04:30Z", "10.0.0.2", "admin", EventOutcome.SUCCESS));

        List<DetectionResult> results = rule.evaluate(events);
        assertTrue(results.isEmpty());
    }

    @Test
    void missingSourceIpDoesNotCrashOrTrigger() {
        LoginAfterFailuresRule rule = new LoginAfterFailuresRule(5, 300);
        List<SecurityEvent> events = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            events.add(makeEvent("authentication", String.format("2026-10-15T10:0%d:00Z", i), null, "admin", EventOutcome.FAILURE));
        }
        events.add(makeEvent("authentication", "2026-10-15T10:06:30Z", null, "admin", EventOutcome.SUCCESS));

        List<DetectionResult> results = rule.evaluate(events);
        assertTrue(results.isEmpty());
    }

    @Test
    void emptyEventsListReturnsEmpty() {
        LoginAfterFailuresRule rule = new LoginAfterFailuresRule(5, 300);
        assertTrue(rule.evaluate(Collections.emptyList()).isEmpty());
        assertTrue(rule.evaluate(null).isEmpty());
    }
}
