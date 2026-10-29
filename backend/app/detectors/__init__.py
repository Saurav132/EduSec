"""Modular rule-based detection engine for EduSec."""

from backend.app.detectors.base import (
    BaseDetectionRule,
    DetectionResult,
    compute_evidence_fingerprint,
)
from backend.app.detectors.engine import DetectionEngine
from backend.app.detectors.rules.failed_logins import RepeatedFailedLoginsRule
from backend.app.detectors.rules.login_after_failures import LoginAfterFailuresRule

__all__ = [
    "BaseDetectionRule",
    "DetectionResult",
    "compute_evidence_fingerprint",
    "DetectionEngine",
    "RepeatedFailedLoginsRule",
    "LoginAfterFailuresRule",
]
