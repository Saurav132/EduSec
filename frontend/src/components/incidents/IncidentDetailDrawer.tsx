import React, { useEffect, useState } from 'react';
import {
  X,
  FolderKanban,
  Clock,
  Copy,
  Check,
  ArrowRight,
  AlertCircle,
  Layers,
} from 'lucide-react';

import type { Incident, IncidentStatus } from '../../types';
import { apiClient } from '../../api/client';
import { SeverityBadge } from '../common/SeverityBadge';
import { IncidentStatusBadge } from './IncidentStatusBadge';
import { LinkedAlertsSection } from './LinkedAlertsSection';
import { IncidentTimeline } from './IncidentTimeline';

interface IncidentDetailDrawerProps {
  incidentId: string | null;
  initialIncident?: Incident | null;
  onClose: () => void;
  onIncidentUpdated?: (updated: Incident) => void;
  onOpenAlertInTab?: (alertId: string) => void;
}

export const IncidentDetailDrawer: React.FC<IncidentDetailDrawerProps> = ({
  incidentId,
  initialIncident,
  onClose,
  onIncidentUpdated,
  onOpenAlertInTab,
}) => {
  const [incident, setIncident] = useState<Incident | null>(initialIncident || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Status transition state
  const [statusMenuOpen, setStatusMenuOpen] = useState<boolean>(false);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [statusNote, setStatusNote] = useState<string>('');
  const [targetStatus, setTargetStatus] = useState<IncidentStatus | null>(null);

  // Adding note state
  const [addingNote, setAddingNote] = useState<boolean>(false);

  // Active section tab
  const [activeSection, setActiveSection] = useState<'evidence' | 'timeline'>('evidence');

  // Load incident details if not supplied or on ID change
  useEffect(() => {
    let isMounted = true;

    const fetchDetails = async () => {
      if (!incidentId) {
        if (isMounted) setIncident(null);
        return;
      }

      if (initialIncident && initialIncident.id === incidentId) {
        if (isMounted) setIncident(initialIncident);
      }

      setLoading(true);
      setError(null);
      try {
        const fresh = await apiClient.incidents.getIncidentById(incidentId);
        if (isMounted) {
          setIncident(fresh);
        }
      } catch (err) {
        if (isMounted) {
          setError((err as Error).message || 'Failed to load incident details.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [incidentId, initialIncident]);

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!incidentId) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExecuteStatusChange = async (newStatus: IncidentStatus) => {
    if (!incident) return;
    setUpdatingStatus(true);
    try {
      const updated = await apiClient.incidents.updateIncidentStatus(incident.id, {
        status: newStatus,
        note: statusNote.trim() || undefined,
        author: 'Security Analyst',
      });
      setIncident(updated);
      setTargetStatus(null);
      setStatusNote('');
      setStatusMenuOpen(false);
      if (onIncidentUpdated) {
        onIncidentUpdated(updated);
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async (content: string, author: string) => {
    if (!incident) return;
    setAddingNote(true);
    try {
      await apiClient.incidents.addIncidentNote(incident.id, { content, author });
      // Refresh current incident state
      const fresh = await apiClient.incidents.getIncidentById(incident.id);
      setIncident(fresh);
      if (onIncidentUpdated) {
        onIncidentUpdated(fresh);
      }
    } finally {
      setAddingNote(false);
    }
  };

  const allStatuses: IncidentStatus[] = ['open', 'investigating', 'contained', 'resolved', 'closed'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full max-w-2xl flex-col border-l border-[#E4E4E7] bg-white shadow-2xl transition-transform"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between border-b border-[#E4E4E7] px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#FDE68A] bg-[#FEF3C7] text-[#A16207]">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#18181B]">{incidentId}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(incidentId, 'header-id')}
                  className="rounded-md border border-[#E4E4E7] p-1 text-[#71717A] hover:bg-zinc-100 hover:text-[#18181B]"
                  title="Copy Incident ID"
                >
                  {copiedKey === 'header-id' ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
                {incident?.is_fixture && (
                  <span
                    className="rounded-xs border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#A16207]"
                    title="Loaded from local development fixture for contract verification"
                  >
                    DEV FIXTURE
                  </span>
                )}
              </div>
              <h3 className="mt-1 text-sm font-bold text-[#18181B] leading-snug">
                {incident?.title || 'Loading Incident...'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#71717A] hover:bg-zinc-100 hover:text-[#18181B]"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status & Lifecycle Action Bar */}
        {incident && (
          <div className="flex flex-wrap items-center justify-between border-b border-[#E4E4E7] bg-zinc-50/70 px-6 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-[#71717A]">Current Status:</span>
              <IncidentStatusBadge status={incident.status} size="md" />
              <SeverityBadge severity={incident.severity} size="sm" />
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setStatusMenuOpen(!statusMenuOpen)}
                className="flex items-center gap-1.5 rounded-md border border-[#EAB308] bg-[#FACC15] hover:bg-[#EAB308] px-3 py-1 text-xs font-semibold text-[#18181B] transition shadow-xs"
              >
                <span>Change Status</span>
                <ArrowRight className="h-3 w-3" />
              </button>

              {/* Status transition dropdown modal */}
              {statusMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-20 w-64 rounded-lg border border-[#E4E4E7] bg-white p-3 shadow-lg">
                  <div className="text-[11px] font-semibold text-[#71717A] uppercase mb-2">
                    Select Target Status
                  </div>
                  <div className="space-y-1">
                    {allStatuses.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          if (st === incident.status) {
                            setStatusMenuOpen(false);
                            return;
                          }
                          setTargetStatus(st);
                        }}
                        className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-left transition ${
                          st === incident.status
                            ? 'bg-zinc-100 font-semibold text-[#71717A] cursor-default'
                            : 'hover:bg-zinc-50 text-[#18181B]'
                        }`}
                      >
                        <span className="capitalize">{st}</span>
                        {st === incident.status && <span className="text-[10px] text-[#71717A]">Active</span>}
                      </button>
                    ))}
                  </div>

                  {/* Transition note input when status is selected */}
                  {targetStatus && (
                    <div className="mt-3 border-t border-[#E4E4E7] pt-2.5 space-y-2">
                      <div className="text-[11px] font-semibold text-[#18181B]">
                        Transition to <span className="capitalize font-bold text-[#A16207]">{targetStatus}</span>
                      </div>
                      <input
                        type="text"
                        value={statusNote}
                        onChange={(e) => setStatusNote(e.target.value)}
                        placeholder="Reason / action note (optional)..."
                        className="w-full rounded-md border border-[#E4E4E7] bg-white px-2 py-1 text-xs text-[#18181B] focus:border-[#FACC15] focus:outline-hidden"
                      />
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setTargetStatus(null);
                            setStatusMenuOpen(false);
                          }}
                          className="rounded-md border border-[#E4E4E7] px-2 py-1 text-[11px] text-[#71717A] hover:bg-zinc-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={updatingStatus}
                          onClick={() => handleExecuteStatusChange(targetStatus)}
                          className="rounded-md border border-[#EAB308] bg-[#FACC15] px-2.5 py-1 text-[11px] font-semibold text-[#18181B] hover:bg-[#EAB308]"
                        >
                          {updatingStatus ? 'Updating...' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Body Scroll Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#FAFAF8]">
          {loading && (
            <div className="space-y-4 py-8">
              <div className="h-6 w-1/3 animate-pulse rounded-md bg-zinc-200" />
              <div className="h-24 animate-pulse rounded-lg bg-zinc-200" />
              <div className="h-32 animate-pulse rounded-lg bg-zinc-200" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {incident && !loading && (
            <>
              {/* Metadata Card */}
              <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-xs space-y-3">
                <div className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
                  Incident Overview
                </div>
                <p className="text-xs text-[#18181B] leading-relaxed">{incident.description}</p>

                <div className="grid grid-cols-2 gap-3 border-t border-[#E4E4E7] pt-3 sm:grid-cols-3">
                  <div>
                    <span className="text-[10px] font-semibold text-[#71717A] uppercase">Assignee</span>
                    <p className="mt-0.5 text-xs font-medium text-[#18181B]">
                      {incident.assignee || 'Unassigned'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-[#71717A] uppercase">Created</span>
                    <p className="mt-0.5 font-mono text-[11px] text-[#18181B]">
                      {new Date(incident.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-[#71717A] uppercase">Last Updated</span>
                    <p className="mt-0.5 font-mono text-[11px] text-[#18181B]">
                      {new Date(incident.updated_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sections Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-[#E4E4E7] pb-2">
                <button
                  type="button"
                  onClick={() => setActiveSection('evidence')}
                  className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                    activeSection === 'evidence'
                      ? 'border border-[#FDE68A] bg-[#FEF3C7] text-[#18181B]'
                      : 'text-[#71717A] hover:bg-zinc-100 hover:text-[#18181B]'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5 text-[#A16207]" />
                  <span>Linked Alerts & Evidence ({incident.alert_ids.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('timeline')}
                  className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                    activeSection === 'timeline'
                      ? 'border border-[#FDE68A] bg-[#FEF3C7] text-[#18181B]'
                      : 'text-[#71717A] hover:bg-zinc-100 hover:text-[#18181B]'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5 text-[#A16207]" />
                  <span>Timeline & Notes ({incident.notes.length})</span>
                </button>
              </div>

              {/* Tab Section Content */}
              {activeSection === 'evidence' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-[#71717A]">
                    <span>Correlated security alerts associated with this incident:</span>
                    <span className="font-semibold text-[#18181B]">
                      {incident.alert_ids.length} alert(s)
                    </span>
                  </div>
                  <LinkedAlertsSection
                    alertIds={incident.alert_ids}
                    onOpenAlertInTab={onOpenAlertInTab}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <IncidentTimeline
                    timeline={incident.timeline || []}
                    notes={incident.notes || []}
                    onAddNote={handleAddNote}
                    addingNote={addingNote}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
