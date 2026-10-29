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
 * Rule NG-AUTH-002: Successful Login After Repeated Failures.
 * Detects when an authentication success is preceded by at least N authentication failures
 * from the exact same source IP within a rolling time window.
 */
@Component
public class LoginAfterFailuresRule implements DetectionRule {

    public static final String RULE_ID = "NG-AUTH-002";
    public static final String NAME = "Successful Login After Repeated Failures";
    public static final String DESCRIPTION = (
        "Detects a successful authentication event following multiple failed attempts from the same source IP " +
        "within the preceding time window. May indicate an attacker successfully guessed or cracked credentials. " +
        "Note: Legitimate user password mistypes, mobile network handoffs, and corporate NAT proxies can also " +
        "trigger benign matches."
    );
    public static final AlertSeverity SEVERITY = AlertSeverity.HIGH;

    private final int threshold;
    private final int windowSeconds;

    public LoginAfterFailuresRule() {
        this(5, 300);
    }

    public LoginAfterFailuresRule(int threshold, int windowSeconds) {
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

        // 1. Group authentication events by source IP
        Map<String, List<SecurityEvent>> authEventsByIp = new LinkedHashMap<>();
        for (SecurityEvent event : events) {
            String eventType = event.eventType();
            if (eventType == null) {
                continue;
            }
            String typeLower = eventType.toLowerCase();
            if (!typeLower.equals("authentication") && !typeLower.equals("auth_login")) {
                continue;
            }
            String sourceIp = event.sourceIp();
            if (sourceIp == null || sourceIp.trim().isEmpty()) {
                continue;
            }
            if (event.outcome() != EventOutcome.SUCCESS && event.outcome() != EventOutcome.FAILURE) {
                continue;
            }

            authEventsByIp.computeIfAbsent(sourceIp.trim(), k -> new ArrayList<>()).add(event);
        }

        // 2. For each source IP, sort chronologically and find successes preceded by failures
        for (Map.Entry<String, List<SecurityEvent>> entry : authEventsByIp.entrySet()) {
            String sourceIp = entry.getKey();
            List<SecurityEvent> sortedEvents = new ArrayList<>(entry.getValue());
            sortedEvents.sort(Comparator.comparing(SecurityEvent::timestamp));

            for (int idx = 0; idx < sortedEvents.size(); idx++) {
                SecurityEvent event = sortedEvents.get(idx);
                if (event.outcome() != EventOutcome.SUCCESS) {
                    continue;
                }

                Instant successTime = event.timestamp();
                Instant windowStart = successTime.minusSeconds(windowSeconds);

                // Find preceding failures in [windowStart, successTime]
                List<SecurityEvent> precedingFailures = new ArrayList<>();
                for (int priorIdx = 0; priorIdx < idx; priorIdx++) {
                    SecurityEvent prior = sortedEvents.get(priorIdx);
                    if (prior.outcome() == EventOutcome.FAILURE
                            && !prior.timestamp().isBefore(windowStart)
                            && !prior.timestamp().isAfter(successTime)) {
                        precedingFailures.add(prior);
                    }
                }

                if (precedingFailures.size() >= threshold) {
                    List<String> failedIds = precedingFailures.stream().map(SecurityEvent::id).toList();
                    List<String> relatedIds = new ArrayList<>();
                    relatedIds.add(event.id());
                    relatedIds.addAll(failedIds);

                    String fingerprint = FingerprintUtil.computeEvidenceFingerprint(RULE_ID, relatedIds);
                    List<String> failedUsernames = precedingFailures.stream()
                        .map(SecurityEvent::username)
                        .filter(Objects::nonNull)
                        .filter(u -> !u.trim().isEmpty())
                        .distinct()
                        .sorted()
                        .toList();

                    Map<String, Object> evidence = new LinkedHashMap<>();
                    evidence.put("rule_id", RULE_ID);
                    evidence.put("source_ip", sourceIp);
                    evidence.put("successful_event_id", event.id());
                    evidence.put("successful_timestamp", DateTimeUtil.toUtcIsoString(successTime));
                    evidence.put("successful_username", event.username());
                    evidence.put("preceding_failed_count", precedingFailures.size());
                    evidence.put("threshold", threshold);
                    evidence.put("window_seconds", windowSeconds);
                    evidence.put("window_start", DateTimeUtil.toUtcIsoString(windowStart));
                    evidence.put("window_end", DateTimeUtil.toUtcIsoString(successTime));
                    evidence.put("preceding_failed_event_ids", failedIds);
                    evidence.put("targeted_failed_usernames", failedUsernames);

                    String title = String.format(
                        "Potential Compromise: Successful login after %d failures from %s",
                        precedingFailures.size(), sourceIp
                    );
                    String description = String.format(
                        "Observed a successful authentication for '%s' from IP %s immediately following %d failed login attempts within the preceding %d seconds.",
                        event.username() != null ? event.username() : "unknown",
                        sourceIp,
                        precedingFailures.size(),
                        windowSeconds
                    );

                    results.add(new DetectionResult(
                        RULE_ID,
                        NAME,
                        title,
                        description,
                        SEVERITY,
                        relatedIds,
                        evidence,
                        fingerprint
                    ));
                }
            }
        }

        return results;
    }
}
