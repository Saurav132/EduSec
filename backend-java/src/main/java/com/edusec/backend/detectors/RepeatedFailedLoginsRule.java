package com.edusec.backend.detectors;

import com.edusec.backend.model.AlertSeverity;
import com.edusec.backend.model.DetectionResult;
import com.edusec.backend.model.EventOutcome;
import com.edusec.backend.model.SecurityEvent;
import com.edusec.backend.util.DateTimeUtil;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Rule NG-AUTH-001: Repeated Failed Login Attempts.
 * Detects at least N failed authentication events from the same source IP within a rolling time window.
 */
@Component
public class RepeatedFailedLoginsRule implements DetectionRule {

    public static final String RULE_ID = "NG-AUTH-001";
    public static final String NAME = "Repeated Failed Login Attempts";
    public static final String DESCRIPTION = (
        "Detects suspicious brute-force or credential-stuffing behavior indicated by " +
        "multiple consecutive failed authentication attempts originating from the same source IP."
    );
    public static final AlertSeverity SEVERITY = AlertSeverity.HIGH;

    private final int threshold;
    private final int windowSeconds;

    public RepeatedFailedLoginsRule() {
        this(5, 300);
    }

    public RepeatedFailedLoginsRule(int threshold, int windowSeconds) {
        this.threshold = threshold;
        this.windowSeconds = windowSeconds;
    }

    @Override
    public String getRuleId() {
        return RULE_ID;
    }

    @Override
    public String getName() {
        return NAME;
    }

    @Override
    public String getDescription() {
        return DESCRIPTION;
    }

    @Override
    public AlertSeverity getSeverity() {
        return SEVERITY;
    }

    public int getThreshold() {
        return threshold;
    }

    public int getWindowSeconds() {
        return windowSeconds;
    }

    @Override
    public List<DetectionResult> evaluate(List<SecurityEvent> events) {
        List<DetectionResult> results = new ArrayList<>();
        if (events == null || events.isEmpty()) {
            return results;
        }

        // 1. Group qualifying authentication failures by source IP
        Map<String, List<SecurityEvent>> authFailuresByIp = new LinkedHashMap<>();
        for (SecurityEvent event : events) {
            String eventType = event.eventType();
            if (eventType == null) {
                continue;
            }
            String typeLower = eventType.toLowerCase();
            if (!typeLower.equals("authentication") && !typeLower.equals("auth_login")) {
                continue;
            }
            if (event.outcome() != EventOutcome.FAILURE) {
                continue;
            }
            String sourceIp = event.sourceIp();
            if (sourceIp == null || sourceIp.trim().isEmpty()) {
                continue;
            }

            authFailuresByIp.computeIfAbsent(sourceIp.trim(), k -> new ArrayList<>()).add(event);
        }

        // 2. Evaluate rolling window for each source IP
        for (Map.Entry<String, List<SecurityEvent>> entry : authFailuresByIp.entrySet()) {
            String sourceIp = entry.getKey();
            List<SecurityEvent> sortedEvents = new ArrayList<>(entry.getValue());
            sortedEvents.sort(Comparator.comparing(SecurityEvent::timestamp));

            int i = 0;
            int n = sortedEvents.size();
            while (i < n) {
                Instant windowStart = sortedEvents.get(i).timestamp();
                Instant windowEndCutoff = windowStart.plusSeconds(windowSeconds);

                List<SecurityEvent> windowEvents = new ArrayList<>();
                for (int j = i; j < n; j++) {
                    SecurityEvent candidate = sortedEvents.get(j);
                    if (!candidate.timestamp().isAfter(windowEndCutoff)) {
                        windowEvents.add(candidate);
                    } else {
                        break;
                    }
                }

                if (windowEvents.size() >= threshold) {
                    List<String> eventIds = windowEvents.stream().map(SecurityEvent::id).toList();
                    String fingerprint = FingerprintUtil.computeEvidenceFingerprint(RULE_ID, eventIds);
                    List<String> targetedUsernames = windowEvents.stream()
                        .map(SecurityEvent::username)
                        .filter(Objects::nonNull)
                        .filter(u -> !u.trim().isEmpty())
                        .distinct()
                        .sorted()
                        .toList();

                    Map<String, Object> evidence = new LinkedHashMap<>();
                    evidence.put("rule_id", RULE_ID);
                    evidence.put("source_ip", sourceIp);
                    evidence.put("failed_attempts_count", windowEvents.size());
                    evidence.put("threshold", threshold);
                    evidence.put("window_seconds", windowSeconds);
                    evidence.put("window_start", DateTimeUtil.toUtcIsoString(windowStart));
                    evidence.put("window_end", DateTimeUtil.toUtcIsoString(windowEvents.get(windowEvents.size() - 1).timestamp()));
                    evidence.put("targeted_usernames", targetedUsernames);
                    evidence.put("supporting_event_ids", eventIds);

                    String title = String.format("Brute-Force Alert: %d failed logins from %s", windowEvents.size(), sourceIp);
                    String description = String.format(
                        "Observed %d failed authentication attempts from IP %s within %d seconds (threshold: %d).",
                        windowEvents.size(), sourceIp, windowSeconds, threshold
                    );

                    results.add(new DetectionResult(
                        RULE_ID,
                        NAME,
                        title,
                        description,
                        SEVERITY,
                        eventIds,
                        evidence,
                        fingerprint
                    ));

                    // Advance past the window to avoid redundant overlapping alerts for the same burst
                    i += windowEvents.size();
                } else {
                    i += 1;
                }
            }
        }

        return results;
    }
}
