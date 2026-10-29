/**
 * EduSec Frontend TypeScript Type Definitions
 */

export type EventOutcome = 'success' | 'failure' | 'unknown';

export interface SecurityEvent {
  id: string;
  event_type: string;
  timestamp: string;
  source_ip: string | null;
  username: string | null;
  outcome: EventOutcome;
  asset_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'closed';

export interface Alert {
  id: string;
  rule_id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  related_event_ids: string[];
  evidence: Record<string, unknown>;
  fingerprint: string | null;
  status: AlertStatus;
  created_at: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  app_name: string;
  api_version: string;
  database: {
    ready: boolean;
    details: string;
  };
}

export interface DetectionRunSummary {
  events_evaluated: number;
  alerts_created: number;
  alerts_existing: number;
  new_alerts: Alert[];
}

export type NavigationTab = 'overview' | 'events' | 'alerts' | 'incidents';

// Re-export incident types
export * from './incidents';
