"""Detection Rule NG-AUTH-001: Repeated Failed Login Attempts."""

from collections import defaultdict
from typing import List, Optional

from backend.app.core.config import get_settings
from backend.app.detectors.base import (
    BaseDetectionRule,
    DetectionResult,
    compute_evidence_fingerprint,
)
from backend.app.models.alert import AlertSeverity
from backend.app.models.event import EventOutcome, SecurityEvent


class RepeatedFailedLoginsRule(BaseDetectionRule):
    """
    Rule NG-AUTH-001: Repeated Failed Login Attempts.
    Detects at least N failed authentication events from the same source IP
    within a rolling time window.
    """

    rule_id: str = "NG-AUTH-001"
    name: str = "Repeated Failed Login Attempts"
    description: str = (
        "Detects suspicious brute-force or credential-stuffing behavior indicated by "
        "multiple consecutive failed authentication attempts originating from the same source IP."
    )
    severity: AlertSeverity = AlertSeverity.HIGH

    def __init__(
        self,
        threshold: Optional[int] = None,
        window_seconds: Optional[int] = None,
    ):
        settings = get_settings()
        self.threshold = threshold or settings.auth_failure_threshold
        self.window_seconds = window_seconds or settings.auth_window_seconds

    def evaluate(self, events: List[SecurityEvent]) -> List[DetectionResult]:
        """
        Evaluate security events for repeated failed authentication attempts.
        Groups events by source IP, sorts by UTC timestamp, and inspects rolling windows.
        """
        results: List[DetectionResult] = []

        # 1. Filter to valid authentication failure events with a usable source IP
        auth_failures_by_ip = defaultdict(list)
        for event in events:
            # Check event type (case-insensitive for robustness)
            if not event.event_type or event.event_type.lower() not in ("authentication", "auth_login"):
                continue
            # Ensure outcome is failure
            if event.outcome != EventOutcome.FAILURE:
                continue
            # Must have usable source IP
            if not event.source_ip or not event.source_ip.strip():
                continue

            auth_failures_by_ip[event.source_ip].append(event)

        # 2. Evaluate rolling window for each source IP
        for source_ip, ip_events in auth_failures_by_ip.items():
            # Never assume input order equals timestamp order
            sorted_events = sorted(ip_events, key=lambda e: e.timestamp)

            i = 0
            n = len(sorted_events)
            while i < n:
                window_start = sorted_events[i].timestamp
                # Collect all events occurring within window_seconds of window_start
                window_events = [
                    e for e in sorted_events[i:]
                    if (e.timestamp - window_start).total_seconds() <= self.window_seconds
                ]

                if len(window_events) >= self.threshold:
                    event_ids = [e.id for e in window_events]
                    fingerprint = compute_evidence_fingerprint(self.rule_id, event_ids)
                    targeted_usernames = sorted(
                        list({e.username for e in window_events if e.username})
                    )

                    evidence = {
                        "rule_id": self.rule_id,
                        "source_ip": source_ip,
                        "failed_attempts_count": len(window_events),
                        "threshold": self.threshold,
                        "window_seconds": self.window_seconds,
                        "window_start": window_start.isoformat(),
                        "window_end": window_events[-1].timestamp.isoformat(),
                        "targeted_usernames": targeted_usernames,
                        "supporting_event_ids": event_ids,
                    }

                    results.append(
                        DetectionResult(
                            rule_id=self.rule_id,
                            rule_name=self.name,
                            title=f"Brute-Force Alert: {len(window_events)} failed logins from {source_ip}",
                            description=(
                                f"Observed {len(window_events)} failed authentication attempts from IP "
                                f"{source_ip} within {self.window_seconds} seconds (threshold: {self.threshold})."
                            ),
                            severity=self.severity,
                            related_event_ids=event_ids,
                            evidence=evidence,
                            fingerprint=fingerprint,
                        )
                    )
                    # Advance past the window to avoid redundant overlapping alerts for the same burst
                    i += len(window_events)
                else:
                    i += 1

        return results
