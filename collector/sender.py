"""
HTTP Event Sender for EduSec SIEM Collector.
Delivers normalized security events to Spring Boot backend API with
loss-resistant retry logic and deterministic idempotency verification.
"""

import json
import logging
import time
from typing import Any, Dict, Optional
import urllib.error
import urllib.request

logger = logging.getLogger("edusec.collector.sender")


class DeliveryError(Exception):
    """Raised when an event cannot be delivered after exhausting all retries."""
    pass


class EventValidationError(Exception):
    """Raised when the backend rejects an event as invalid (HTTP 422)."""
    pass


class EventConflictError(Exception):
    """Raised when an existing event ID in backend has a conflicting payload."""
    pass


class EventSender:
    """Manages resilient HTTP transmission of events to the EduSec backend."""

    def __init__(
        self,
        api_base_url: str = "http://127.0.0.1:8080/api/v1",
        max_retries: int = 3,
        backoff_base: float = 1.5,
        timeout: float = 5.0
    ):
        self.api_base_url = api_base_url.rstrip("/")
        self.events_url = f"{self.api_base_url}/events"
        self.max_retries = max(1, max_retries)
        self.backoff_base = backoff_base
        self.timeout = timeout

    def send_event(self, event: Dict[str, Any]) -> bool:
        """
        Sends an event to POST /api/v1/events.
        Guarantees that network drops during response delivery do not create duplicate
        records or lose events by inspecting GET /api/v1/events/{id} upon failure.
        """
        event_id = event.get("id")
        if not event_id:
            raise ValueError("Event must contain a valid 'id' for idempotent tracking.")

        payload_bytes = json.dumps(event).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "EduSec-Linux-Collector/1.0"
        }

        last_error = None
        for attempt in range(1, self.max_retries + 1):
            req = urllib.request.Request(self.events_url, data=payload_bytes, headers=headers, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    if resp.status in (200, 201):
                        logger.debug("Successfully ingested event %s (status %d)", event_id, resp.status)
                        return True
                    else:
                        last_error = f"Unexpected HTTP status {resp.status}"

            except urllib.error.HTTPError as http_err:
                # 422: Backend rejected payload due to validation rules
                if http_err.code == 422:
                    error_detail = http_err.read().decode("utf-8", errors="replace")
                    logger.error("Backend validation rejected event %s: %s", event_id, error_detail)
                    raise EventValidationError(f"Backend rejected event: {error_detail}") from http_err

                # 500: Could be an actual server crash OR a primary key collision from a previous write
                if http_err.code == 500:
                    logger.warning("Received HTTP 500 on POST for event %s. Verifying if already stored...", event_id)
                    if self.verify_stored_event(event_id, event):
                        logger.info("Event %s was already stored with matching payload. Treated as delivered.", event_id)
                        return True
                    last_error = f"HTTP 500 Internal Server Error (event not verified in database)"

                else:
                    last_error = f"HTTP {http_err.code}: {http_err.reason}"

            except (urllib.error.URLError, TimeoutError, OSError) as net_err:
                logger.warning(
                    "Network error sending event %s on attempt %d/%d: %s",
                    event_id, attempt, self.max_retries, net_err
                )
                # Ambiguous failure: Did the server commit the event before network dropped?
                try:
                    if self.verify_stored_event(event_id, event):
                        logger.info("Event %s was successfully stored before disconnect. Treated as delivered.", event_id)
                        return True
                except Exception as check_exc:
                    logger.debug("Verification check failed during network outage: %s", check_exc)

                last_error = str(net_err)

            if attempt < self.max_retries:
                sleep_sec = self.backoff_base ** attempt
                logger.info("Retrying event %s in %.1f seconds...", event_id, sleep_sec)
                time.sleep(sleep_sec)

        raise DeliveryError(f"Failed to deliver event {event_id} after {self.max_retries} attempts: {last_error}")

    def verify_stored_event(self, event_id: str, expected_payload: Dict[str, Any]) -> bool:
        """
        Queries GET /api/v1/events/{id} to verify if the event is already persisted in the backend
        and has matching payload attributes.
        Returns True if safely present and matching.
        Returns False if 404 Not Found.
        Raises EventConflictError if stored event exists but payload does not match.
        """
        verify_url = f"{self.events_url}/{event_id}"
        req = urllib.request.Request(verify_url, headers={"Accept": "application/json"}, method="GET")

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                if resp.status == 200:
                    body = json.loads(resp.read().decode("utf-8"))
                    # Compare essential fields
                    if (
                        body.get("event_type") == expected_payload.get("event_type")
                        and body.get("outcome") == expected_payload.get("outcome")
                        and body.get("username") == expected_payload.get("username")
                        and body.get("source_ip") == expected_payload.get("source_ip")
                    ):
                        return True
                    else:
                        raise EventConflictError(
                            f"Event ID {event_id} exists but stored fields differ from expected payload!"
                        )
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False
            raise
        except (urllib.error.URLError, TimeoutError, OSError):
            return False

        return False
