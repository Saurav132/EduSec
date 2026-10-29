package com.edusec.backend.detectors;

import com.edusec.backend.model.DetectionResult;
import com.edusec.backend.model.SecurityEvent;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Coordinates and executes active rule-based detectors over security events.
 */
@Component
public class DetectionEngine {

    private final List<DetectionRule> rules;

    public DetectionEngine(List<DetectionRule> rules) {
        this.rules = rules != null ? new ArrayList<>(rules) : new ArrayList<>();
    }

    public List<DetectionRule> getRules() {
        return rules;
    }

    public List<DetectionResult> evaluateEvents(List<SecurityEvent> events) {
        List<DetectionResult> allResults = new ArrayList<>();
        for (DetectionRule rule : rules) {
            List<DetectionResult> matches = rule.evaluate(events);
            if (matches != null && !matches.isEmpty()) {
                allResults.addAll(matches);
            }
        }
        return allResults;
    }
}
