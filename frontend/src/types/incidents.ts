/**
 * EduSec Phase 6 — Incident Management & Response Types
 */

import type { Alert, AlertSeverity } from './index';

export type IncidentSeverity = AlertSeverity; // 'low' | 'medium' | 'high' | 'critical'

export type IncidentStatus =
  | 'open'
  | 'investigating'
  | 'contained'
  | 'resolved'
  | 'closed';

export interface IncidentNote {
  id: string;
  incident_id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface IncidentTimelineEntry {
  id: string;
  incident_id: string;
  timestamp: string;
  action: string;
  actor: string;
  details?: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  alert_ids: string[];
  alerts?: Alert[];
  notes: IncidentNote[];
  timeline: IncidentTimelineEntry[];
  assignee: string | null;
  created_at: string;
  updated_at: string;
  is_fixture?: boolean;
}

export interface CreateIncidentInput {
  title: string;
  description: string;
  severity: IncidentSeverity;
  status?: IncidentStatus;
  alert_ids: string[];
  initial_note?: string;
  assignee?: string;
}

export interface UpdateIncidentStatusInput {
  status: IncidentStatus;
  note?: string;
  author?: string;
}

export interface AddIncidentNoteInput {
  content: string;
  author: string;
}

export interface IncidentFilterParams {
  status?: string;
  severity?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface IncidentsListResponse {
  incidents: Incident[];
  total: number;
  source: 'live_backend' | 'development_fixture';
}
