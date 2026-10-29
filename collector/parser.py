"""
Parser and normalizer for systemd journal log entries.
Extracts authentication events (OpenSSH, sudo, PAM) and maps them strictly to
the EduSec SIEM event contract.
"""

from datetime import datetime, timezone
import ipaddress
import logging
import re
from typing import Any, Dict, Optional
import uuid

logger = logging.getLogger("edusec.collector.parser")

# --- OpenSSH Regular Expressions ---
# OpenSSH logs "Invalid user <user> from <ip>" right before "Failed password for invalid user ...".
# To prevent double-counting a single failure as two separate failed attempts,
# we explicitly detect and ignore standalone invalid user notification lines.
SSH_INVALID_USER_NOTICE = re.compile(
    r"^Invalid user\s+(?P<user>\S+)\s+from\s+(?P<ip>\S+)(?:\s+port\s+(?P<port>\d+))?",
    re.IGNORECASE
)

# Canonical OpenSSH failure log:
SSH_FAILED_AUTH = re.compile(
    r"^Failed\s+(?:password|publickey|none|keyboard-interactive)\s+for\s+(?:invalid user\s+)?(?P<user>\S+)\s+from\s+(?P<ip>\S+)\s+port\s+(?P<port>\d+)",
    re.IGNORECASE
)

# Canonical OpenSSH success log:
SSH_ACCEPTED_AUTH = re.compile(
    r"^Accepted\s+(?:password|publickey|keyboard-interactive)\s+for\s+(?P<user>\S+)\s+from\s+(?P<ip>\S+)\s+port\s+(?P<port>\d+)",
    re.IGNORECASE
)

# --- Sudo and PAM Regular Expressions ---
# PAM authentication failure (sudo / su):
PAM_AUTH_FAILURE = re.compile(
    r"pam_unix\((?P<service>sudo|su|login|sshd):auth\):\s+authentication failure;.*?\buser=(?P<user>\S+)",
    re.IGNORECASE
)

# Sudo incorrect password attempt:
SUDO_INCORRECT_PASSWORD = re.compile(
    r"^\s*(?P<user>\S+)\s*:\s*\d+\s+incorrect password attempt",
    re.IGNORECASE
)

# Failed su attempt:
FAILED_SU = re.compile(
    r"FAILED SU \(to (?P<target>\S+)\) (?P<user>\S+) on",
    re.IGNORECASE
)

# Sudo session opened:
PAM_SESSION_OPEN = re.compile(
    r"pam_unix\((?P<service>sudo|su|cron|login):session\):\s+session opened for user (?P<user>\S+?)(?:\(uid=\d+\))?\s+by\s+(?P<by>\S+?)(?:\(uid=\d+\))?$",
    re.IGNORECASE
)

# Sudo session closed:
PAM_SESSION_CLOSE = re.compile(
    r"pam_unix\((?P<service>sudo|su|cron|login):session\):\s+session closed for user (?P<user>\S+)",
    re.IGNORECASE
)

# Sudo command execution:
SUDO_COMMAND_RUN = re.compile(
    r"^\s*(?P<user>\S+)\s*:\s*TTY=\S+\s*;\s*PWD=\S+\s*;\s*USER=(?P<runas>\S+)\s*;\s*COMMAND=(?P<cmd>.*)",
    re.IGNORECASE
)


def validate_ip(raw_ip: Optional[str]) -> Optional[str]:
    """Validates an IP string using python stdlib ipaddress. Returns valid normalized IP or None."""
    if not raw_ip:
        return None
    cleaned = raw_ip.strip()
    if not cleaned:
        return None
    try:
        addr = ipaddress.ip_address(cleaned)
        return str(addr)
    except ValueError:
        return None


def format_realtime_timestamp(ts_val: Any) -> str:
    """Converts a systemd __REALTIME_TIMESTAMP (microseconds) to ISO-8601 UTC string."""
    try:
        if ts_val is not None:
            ts_int = int(ts_val)
            dt = datetime.fromtimestamp(ts_int / 1_000_000.0, tz=timezone.utc)
            return dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    except Exception:
        pass
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def generate_deterministic_event_id(boot_id: Optional[str], cursor: Optional[str]) -> str:
    """Generates a stable, reproducible UUIDv5 from journal boot_id and cursor."""
    identity = f"edusec:{boot_id or 'unknown'}:{cursor or uuid.uuid4().hex}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, identity))


def parse_journal_entry(entry: Dict[str, Any], max_msg_len: int = 256) -> Optional[Dict[str, Any]]:
    """
    Parses a single JSON record from systemd journalctl.
    Returns a normalized event dict matching CreateEventRequest DTO, or None if the record
    is irrelevant, malformed, or intentionally ignored (such as invalid user notices).
    """
    if not isinstance(entry, dict):
        return None

    raw_message = entry.get("MESSAGE")
    if not raw_message or not isinstance(raw_message, str):
        return None

    message = raw_message.strip()
    syslog_id = str(entry.get("SYSLOG_IDENTIFIER") or entry.get("_COMM") or "").strip().lower()
    cursor = str(entry.get("__CURSOR") or "")
    boot_id = str(entry.get("_BOOT_ID") or "")
    hostname = str(entry.get("_HOSTNAME") or "")
    pid = str(entry.get("_PID") or "")

    timestamp = format_realtime_timestamp(entry.get("__REALTIME_TIMESTAMP"))
    event_id = generate_deterministic_event_id(boot_id, cursor)

    # -------------------------------------------------------------
    # 1. OpenSSH Remote Authentication
    # -------------------------------------------------------------
    if syslog_id in ("sshd", "ssh") or "sshd" in syslog_id:
        # Check for invalid user notice:
        # DO NOT emit a separate event for this to avoid double-counting with subsequent Failed password.
        if SSH_INVALID_USER_NOTICE.search(message):
            logger.debug("Skipping redundant SSH invalid user notice: %s", message[:80])
            return None

        # Check for authentication failure
        fail_match = SSH_FAILED_AUTH.search(message)
        if fail_match:
            user = fail_match.group("user")
            ip_str = validate_ip(fail_match.group("ip"))
            return {
                "id": event_id,
                "event_type": "authentication",
                "timestamp": timestamp,
                "source_ip": ip_str,
                "username": user,
                "outcome": "failure",
                "asset_id": hostname or "linux-host",
                "metadata": {
                    "collector": "edusec-journal-agent",
                    "source": "systemd-journal",
                    "syslog_identifier": syslog_id,
                    "pid": pid,
                    "cursor": cursor,
                    "raw_message": message[:max_msg_len]
                }
            }

        # Check for authentication success
        succ_match = SSH_ACCEPTED_AUTH.search(message)
        if succ_match:
            user = succ_match.group("user")
            ip_str = validate_ip(succ_match.group("ip"))
            return {
                "id": event_id,
                "event_type": "authentication",
                "timestamp": timestamp,
                "source_ip": ip_str,
                "username": user,
                "outcome": "success",
                "asset_id": hostname or "linux-host",
                "metadata": {
                    "collector": "edusec-journal-agent",
                    "source": "systemd-journal",
                    "syslog_identifier": syslog_id,
                    "pid": pid,
                    "cursor": cursor,
                    "raw_message": message[:max_msg_len]
                }
            }

    # -------------------------------------------------------------
    # 2. Local Sudo and PAM Activity
    # -------------------------------------------------------------
    # Sudo / PAM / Su activity uses event_type: "linux_auth" and source_ip: None.
    # We do NOT invent a 127.0.0.1 IP address to avoid false remote brute-force alerts.
    if syslog_id in ("sudo", "su", "pam_unix", "pam", "login", "cron"):
        # A. PAM Authentication Failure (e.g. bad sudo password)
        pam_fail = PAM_AUTH_FAILURE.search(message)
        if pam_fail:
            user = pam_fail.group("user")
            return {
                "id": event_id,
                "event_type": "linux_auth",
                "timestamp": timestamp,
                "source_ip": None,
                "username": user,
                "outcome": "failure",
                "asset_id": hostname or "linux-host",
                "metadata": {
                    "collector": "edusec-journal-agent",
                    "source": "systemd-journal",
                    "syslog_identifier": syslog_id,
                    "action": "pam_auth_failure",
                    "cursor": cursor,
                    "raw_message": message[:max_msg_len]
                }
            }

        # B. Sudo Incorrect Password Attempt
        sudo_fail = SUDO_INCORRECT_PASSWORD.search(message)
        if sudo_fail:
            user = sudo_fail.group("user")
            return {
                "id": event_id,
                "event_type": "linux_auth",
                "timestamp": timestamp,
                "source_ip": None,
                "username": user,
                "outcome": "failure",
                "asset_id": hostname or "linux-host",
                "metadata": {
                    "collector": "edusec-journal-agent",
                    "source": "systemd-journal",
                    "syslog_identifier": syslog_id,
                    "action": "sudo_incorrect_password",
                    "cursor": cursor,
                    "raw_message": message[:max_msg_len]
                }
            }

        # C. Failed SU
        su_fail = FAILED_SU.search(message)
        if su_fail:
            user = su_fail.group("user")
            return {
                "id": event_id,
                "event_type": "linux_auth",
                "timestamp": timestamp,
                "source_ip": None,
                "username": user,
                "outcome": "failure",
                "asset_id": hostname or "linux-host",
                "metadata": {
                    "collector": "edusec-journal-agent",
                    "source": "systemd-journal",
                    "syslog_identifier": syslog_id,
                    "action": "failed_su",
                    "target_user": su_fail.group("target"),
                    "cursor": cursor,
                    "raw_message": message[:max_msg_len]
                }
            }

        # D. Sudo Command Execution
        sudo_cmd = SUDO_COMMAND_RUN.search(message)
        if sudo_cmd:
            user = sudo_cmd.group("user")
            # Truncate command to prevent leaking extensive arguments or sensitive tokens
            cmd_snippet = sudo_cmd.group("cmd").strip()[:80]
            return {
                "id": event_id,
                "event_type": "linux_auth",
                "timestamp": timestamp,
                "source_ip": None,
                "username": user,
                "outcome": "success",
                "asset_id": hostname or "linux-host",
                "metadata": {
                    "collector": "edusec-journal-agent",
                    "source": "systemd-journal",
                    "syslog_identifier": syslog_id,
                    "action": "sudo_command",
                    "runas": sudo_cmd.group("runas"),
                    "command_snippet": cmd_snippet,
                    "cursor": cursor,
                    "raw_message": message[:max_msg_len]
                }
            }

        # E. Sudo / Su Session Opened
        sess_open = PAM_SESSION_OPEN.search(message)
        if sess_open:
            service = sess_open.group("service").lower()
            # If it's cron, skip regular cron session churn to reduce SIEM noise
            if service == "cron":
                return None

            user = sess_open.group("by")
            target_user = sess_open.group("user")
            return {
                "id": event_id,
                "event_type": "linux_auth",
                "timestamp": timestamp,
                "source_ip": None,
                "username": user,
                "outcome": "success",
                "asset_id": hostname or "linux-host",
                "metadata": {
                    "collector": "edusec-journal-agent",
                    "source": "systemd-journal",
                    "syslog_identifier": syslog_id,
                    "action": "session_opened",
                    "target_user": target_user,
                    "cursor": cursor,
                    "raw_message": message[:max_msg_len]
                }
            }

    # All non-authentication system messages are intentionally filtered
    return None
