package com.edusec.backend.model;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Match result produced by an individual detection rule.
 */
public record DetectionResult(
    String ruleId,
    String ruleName,
    String title,
    String description,
    AlertSeverity severity,
    List<String> relatedEventIds,
    Map<String, Object> evidence,
    String fingerprint
) {
    public DetectionResult {
        if (relatedEventIds == null) {
            relatedEventIds = Collections.emptyList();
        } else {
            relatedEventIds = List.copyOf(relatedEventIds);
        }
        if (evidence == null) {
            evidence = Collections.emptyMap();
        } else {
            evidence = Collections.unmodifiableMap(new HashMap<>(evidence));
        }
    }
}
