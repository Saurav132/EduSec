/**
 * Isolated Development Fixtures for EduSec Incident Response (Phase 6).
 *
 * NOTE: These fixtures are strictly for local frontend development, UI review,
 * and contract verification while the backend incident APIs are being implemented.
 * They are clearly isolated and will NOT overwrite or claim to be production data.
 */

import type { Incident } from '../../types';

export const INITIAL_INCIDENT_FIXTURES: Incident[] = [
  {
    id: 'INC-2026-001',
    title: 'Repeated Brute-Force Authentication Attack from 192.168.1.105',
    description:
      'High volume of failed login attempts (>5 in 300s window) targeting administrator accounts. Detected by rule NG-AUTH-001.',
    severity: 'high',
    status: 'investigating',
    alert_ids: ['ffbe0488-3b38-4bec-865a-2cf6e2a25550'],
    assignee: 'Saurav (SOC Lead)',
    created_at: '2026-10-15T04:22:00.000Z',
    updated_at: '2026-10-15T05:10:00.000Z',
    is_fixture: true,
    notes: [
      {
        id: 'note-001',
        incident_id: 'INC-2026-001',
        author: 'Saurav (SOC Lead)',
        content:
          'Initial triage started. Observed repeated failure signatures targeting "victim_admin". Host 192.168.1.105 is an internal subnet endpoint.',
        created_at: '2026-10-15T04:30:00.000Z',
      },
      {
        id: 'note-002',
        incident_id: 'INC-2026-001',
        author: 'Security Analyst 1',
        content:
          'Network perimeter check confirmed traffic is inbound from internal testing workstation. Checking if security test was scheduled.',
        created_at: '2026-10-15T05:05:00.000Z',
      },
    ],
    timeline: [
      {
        id: 'tl-001',
        incident_id: 'INC-2026-001',
        timestamp: '2026-10-15T04:22:00.000Z',
        action: 'Incident Created',
        actor: 'Detection Engine Automation',
        details: 'Escalated automatically from alert ffbe0488-3b38-4bec-865a-2cf6e2a25550',
      },
      {
        id: 'tl-002',
        incident_id: 'INC-2026-001',
        timestamp: '2026-10-15T04:30:00.000Z',
        action: 'Status Changed to Investigating',
        actor: 'Saurav (SOC Lead)',
        details: 'Assigned to Saurav for scope evaluation.',
      },
      {
        id: 'tl-003',
        incident_id: 'INC-2026-001',
        timestamp: '2026-10-15T05:05:00.000Z',
        action: 'Investigation Note Added',
        actor: 'Security Analyst 1',
        details: 'Network perimeter telemetry checked.',
      },
    ],
  },
  {
    id: 'INC-2026-002',
    title: 'Potential Credential Compromise: Success After Brute-Force',
    description:
      'Successful authentication detected on victim_admin immediately after 5 sequential failed attempts from the same source IP (192.168.1.105). Rule NG-AUTH-002 triggered.',
    severity: 'critical',
    status: 'contained',
    alert_ids: [
      'ffbe0488-3b38-4bec-865a-2cf6e2a25550',
      'c3657251-19f2-457a-9b34-c40943135b15',
    ],
    assignee: 'Incident Responder A',
    created_at: '2026-10-15T04:25:00.000Z',
    updated_at: '2026-10-15T06:00:00.000Z',
    is_fixture: true,
    notes: [
      {
        id: 'note-003',
        incident_id: 'INC-2026-002',
        author: 'Incident Responder A',
        content:
          'Critical indicator: session authenticated 25s after last failure. Target account password expired and active sessions revoked.',
        created_at: '2026-10-15T04:45:00.000Z',
      },
      {
        id: 'note-004',
        incident_id: 'INC-2026-002',
        author: 'Incident Responder A',
        content:
          'Account containment active. IP temporarily blocked at application firewall.',
        created_at: '2026-10-15T05:50:00.000Z',
      },
    ],
    timeline: [
      {
        id: 'tl-004',
        incident_id: 'INC-2026-002',
        timestamp: '2026-10-15T04:25:00.000Z',
        action: 'Incident Created',
        actor: 'Detection Engine Automation',
        details: 'Correlated alerts ffbe0488... and c3657251...',
      },
      {
        id: 'tl-005',
        incident_id: 'INC-2026-002',
        timestamp: '2026-10-15T04:45:00.000Z',
        action: 'Status Changed to Investigating',
        actor: 'Incident Responder A',
        details: 'Investigating potential unauthorized account takeover.',
      },
      {
        id: 'tl-006',
        incident_id: 'INC-2026-002',
        timestamp: '2026-10-15T05:50:00.000Z',
        action: 'Status Changed to Contained',
        actor: 'Incident Responder A',
        details: 'Credential revocation and firewall containment rule deployed.',
      },
    ],
  },
  {
    id: 'INC-2026-003',
    title: 'Isolated High Frequency Auth Anomalies on Server Asset 01',
    description:
      'Anomalous burst of failed authentications against auth server asset srv-auth-01 without valid account names.',
    severity: 'medium',
    status: 'open',
    alert_ids: [],
    assignee: null,
    created_at: '2026-10-15T07:15:00.000Z',
    updated_at: '2026-10-15T07:15:00.000Z',
    is_fixture: true,
    notes: [],
    timeline: [
      {
        id: 'tl-007',
        incident_id: 'INC-2026-003',
        timestamp: '2026-10-15T07:15:00.000Z',
        action: 'Incident Created',
        actor: 'Operator Manual Triage',
        details: 'Created case for investigation during morning SOC review.',
      },
    ],
  },
  {
    id: 'INC-2026-004',
    title: 'Historical Automated Script Password Expiry Cascade',
    description:
      'Backup automation script attempted connection with expired LDAP service token resulting in failure cluster.',
    severity: 'low',
    status: 'closed',
    alert_ids: [],
    assignee: 'Automated Service Lead',
    created_at: '2026-10-14T11:00:00.000Z',
    updated_at: '2026-10-14T14:30:00.000Z',
    is_fixture: true,
    notes: [
      {
        id: 'note-005',
        incident_id: 'INC-2026-004',
        author: 'Automated Service Lead',
        content: 'Root cause confirmed: service account credentials rotated without updating cron job script. Updated and verified.',
        created_at: '2026-10-14T14:20:00.000Z',
      },
    ],
    timeline: [
      {
        id: 'tl-008',
        incident_id: 'INC-2026-004',
        timestamp: '2026-10-14T11:00:00.000Z',
        action: 'Incident Created',
        actor: 'Security Operations',
        details: 'Triggered by threshold warning.',
      },
      {
        id: 'tl-009',
        incident_id: 'INC-2026-004',
        timestamp: '2026-10-14T14:30:00.000Z',
        action: 'Status Changed to Closed',
        actor: 'Automated Service Lead',
        details: 'Service token updated. Closed as benign operational error.',
      },
    ],
  },
  {
    id: 'INC-2026-005',
    title: 'Repeated Credential Guessing on VPN Gateway',
    description:
      'High volume of failed authentication requests from IP 192.168.1.105 triggering rule NG-AUTH-001. Originating endpoint secured and user credentials reset.',
    severity: 'high',
    status: 'resolved',
    alert_ids: ['ffbe0488-3b38-4bec-865a-2cf6e2a25550'],
    assignee: 'Saurav (SOC Lead)',
    created_at: '2026-10-14T08:00:00.000Z',
    updated_at: '2026-10-14T10:15:00.000Z',
    is_fixture: true,
    notes: [
      {
        id: 'note-006',
        incident_id: 'INC-2026-005',
        author: 'Saurav (SOC Lead)',
        content:
          'Remediation verified: affected user reset MFA tokens and internal endpoint scanned cleanly. Marked as resolved.',
        created_at: '2026-10-14T10:10:00.000Z',
      },
    ],
    timeline: [
      {
        id: 'tl-010',
        incident_id: 'INC-2026-005',
        timestamp: '2026-10-14T08:00:00.000Z',
        action: 'Incident Created',
        actor: 'SOC Alert Triage',
        details: 'Linked to brute-force alert ffbe0488-3b38-4bec-865a-2cf6e2a25550.',
      },
      {
        id: 'tl-011',
        incident_id: 'INC-2026-005',
        timestamp: '2026-10-14T08:30:00.000Z',
        action: 'Status Changed to Investigating',
        actor: 'Saurav (SOC Lead)',
        details: 'Analyst investigated credential spraying pattern.',
      },
      {
        id: 'tl-012',
        incident_id: 'INC-2026-005',
        timestamp: '2026-10-14T10:15:00.000Z',
        action: 'Status Changed to Resolved',
        actor: 'Saurav (SOC Lead)',
        details: 'User password rotated and policy enforced. Incident resolved.',
      },
    ],
  },
];

