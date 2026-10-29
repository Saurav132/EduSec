package com.edusec.backend.service;

import com.edusec.backend.detectors.DetectionEngine;
import com.edusec.backend.dto.AlertResponse;
import com.edusec.backend.dto.DetectionRunSummaryResponse;
import com.edusec.backend.exception.StorageException;
import com.edusec.backend.exception.ValidationException;
import com.edusec.backend.model.Alert;
import com.edusec.backend.model.AlertStatus;
import com.edusec.backend.model.DetectionResult;
import com.edusec.backend.model.SecurityEvent;
import com.edusec.backend.storage.AlertRepository;
import com.edusec.backend.storage.SecurityEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Service orchestrating detection execution cycles, rule evaluation, and alert persistence.
 */
@Service
public class DetectionService {

    private static final Logger log = LoggerFactory.getLogger(DetectionService.class);

    private final SecurityEventRepository securityEventRepository;
    private final AlertRepository alertRepository;
    private final DetectionEngine detectionEngine;
    private final SecurityEventService securityEventService;
    private final TransactionTemplate transactionTemplate;

    private final ReentrantLock detectionLock = new ReentrantLock();
    private final AtomicLong lastProcessedGeneration = new AtomicLong(-1);

    @Value("${edusec.detection.auto-enabled:true}")
    private boolean autoEnabled;

    @Value("${edusec.detection.auto-interval-ms:5000}")
    private long autoIntervalMs;

    public DetectionService(
        SecurityEventRepository securityEventRepository,
        AlertRepository alertRepository,
        DetectionEngine detectionEngine,
        SecurityEventService securityEventService,
        PlatformTransactionManager transactionManager
    ) {
        this.securityEventRepository = securityEventRepository;
        this.alertRepository = alertRepository;
        this.detectionEngine = detectionEngine;
        this.securityEventService = securityEventService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    /**
     * Periodic scheduled automatic detection.
     * Only evaluates when new events have been ingested since the last cycle.
     * Uses non-blocking tryLock to prevent Hikari connection starvation or thread contention.
     */
    @Scheduled(
        fixedDelayString = "${edusec.detection.auto-interval-ms:5000}",
        initialDelayString = "${edusec.detection.auto-initial-delay-ms:5000}"
    )
    public void runScheduledDetection() {
        if (!autoEnabled) {
            return;
        }

        long currentGen = securityEventService.getEventIngestionGeneration();
        if (currentGen <= lastProcessedGeneration.get()) {
            return;
        }

        if (!detectionLock.tryLock()) {
            return;
        }

        try {
            currentGen = securityEventService.getEventIngestionGeneration();
            if (currentGen <= lastProcessedGeneration.get()) {
                return;
            }

            long genAtStart = currentGen;
            runDetectionCycleInternal(null);
            lastProcessedGeneration.accumulateAndGet(genAtStart, Math::max);
        } catch (Exception e) {
            log.error("Scheduled automatic detection failed: {}", e.getMessage(), e);
        } finally {
            detectionLock.unlock();
        }
    }

    /**
     * Manual or API-triggered detection cycle execution.
     * Acquires lock prior to database connection/transaction to prevent connection pool exhaustion.
     */
    public DetectionRunSummaryResponse runDetectionCycle(Integer lookbackMinutes) {
        if (lookbackMinutes != null) {
            if (lookbackMinutes < 1 || lookbackMinutes > 1440) {
                throw new ValidationException("lookback_minutes must be between 1 and 1440");
            }
        }

        detectionLock.lock();
        try {
            long genAtStart = securityEventService.getEventIngestionGeneration();
            DetectionRunSummaryResponse summary = runDetectionCycleInternal(lookbackMinutes);
            lastProcessedGeneration.accumulateAndGet(genAtStart, Math::max);
            return summary;
        } finally {
            detectionLock.unlock();
        }
    }

    private DetectionRunSummaryResponse runDetectionCycleInternal(Integer lookbackMinutes) {
        Integer lookbackSeconds = lookbackMinutes != null ? lookbackMinutes * 60 : null;

        try {
            return transactionTemplate.execute(status -> {
                List<SecurityEvent> events = securityEventRepository.findEventsForDetection(lookbackSeconds);
                List<DetectionResult> results = detectionEngine.evaluateEvents(events);

                List<AlertResponse> newAlerts = new ArrayList<>();
                int existingCount = 0;

                for (DetectionResult res : results) {
                    Alert alert = new Alert(
                        UUID.randomUUID().toString(),
                        res.ruleId(),
                        res.title(),
                        res.description(),
                        res.severity(),
                        res.relatedEventIds(),
                        res.evidence(),
                        res.fingerprint(),
                        AlertStatus.OPEN,
                        Instant.now()
                    );

                    AlertRepository.InsertResult insertResult = alertRepository.insert(alert);
                    if (insertResult.isNew()) {
                        newAlerts.add(AlertResponse.fromDomain(insertResult.alert()));
                    } else {
                        existingCount++;
                    }
                }

                return new DetectionRunSummaryResponse(
                    events.size(),
                    newAlerts.size(),
                    existingCount,
                    newAlerts
                );
            });
        } catch (ValidationException e) {
            throw e;
        } catch (Exception e) {
            log.error("Detection cycle execution failed: {}", e.getMessage(), e);
            throw new StorageException("Failed to execute detection cycle", e);
        }
    }

    public boolean isAutoEnabled() {
        return autoEnabled;
    }

    public void setAutoEnabled(boolean autoEnabled) {
        this.autoEnabled = autoEnabled;
    }

    public long getLastProcessedGeneration() {
        return lastProcessedGeneration.get();
    }
}

