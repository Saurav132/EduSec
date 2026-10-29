"""Detection Engine orchestrator managing registered rules."""

from typing import List, Optional
from backend.app.detectors.base import BaseDetectionRule, DetectionResult
from backend.app.detectors.rules.failed_logins import RepeatedFailedLoginsRule
from backend.app.detectors.rules.login_after_failures import LoginAfterFailuresRule
from backend.app.models.event import SecurityEvent


class DetectionEngine:
    """
    Coordinates and executes active rule-based detectors over security events.
    Rules are evaluated deterministically in isolation.
    """

    def __init__(self, rules: Optional[List[BaseDetectionRule]] = None):
        self.rules: List[BaseDetectionRule] = rules if rules is not None else [
            RepeatedFailedLoginsRule(),
            LoginAfterFailuresRule(),
        ]

    def register_rule(self, rule: BaseDetectionRule) -> None:
        """Register an additional detection rule."""
        self.rules.append(rule)

    def evaluate_events(self, events: List[SecurityEvent]) -> List[DetectionResult]:
        """
        Run all registered detection rules against the provided security events.
        Returns aggregated list of DetectionResults.
        """
        all_results: List[DetectionResult] = []
        for rule in self.rules:
            matches = rule.evaluate(events)
            all_results.extend(matches)
        return all_results
