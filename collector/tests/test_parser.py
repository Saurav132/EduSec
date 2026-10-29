"""
Unit tests for collector/parser.py.
Tests OpenSSH, sudo, PAM parsing, deduplication of Invalid User notices,
timestamp normalization, and IP address validation.
"""

import unittest
from collector.parser import (
    format_realtime_timestamp,
    generate_deterministic_event_id,
    parse_journal_entry,
    validate_ip,
)


class TestJournalParser(unittest.TestCase):

    def test_ssh_password_failure_parsing(self):
        entry = {
            "MESSAGE": "Failed password for root from 192.168.1.105 port 54321 ssh2",
            "SYSLOG_IDENTIFIER": "sshd",
            "_HOSTNAME": "kali-srv",
            "_PID": "12345",
            "_BOOT_ID": "boot-1",
            "__CURSOR": "cursor-1",
            "__REALTIME_TIMESTAMP": "1792304548021305"
        }
        event = parse_journal_entry(entry)
        self.assertIsNotNone(event)
        self.assertEqual(event["event_type"], "authentication")
        self.assertEqual(event["outcome"], "failure")
        self.assertEqual(event["username"], "root")
        self.assertEqual(event["source_ip"], "192.168.1.105")
        self.assertEqual(event["asset_id"], "kali-srv")
        self.assertTrue(event["timestamp"].endswith("Z"))
        self.assertEqual(event["metadata"]["collector"], "edusec-journal-agent")
        self.assertEqual(event["metadata"]["syslog_identifier"], "sshd")

    def test_ssh_password_success_parsing(self):
        entry = {
            "MESSAGE": "Accepted password for devuser from 10.0.0.15 port 42100 ssh2",
            "SYSLOG_IDENTIFIER": "sshd",
            "_HOSTNAME": "kali-srv",
            "_PID": "12346",
            "_BOOT_ID": "boot-1",
            "__CURSOR": "cursor-2",
            "__REALTIME_TIMESTAMP": "1792304550000000"
        }
        event = parse_journal_entry(entry)
        self.assertIsNotNone(event)
        self.assertEqual(event["event_type"], "authentication")
        self.assertEqual(event["outcome"], "success")
        self.assertEqual(event["username"], "devuser")
        self.assertEqual(event["source_ip"], "10.0.0.15")

    def test_ssh_publickey_success_parsing(self):
        entry = {
            "MESSAGE": "Accepted publickey for admin from 172.16.5.20 port 39822 ssh2: RSA SHA256:abc...",
            "SYSLOG_IDENTIFIER": "sshd",
            "_HOSTNAME": "kali-srv",
            "__CURSOR": "cursor-3"
        }
        event = parse_journal_entry(entry)
        self.assertIsNotNone(event)
        self.assertEqual(event["event_type"], "authentication")
        self.assertEqual(event["outcome"], "success")
        self.assertEqual(event["username"], "admin")
        self.assertEqual(event["source_ip"], "172.16.5.20")

    def test_invalid_user_notice_is_not_double_counted(self):
        """
        OpenSSH logs both:
        1. 'Invalid user test from 192.168.1.50 port 55123'
        2. 'Failed password for invalid user test from 192.168.1.50 port 55123 ssh2'
        The parser must ignore (1) and only emit (2) to prevent counting a single
        failed attempt as two failures.
        """
        entry_notice = {
            "MESSAGE": "Invalid user testuser from 192.168.1.50 port 55123",
            "SYSLOG_IDENTIFIER": "sshd",
            "__CURSOR": "cursor-notice"
        }
        notice_result = parse_journal_entry(entry_notice)
        self.assertIsNone(notice_result, "Invalid user notice line must be ignored to prevent double-counting")

        entry_failure = {
            "MESSAGE": "Failed password for invalid user testuser from 192.168.1.50 port 55123 ssh2",
            "SYSLOG_IDENTIFIER": "sshd",
            "_HOSTNAME": "kali-srv",
            "__CURSOR": "cursor-fail"
        }
        fail_result = parse_journal_entry(entry_failure)
        self.assertIsNotNone(fail_result)
        self.assertEqual(fail_result["event_type"], "authentication")
        self.assertEqual(fail_result["outcome"], "failure")
        self.assertEqual(fail_result["username"], "testuser")
        self.assertEqual(fail_result["source_ip"], "192.168.1.50")

    def test_sudo_auth_failure_parsing(self):
        entry = {
            "MESSAGE": "pam_unix(sudo:auth): authentication failure; logname=saurav uid=1000 euid=0 tty=/dev/pts/1 ruser=saurav rhost=  user=saurav",
            "SYSLOG_IDENTIFIER": "sudo",
            "_HOSTNAME": "kali-host",
            "__CURSOR": "cursor-sudo-1"
        }
        event = parse_journal_entry(entry)
        self.assertIsNotNone(event)
        self.assertEqual(event["event_type"], "linux_auth")
        self.assertEqual(event["outcome"], "failure")
        self.assertEqual(event["username"], "saurav")
        self.assertIsNone(event["source_ip"], "Local sudo activity must have None source_ip")

    def test_sudo_incorrect_password_attempt(self):
        entry = {
            "MESSAGE": "  saurav : 1 incorrect password attempt ; TTY=pts/2 ; PWD=/home/saurav ; USER=root ; COMMAND=/bin/ls",
            "SYSLOG_IDENTIFIER": "sudo",
            "_HOSTNAME": "kali-host",
            "__CURSOR": "cursor-sudo-2"
        }
        event = parse_journal_entry(entry)
        self.assertIsNotNone(event)
        self.assertEqual(event["event_type"], "linux_auth")
        self.assertEqual(event["outcome"], "failure")
        self.assertEqual(event["username"], "saurav")
        self.assertIsNone(event["source_ip"])

    def test_sudo_session_opened_parsing(self):
        entry = {
            "MESSAGE": "pam_unix(sudo:session): session opened for user root(uid=0) by saurav(uid=1000)",
            "SYSLOG_IDENTIFIER": "sudo",
            "_HOSTNAME": "kali-host",
            "__CURSOR": "cursor-sudo-3"
        }
        event = parse_journal_entry(entry)
        self.assertIsNotNone(event)
        self.assertEqual(event["event_type"], "linux_auth")
        self.assertEqual(event["outcome"], "success")
        self.assertEqual(event["username"], "saurav")
        self.assertIsNone(event["source_ip"])
        self.assertEqual(event["metadata"]["action"], "session_opened")

    def test_sudo_command_execution(self):
        entry = {
            "MESSAGE": "  saurav : TTY=pts/8 ; PWD=/home/saurav ; USER=root ; COMMAND=/usr/bin/apt update",
            "SYSLOG_IDENTIFIER": "sudo",
            "_HOSTNAME": "kali-host",
            "__CURSOR": "cursor-sudo-4"
        }
        event = parse_journal_entry(entry)
        self.assertIsNotNone(event)
        self.assertEqual(event["event_type"], "linux_auth")
        self.assertEqual(event["outcome"], "success")
        self.assertEqual(event["username"], "saurav")
        self.assertIsNone(event["source_ip"])
        self.assertEqual(event["metadata"]["runas"], "root")

    def test_cron_session_is_filtered(self):
        """Cron session churn should be filtered out to keep SIEM logs clean."""
        entry = {
            "MESSAGE": "pam_unix(cron:session): session opened for user root(uid=0) by root(uid=0)",
            "SYSLOG_IDENTIFIER": "CRON",
            "__CURSOR": "cursor-cron"
        }
        event = parse_journal_entry(entry)
        self.assertIsNone(event)

    def test_non_security_messages_are_filtered(self):
        entry = {
            "MESSAGE": "Started systemd-hostnamed.service - Hostname Service.",
            "SYSLOG_IDENTIFIER": "systemd",
            "__CURSOR": "cursor-sys"
        }
        event = parse_journal_entry(entry)
        self.assertIsNone(event)

    def test_validate_ip(self):
        self.assertEqual(validate_ip("192.168.1.1"), "192.168.1.1")
        self.assertEqual(validate_ip("2001:db8::1"), "2001:db8::1")
        self.assertIsNone(validate_ip(""))
        self.assertIsNone(validate_ip("   "))
        self.assertIsNone(validate_ip("not-an-ip"))
        self.assertIsNone(validate_ip("999.999.999.999"))
        self.assertIsNone(validate_ip(None))

    def test_format_realtime_timestamp(self):
        ts_usec = "1792304548021305"
        formatted = format_realtime_timestamp(ts_usec)
        self.assertTrue(formatted.endswith("Z"))
        self.assertIn("T", formatted)
        # Should gracefully handle bad values
        fallback = format_realtime_timestamp("invalid")
        self.assertTrue(fallback.endswith("Z"))

    def test_deterministic_id(self):
        id1 = generate_deterministic_event_id("boot-a", "cursor-1")
        id2 = generate_deterministic_event_id("boot-a", "cursor-1")
        id3 = generate_deterministic_event_id("boot-a", "cursor-2")
        self.assertEqual(id1, id2, "Same boot_id and cursor must produce identical ID")
        self.assertNotEqual(id1, id3, "Different cursor must produce distinct ID")


if __name__ == "__main__":
    unittest.main()
