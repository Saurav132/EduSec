/**
 * Centralized typed API client for EduSec backend.
 */

import type { Alert, DetectionRunSummary, HealthResponse, SecurityEvent } from '../types';
import { incidentsApi } from './incidentsApi';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');

export class ApiError extends Error {
  public status: number;
  public details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function fetchJson<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; headers: Headers }> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      let errDetail: unknown = null;
      try {
        errDetail = await res.json();
      } catch {
        errDetail = await res.text();
      }
      throw new ApiError(
        `API Request to ${endpoint} failed with HTTP ${res.status}`,
        res.status,
        errDetail
      );
    }

    const data = (await res.json()) as T;
    return { data, headers: res.headers };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      `Network connection failed to EduSec backend at ${url}. Ensure backend is running.`,
      0,
      error
    );
  }
}

export const apiClient = {
  /**
   * Health Check
   */
  async getHealth(): Promise<HealthResponse> {
    const { data } = await fetchJson<HealthResponse>('/api/v1/health');
    return data;
  },

  /**
   * Get paginated security events
   */
  async getEvents(params: { limit?: number; offset?: number } = {}): Promise<{
    events: SecurityEvent[];
    total: number;
  }> {
    const q = new URLSearchParams();
    if (params.limit !== undefined) q.set('limit', String(params.limit));
    if (params.offset !== undefined) q.set('offset', String(params.offset));

    const queryStr = q.toString() ? `?${q.toString()}` : '';
    const { data, headers } = await fetchJson<SecurityEvent[]>(`/api/v1/events${queryStr}`);
    
    // Parse X-Total-Count header or fallback to data length
    const totalHeader = headers.get('x-total-count') || headers.get('X-Total-Count');
    const total = totalHeader ? parseInt(totalHeader, 10) : data.length;

    return { events: data, total };
  },

  /**
   * Get paginated alerts with optional filters
   */
  async getAlerts(params: {
    severity?: string;
    status?: string;
    rule_id?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    alerts: Alert[];
    total: number;
  }> {
    const q = new URLSearchParams();
    if (params.severity) q.set('severity', params.severity);
    if (params.status) q.set('status', params.status);
    if (params.rule_id) q.set('rule_id', params.rule_id);
    if (params.limit !== undefined) q.set('limit', String(params.limit));
    if (params.offset !== undefined) q.set('offset', String(params.offset));

    const queryStr = q.toString() ? `?${q.toString()}` : '';
    const { data, headers } = await fetchJson<Alert[]>(`/api/v1/alerts${queryStr}`);

    const totalHeader = headers.get('x-total-count') || headers.get('X-Total-Count');
    const total = totalHeader ? parseInt(totalHeader, 10) : data.length;

    return { alerts: data, total };
  },

  /**
   * Get single alert details with evidence
   */
  async getAlertById(alertId: string): Promise<Alert> {
    const { data } = await fetchJson<Alert>(`/api/v1/alerts/${encodeURIComponent(alertId)}`);
    return data;
  },

  /**
   * Run detection cycle over stored events
   */
  async runDetections(lookbackMinutes?: number): Promise<DetectionRunSummary> {
    const q = lookbackMinutes ? `?lookback_minutes=${lookbackMinutes}` : '';
    const { data } = await fetchJson<DetectionRunSummary>(`/api/v1/detections/run${q}`, {
      method: 'POST',
    });
    return data;
  },

  /**
   * Ingest a synthetic security event
   */
  async ingestEvent(event: Record<string, unknown>): Promise<SecurityEvent> {
    const { data } = await fetchJson<SecurityEvent>('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
    return data;
  },

  /**
   * Phase 6: Incidents API
   */
  incidents: incidentsApi,
};

