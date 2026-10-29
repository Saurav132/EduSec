"""
Unit tests for collector/sender.py.
Verifies HTTP transmission, retry policy, validation handling,
and duplicate delivery verification via GET /events/{id}.
"""

from io import BytesIO
import json
import unittest
from unittest.mock import MagicMock, patch
import urllib.error

from collector.sender import (
    DeliveryError,
    EventConflictError,
    EventSender,
    EventValidationError,
)


class DummyHTTPResponse:
    def __init__(self, status: int, data: bytes):
        self.status = status
        self._data = data

    def read(self):
        return self._data

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


class TestEventSender(unittest.TestCase):

    def setUp(self):
        self.sender = EventSender(
            api_base_url="http://127.0.0.1:8080/api/v1",
            max_retries=2,
            backoff_base=1.1,
            timeout=1.0
        )
        self.test_event = {
            "id": "test-uuid-1",
            "event_type": "authentication",
            "timestamp": "2026-10-18T12:00:00.000000Z",
            "source_ip": "192.168.1.100",
            "username": "admin",
            "outcome": "failure",
            "asset_id": "test-host",
            "metadata": {"test": "val"}
        }

    @patch("urllib.request.urlopen")
    def test_successful_delivery(self, mock_urlopen):
        mock_urlopen.return_value = DummyHTTPResponse(201, b'{"id":"test-uuid-1"}')

        result = self.sender.send_event(self.test_event)
        self.assertTrue(result)
        self.assertEqual(mock_urlopen.call_count, 1)

    @patch("urllib.request.urlopen")
    def test_validation_error_raises_immediately(self, mock_urlopen):
        err = urllib.error.HTTPError(
            url="http://127.0.0.1:8080/api/v1/events",
            code=422,
            msg="Unprocessable Entity",
            hdrs={},
            fp=BytesIO(b'{"detail":"Invalid source IP"}')
        )
        mock_urlopen.side_effect = err

        with self.assertRaises(EventValidationError):
            self.sender.send_event(self.test_event)

    @patch("urllib.request.urlopen")
    def test_http_500_with_successful_duplicate_verification(self, mock_urlopen):
        """
        Simulate case where server persisted the event on first attempt (or previously),
        POST returns 500 (e.g. SQLite duplicate primary key),
        and GET verification confirms the event exists with matching payload.
        """
        post_err = urllib.error.HTTPError(
            url="http://127.0.0.1:8080/api/v1/events",
            code=500,
            msg="Internal Server Error",
            hdrs={},
            fp=BytesIO(b'{"detail":"Primary key violation"}')
        )
        get_success = DummyHTTPResponse(
            200,
            json.dumps({
                "id": "test-uuid-1",
                "event_type": "authentication",
                "outcome": "failure",
                "username": "admin",
                "source_ip": "192.168.1.100"
            }).encode("utf-8")
        )

        mock_urlopen.side_effect = [post_err, get_success]

        result = self.sender.send_event(self.test_event)
        self.assertTrue(result, "Event must be accepted when verified present in database")

    @patch("urllib.request.urlopen")
    def test_http_500_with_payload_conflict_raises_error(self, mock_urlopen):
        """
        If GET verification returns a stored event with conflicting attributes,
        an EventConflictError must be raised rather than silently proceeding.
        """
        post_err = urllib.error.HTTPError(
            url="http://127.0.0.1:8080/api/v1/events",
            code=500,
            msg="Internal Server Error",
            hdrs={},
            fp=BytesIO(b'{"detail":"Server error"}')
        )
        get_conflict = DummyHTTPResponse(
            200,
            json.dumps({
                "id": "test-uuid-1",
                "event_type": "authentication",
                "outcome": "success",  # Conflicts with expected 'failure'
                "username": "different_user",
                "source_ip": "10.0.0.1"
            }).encode("utf-8")
        )

        mock_urlopen.side_effect = [post_err, get_conflict]

        with self.assertRaises(EventConflictError):
            self.sender.send_event(self.test_event)

    @patch("urllib.request.urlopen")
    def test_network_failure_exhausting_retries(self, mock_urlopen):
        """
        If network fails on both attempts and GET verification returns 404,
        DeliveryError must be raised.
        """
        net_err = urllib.error.URLError("Connection refused")
        get_404 = urllib.error.HTTPError(
            url="http://127.0.0.1:8080/api/v1/events/test-uuid-1",
            code=404,
            msg="Not Found",
            hdrs={},
            fp=BytesIO(b'{"detail":"Not Found"}')
        )

        # Attempt 1: POST fails with net_err, GET check fails with 404
        # Attempt 2: POST fails with net_err, GET check fails with 404
        mock_urlopen.side_effect = [net_err, get_404, net_err, get_404]

        with self.assertRaises(DeliveryError):
            self.sender.send_event(self.test_event)


if __name__ == "__main__":
    unittest.main()
