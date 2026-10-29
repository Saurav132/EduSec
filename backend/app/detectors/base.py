"""Abstract base class and schemas for modular SIEM detection rules."""

from abc import ABC, abstractmethod
import hashlib
from typing import Any, Dict, List
from pydantic import BaseModel, Field

from backend.app.models.alert import AlertSeverity
from backend.app.models.event import SecurityEvent


def compute_evidence_fingerprint(rule_id: str, event_ids: List[str]) -> str:
    """
    Generate a deterministic SHA-256 fingerprint for a rule and its supporting event IDs.
    Ensures identical evidence sets produce identical fingerprints to prevent duplicate alerts.
    """
    sorted_ids = sorted(event_ids)
    raw = f"{rule_id}:{','.join(sorted_ids)}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class DetectionResult(BaseModel):
    """Structured result produced when a detection rule matches suspicious activity."""
    rule_id: str
    rule_name: str
    title: str
    description: str
    severity: AlertSeverity
    related_event_ids: List[str] = Field(default_factory=list)
    evidence: Dict[str, Any] = Field(default_factory=dict)
    fingerprint: str


class BaseDetectionRule(ABC):
    """
    Abstract interface for independent, explainable detection rules.
    Rules must be deterministic, evaluate UTC timestamps, and provide clear evidence.
    """

    rule_id: str
    name: str
    description: str
    severity: AlertSeverity

    @abstractmethod
    def evaluate(self, events: List[SecurityEvent]) -> List[DetectionResult]:
        """
        Evaluate a sequence of security events and return any detection matches.
        Must handle unordered events safely and ignore events without required fields.
        """
        pass
