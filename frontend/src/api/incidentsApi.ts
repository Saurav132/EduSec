/**
 * Typed API client for EduSec Incidents.
 *
 * Implements standard REST calls for `/api/v1/incidents` communicating
 * directly with the Java Spring Boot backend.
 */

import type {
  AddIncidentNoteInput,
  CreateIncidentInput,
  Incident,
  IncidentFilterParams,
  IncidentNote,
  IncidentsListResponse,
  UpdateIncidentStatusInput,
} from '../types';
import { ApiError } from './client';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');

async function parseErrorResponse(res: Response, fallbackMessage: string): Promise<never> {
  let errorMessage = fallbackMessage;
  try {
    const errorJson = await res.json();
    if (errorJson && typeof errorJson === 'object') {
      if ('detail' in errorJson) {
        errorMessage = typeof errorJson.detail === 'string'
          ? errorJson.detail
          : JSON.stringify(errorJson.detail);
      } else if ('message' in errorJson && typeof errorJson.message === 'string') {
        errorMessage = errorJson.message;
      }
    }
  } catch {
    try {
      const text = await res.text();
      if (text.trim()) errorMessage = text.trim();
    } catch {
      // Keep fallback
    }
  }
  throw new ApiError(errorMessage, res.status);
}

export const incidentsApi = {
  /**
   * Reset in-memory development fixtures (no-op in live backend integration)
   */
  resetFixtures(): void {
    // No-op when connected to real backend
  },

  /**
   * Fetch paginated incidents with optional filters from Java backend
   */
  async getIncidents(params: IncidentFilterParams = {}): Promise<IncidentsListResponse> {
    const q = new URLSearchParams();
    if (params.status && params.status !== 'all') q.set('status', params.status);
    if (params.severity && params.severity !== 'all') q.set('severity', params.severity);
    if (params.search) q.set('search', params.search);
    if (params.limit !== undefined) q.set('limit', String(params.limit));
    if (params.offset !== undefined) q.set('offset', String(params.offset));

    const queryStr = q.toString() ? `?${q.toString()}` : '';

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/incidents${queryStr}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        await parseErrorResponse(res, `Failed to fetch incidents: HTTP ${res.status}`);
      }

      const data = (await res.json()) as Incident[];
      const totalHeader = res.headers.get('x-total-count') || res.headers.get('X-Total-Count');
      const total = totalHeader ? parseInt(totalHeader, 10) : data.length;

      return {
        incidents: data.map((inc) => ({
          ...inc,
          notes: inc.notes || [],
          timeline: inc.timeline || [],
          alert_ids: inc.alert_ids || [],
          is_fixture: false,
        })),
        total,
        source: 'live_backend',
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        `Network error connecting to EduSec incidents API at ${API_BASE_URL}. Ensure backend is running.`,
        0,
        err
      );
    }
  },

  /**
   * Get single incident details from Java backend
   */
  async getIncidentById(id: string): Promise<Incident> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/incidents/${encodeURIComponent(id)}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new ApiError(`Incident "${id}" not found.`, 404);
        }
        await parseErrorResponse(res, `Failed to fetch incident "${id}": HTTP ${res.status}`);
      }

      const data = (await res.json()) as Incident;
      return {
        ...data,
        notes: data.notes || [],
        timeline: data.timeline || [],
        alert_ids: data.alert_ids || [],
        is_fixture: false,
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        `Network error fetching incident "${id}" from backend.`,
        0,
        err
      );
    }
  },

  /**
   * Create a new incident on Java backend
   */
  async createIncident(input: CreateIncidentInput): Promise<Incident> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        await parseErrorResponse(res, `Failed to create incident: HTTP ${res.status}`);
      }

      const data = (await res.json()) as Incident;
      return {
        ...data,
        notes: data.notes || [],
        timeline: data.timeline || [],
        alert_ids: data.alert_ids || [],
        is_fixture: false,
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        `Network error creating incident on backend.`,
        0,
        err
      );
    }
  },

  /**
   * Update incident status on Java backend
   */
  async updateIncidentStatus(
    id: string,
    input: UpdateIncidentStatusInput
  ): Promise<Incident> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/incidents/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        await parseErrorResponse(res, `Failed to update status for incident "${id}": HTTP ${res.status}`);
      }

      const data = (await res.json()) as Incident;
      return {
        ...data,
        notes: data.notes || [],
        timeline: data.timeline || [],
        alert_ids: data.alert_ids || [],
        is_fixture: false,
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        `Network error updating status for incident "${id}".`,
        0,
        err
      );
    }
  },

  /**
   * Add an investigation note on Java backend
   */
  async addIncidentNote(
    id: string,
    input: AddIncidentNoteInput
  ): Promise<IncidentNote> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/incidents/${encodeURIComponent(id)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        await parseErrorResponse(res, `Failed to add note to incident "${id}": HTTP ${res.status}`);
      }

      return (await res.json()) as IncidentNote;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        `Network error adding note to incident "${id}".`,
        0,
        err
      );
    }
  },

  /**
   * Link additional alerts to an existing incident
   */
  async linkAlerts(id: string, alertIds: string[]): Promise<Incident> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/incidents/${encodeURIComponent(id)}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_ids: alertIds }),
      });

      if (!res.ok) {
        await parseErrorResponse(res, `Failed to link alerts to incident "${id}": HTTP ${res.status}`);
      }

      const data = (await res.json()) as Incident;
      return {
        ...data,
        notes: data.notes || [],
        timeline: data.timeline || [],
        alert_ids: data.alert_ids || [],
        is_fixture: false,
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        `Network error linking alerts to incident "${id}".`,
        0,
        err
      );
    }
  },
};
