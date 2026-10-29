package com.edusec.backend.detectors;

import com.edusec.backend.model.AlertSeverity;
import com.edusec.backend.model.DetectionResult;
import com.edusec.backend.model.SecurityEvent;

import java.util.List;

/**
 * Interface for independent, explainable detection rules.
 */
public interface DetectionRule {
    String getRuleId();
    String getName();
    String getDescription();
    AlertSeverity getSeverity();
    List<DetectionResult> evaluate(List<SecurityEvent> events);
}
