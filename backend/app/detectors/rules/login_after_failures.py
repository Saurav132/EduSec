"""Detection Rule NG-AUTH-002: Successful Login After Repeated Failures."""

from collections import defaultdict
from datetime import timedelta
from typing import List, Optional

from backend.app.core.config import get_settings
from backend.app.detectors.base import (
    BaseDetectionRule,
    DetectionResult,
    compute_evidence_fingerprint,
)
from backend.app.models.alert import AlertSeverity
from backend.app.models.event import EventOutcome, SecurityEvent


class LoginAfterFailuresRule(BaseDetectionRule):
    """
    Rule NG-AUTH-002: Successful Login After Repeated Failures.
    Detects when an authentication success is preceded by at least N authentication failures
    from the exact same source IP within a rolling time window.
    Indicates possible successful brute-force compromise or credential spraying.
    """

    rule_id: str = "NG-AUTH-002"
    name: str = "Successful Login After Repeated Failures"
    description: str = (
        "Detects a successful authentication event following multiple failed attempts from the same source IP "
        "within the preceding time window. May indicate an attacker successfully guessed or cracked credentials. "
        "Note: Legitimate user password mistypes, mobile network handoffs, and corporate NAT proxies can also "
        "trigger benign matches."
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
        Evaluate events for successful logins preceded by failures from the same source IP.
        Only counts failures that occurred BEFORE the success event within window_seconds.
        """
        results: List[DetectionResult] = []

        # 1. Group authentication events by source IP
        auth_events_by_ip = defaultdict(list)
        for event in events:
            if not event.event_type or event.event_type.lower() not in ("authentication", "auth_login"):
                continue
            if not event.source_ip or not event.source_ip.strip():
                continue
            if event.outcome not in (EventOutcome.SUCCESS, EventOutcome.FAILURE):
                continue

            auth_events_by_ip[event.source_ip].append(event)

        # 2. For each source IP, sort chronologically and find successes preceded by failures
        for source_ip, ip_events in auth_events_by_ip.items():
            sorted_events = sorted(ip_events, key=lambda e: e.timestamp)

            # Look for each successful login
            for idx, event in enumerate(sorted_events):
                if event.outcome != EventOutcome.SUCCESS:
                    continue

                success_time = event.timestamp
                window_start = success_time - timedelta(seconds=self.window_seconds)

                # Find preceding failures in [window_start, success_time]
                preceding_failures = [
                    prior for prior in sorted_events[:idx]
                    if prior.outcome == EventOutcome.FAILURE and window_start <= prior.timestamp <= success_time
                ]

                if len(preceding_failures) >= self.threshold:
                    failed_ids = [f.id for f in preceding_failures]
                    related_ids = [event.id] + failed_ids
                    fingerprint = compute_evidence_fingerprint(self.rule_id, related_ids)

                    failed_usernames = sorted(
                        list({f.username for f in preceding_failures if f.username})
                    )

                    evidence = {
                        "rule_id": self.rule_id,
                        "source_ip": source_ip,
                        "successful_event_id": event.id,
                        "successful_timestamp": success_time.isoformat(),
                        "successful_username": event.username,
                        "preceding_failed_count": len(preceding_failures),
                        "threshold": self.threshold,
                        "window_seconds": self.window_seconds,
                        "window_start": window_start.isoformat(),
                        "window_end": success_time.isoformat(),
                        "preceding_failed_event_ids": failed_ids,
                        "targeted_failed_usernames": failed_usernames,
                    }

                    results.append(
                        DetectionResult(
                            rule_id=self.rule_id,
                            rule_name=self.name,
                            title=f"Potential Compromise: Successful login after {len(preceding_failures)} failures from {source_ip}",
                            description=(
                                f"Observed a successful authentication for '{event.username or 'unknown'}' from IP {source_ip} "
                                f"immediately following {len(preceding_failures)} failed login attempts within the preceding "
                                f"{self.window_seconds} seconds."
                            ),
                            severity=self.severity,
                            related_event_ids=related_ids,
                            evidence=evidence,
                            fingerprint=fingerprint,
                        )
                    )

        return results
