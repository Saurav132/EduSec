package com.edusec.backend.service;

import com.edusec.backend.dto.AlertResponse;
import com.edusec.backend.exception.AlertNotFoundException;
import com.edusec.backend.exception.ValidationException;
import com.edusec.backend.model.Alert;
import com.edusec.backend.model.AlertSeverity;
import com.edusec.backend.model.AlertStatus;
import com.edusec.backend.storage.AlertRepository;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service orchestrating alert retrieval, pagination, and filtering.
 */
@Service
public class AlertService {

    private final AlertRepository repository;

    public AlertService(AlertRepository repository) {
        this.repository = repository;
    }

    public AlertResponse getAlertById(String alertId) {
        if (alertId == null || alertId.trim().isEmpty()) {
            throw new AlertNotFoundException(alertId);
        }

        return repository.findById(alertId.trim())
            .map(AlertResponse::fromDomain)
            .orElseThrow(() -> new AlertNotFoundException(alertId.trim()));
    }

    public PaginatedAlerts listAlerts(String severity, String status, String ruleId, int limit, int offset) {
        if (limit < 1 || limit > 100) {
            throw new ValidationException("limit must be between 1 and 100");
        }
        if (offset < 0) {
            throw new ValidationException("offset must be greater than or equal to 0");
        }
        if (ruleId != null && ruleId.trim().length() > 50) {
            throw new ValidationException("rule_id exceeds maximum length of 50 characters");
        }

        String canonicalSeverity = null;
        if (severity != null && !severity.trim().isEmpty()) {
            try {
                canonicalSeverity = AlertSeverity.fromValue(severity).getValue();
            } catch (IllegalArgumentException e) {
                throw new ValidationException("Invalid severity: " + severity);
            }
        }

        String canonicalStatus = null;
        if (status != null && !status.trim().isEmpty()) {
            try {
                canonicalStatus = AlertStatus.fromValue(status).getValue();
            } catch (IllegalArgumentException e) {
                throw new ValidationException("Invalid status: " + status);
            }
        }

        String normalizedRuleId = (ruleId != null && !ruleId.trim().isEmpty()) ? ruleId.trim() : null;

        List<Alert> alerts = repository.findAlerts(canonicalSeverity, canonicalStatus, normalizedRuleId, limit, offset);
        long total = repository.countAlerts(canonicalSeverity, canonicalStatus, normalizedRuleId);

        List<AlertResponse> dtoList = alerts.stream()
            .map(AlertResponse::fromDomain)
            .toList();

        return new PaginatedAlerts(dtoList, total);
    }

    public record PaginatedAlerts(List<AlertResponse> alerts, long total) {}
}
