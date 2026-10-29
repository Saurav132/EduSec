"""Detection rule modules."""

from backend.app.detectors.rules.failed_logins import RepeatedFailedLoginsRule
from backend.app.detectors.rules.login_after_failures import LoginAfterFailuresRule

__all__ = [
    "RepeatedFailedLoginsRule",
    "LoginAfterFailuresRule",
]
