import React, { useEffect, useState } from 'react';
import {
  X,
  FolderKanban,
  Search,
  Check,
  Plus,
  AlertCircle,
  Layers,
} from 'lucide-react';
import type { Alert, CreateIncidentInput, Incident, IncidentSeverity, IncidentStatus } from '../../types';
import { apiClient } from '../../api/client';
import { SeverityBadge } from '../common/SeverityBadge';

interface CreateIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIncidentCreated: (createdIncident: Incident) => void;

  preSelectedAlertIds?: string[];
}

export const CreateIncidentModal: React.FC<CreateIncidentModalProps> = ({
  isOpen,
  onClose,
  onIncidentCreated,
  preSelectedAlertIds = [],
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('high');
  const [status, setStatus] = useState<IncidentStatus>('open');
  const [assignee, setAssignee] = useState('Saurav (SOC Lead)');
  const [initialNote, setInitialNote] = useState('');
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>(() =>
    Array.from(new Set(preSelectedAlertIds || []))
  );
  const [prevPreSelected, setPrevPreSelected] = useState<string[]>(preSelectedAlertIds);
  if (preSelectedAlertIds !== prevPreSelected) {
    setPrevPreSelected(preSelectedAlertIds);
    if (preSelectedAlertIds && preSelectedAlertIds.length > 0) {
      setSelectedAlertIds(Array.from(new Set(preSelectedAlertIds)));
    }
  }

  // Available alerts for selection
  const [availableAlerts, setAvailableAlerts] = useState<Alert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState<boolean>(false);
  const [alertSearchTerm, setAlertSearchTerm] = useState('');

  // Form submission state & validation
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Fetch available alerts when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchAlerts = async () => {
      setLoadingAlerts(true);
      try {
        const res = await apiClient.getAlerts({ limit: 50 });
        if (isMounted) {
          setAvailableAlerts(res.alerts);
          // If we had preselected alerts, pick severity from highest alert if not explicitly touched
          if (preSelectedAlertIds.length > 0 && res.alerts.length > 0) {
            const matched = res.alerts.find((a) => preSelectedAlertIds.includes(a.id));
            if (matched) {
              setSeverity(matched.severity);
              setTitle((prevTitle) => prevTitle || `Investigation: ${matched.title}`);
            }

          }
        }
      } catch {
        // Non-critical if alerts fail to load for picker
      } finally {
        if (isMounted) setLoadingAlerts(false);
      }
    };

    fetchAlerts();

    return () => {
      isMounted = false;
    };
  }, [isOpen, preSelectedAlertIds]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const [manualAlertId, setManualAlertId] = useState('');
  const [alertDuplicateError, setAlertDuplicateError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleAlertSelection = (alertId: string) => {
    setAlertDuplicateError(null);
    setSelectedAlertIds((prev) => {
      if (prev.includes(alertId)) {
        return prev.filter((id) => id !== alertId);
      }
      // Strictly prevent selecting the same alert multiple times
      return Array.from(new Set([...prev, alertId]));
    });
  };

  const handleAddManualAlert = () => {
    const trimmed = manualAlertId.trim();
    if (!trimmed) return;
    if (selectedAlertIds.includes(trimmed)) {
      setAlertDuplicateError(`Alert "${trimmed}" is already selected for this incident. Duplicate selection is prevented.`);
      return;
    }
    setAlertDuplicateError(null);
    setSelectedAlertIds((prev) => Array.from(new Set([...prev, trimmed])));
    setManualAlertId('');
  };

  const handleRemoveSelectedAlert = (alertId: string) => {
    setAlertDuplicateError(null);
    setSelectedAlertIds((prev) => prev.filter((id) => id !== alertId));
  };


  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) {
      newErrors.title = 'Incident title is required.';
    } else if (title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters.';
    }

    if (!description.trim()) {
      newErrors.description = 'Incident description and triage summary is required.';
    } else if (description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setGeneralError(null);

    const payload: CreateIncidentInput = {
      title: title.trim(),
      description: description.trim(),
      severity,
      status,
      alert_ids: selectedAlertIds,
      initial_note: initialNote.trim() || undefined,
      assignee: assignee.trim() || undefined,
    };

    try {
      const created = await apiClient.incidents.createIncident(payload);
      onIncidentCreated(created);
      onClose();
    } catch (err) {
      setGeneralError((err as Error).message || 'Failed to create incident.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAlerts = availableAlerts.filter((a) => {
    if (!alertSearchTerm.trim()) return true;
    const q = alertSearchTerm.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.rule_id.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-[#E4E4E7] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E4E4E7] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#FDE68A] bg-[#FEF3C7] text-[#A16207]">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#18181B]">Create New Security Incident</h3>
              <p className="text-xs text-[#71717A]">
                Correlate security alerts and initiate triage response
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#71717A] hover:bg-zinc-100 hover:text-[#18181B]"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {generalError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="inc-title" className="block text-xs font-semibold text-[#18181B] mb-1">
              Incident Title <span className="text-red-500">*</span>
            </label>
            <input
              id="inc-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
              }}
              placeholder="e.g., Brute-force authentication flood from internal host 192.168.1.105"
              className={`w-full rounded-lg border bg-white px-3 py-2 text-xs text-[#18181B] focus:outline-hidden ${
                errors.title ? 'border-red-400 focus:border-red-500' : 'border-[#E4E4E7] focus:border-[#FACC15]'
              }`}
            />
            {errors.title && <p className="mt-1 text-[11px] text-red-600">{errors.title}</p>}
          </div>

          {/* Severity & Initial Status */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="inc-severity" className="block text-xs font-semibold text-[#18181B] mb-1">
                Severity Level <span className="text-red-500">*</span>
              </label>
              <select
                id="inc-severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                className="w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#18181B] focus:border-[#FACC15] focus:outline-hidden"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label htmlFor="inc-status" className="block text-xs font-semibold text-[#18181B] mb-1">
                Initial Status
              </label>
              <select
                id="inc-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as IncidentStatus)}
                className="w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#18181B] focus:border-[#FACC15] focus:outline-hidden"
              >
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="contained">Contained</option>
              </select>
            </div>

            <div>
              <label htmlFor="inc-assignee" className="block text-xs font-semibold text-[#18181B] mb-1">
                Lead Assignee
              </label>
              <input
                id="inc-assignee"
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Analyst Name"
                className="w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#18181B] focus:border-[#FACC15] focus:outline-hidden"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="inc-desc" className="block text-xs font-semibold text-[#18181B] mb-1">
              Description & Initial Triage Scope <span className="text-red-500">*</span>
            </label>
            <textarea
              id="inc-desc"
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
              }}
              placeholder="Provide context on affected assets, observed attack vectors, impact, and immediate next steps..."
              className={`w-full rounded-lg border bg-white p-3 text-xs text-[#18181B] focus:outline-hidden ${
                errors.description ? 'border-red-400 focus:border-red-500' : 'border-[#E4E4E7] focus:border-[#FACC15]'
              }`}
            />
            {errors.description && <p className="mt-1 text-[11px] text-red-600">{errors.description}</p>}
          </div>

          {/* Link Alerts Section */}
          <div className="rounded-lg border border-[#E4E4E7] bg-zinc-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[#A16207]" />
                <span className="text-xs font-bold text-[#18181B]">
                  Link Security Alerts ({selectedAlertIds.length} selected)
                </span>
              </div>
              <span className="text-[11px] text-[#71717A]">
                Select detection alerts to correlate
              </span>
            </div>

            {/* Duplicate Alert Notice */}
            {alertDuplicateError && (
              <div className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-[#A16207]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{alertDuplicateError}</span>
              </div>
            )}

            {/* Currently Selected Alert Chips */}
            {selectedAlertIds.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#71717A]">
                  <span>Linked Alerts ({selectedAlertIds.length} unique)</span>
                  <span className="text-[10px] text-zinc-500">Each alert can only be linked once</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 rounded-md border border-[#E4E4E7] bg-white">
                  {selectedAlertIds.map((id) => {
                    const alertObj = availableAlerts.find((a) => a.id === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#FDE68A] bg-[#FEF3C7] px-2 py-0.5 text-xs text-[#18181B]"
                      >
                        <span className="font-mono text-[10px] font-bold text-[#A16207]">
                          {alertObj ? alertObj.rule_id : id.slice(0, 8)}
                        </span>
                        <span className="truncate max-w-[140px] text-[11px]">
                          {alertObj ? alertObj.title : id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSelectedAlert(id)}
                          className="text-[#71717A] hover:text-[#18181B] font-bold ml-1 hover:bg-amber-200 rounded px-1"
                          title="Remove alert"
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Manual Alert ID Linker */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={manualAlertId}
                onChange={(e) => setManualAlertId(e.target.value)}
                placeholder="Or paste Alert ID / UUID..."
                className="flex-1 rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1.5 text-xs text-[#18181B] focus:border-[#FACC15] focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddManualAlert}
                disabled={!manualAlertId.trim()}
                className="rounded-md border border-[#E4E4E7] bg-white px-3 py-1.5 text-xs font-semibold text-[#18181B] hover:bg-zinc-100 disabled:opacity-50"
              >
                Link Alert
              </button>
            </div>

            {/* Alert Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#71717A]" />
              <input
                type="text"
                value={alertSearchTerm}
                onChange={(e) => setAlertSearchTerm(e.target.value)}
                placeholder="Search alerts by rule or title..."
                className="w-full rounded-md border border-[#E4E4E7] bg-white pl-8 pr-3 py-1.5 text-xs text-[#18181B] focus:border-[#FACC15] focus:outline-hidden"
              />
            </div>


            {/* Available Alerts List */}
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {loadingAlerts ? (
                <div className="p-3 text-center text-xs text-[#71717A]">Loading available alerts...</div>
              ) : filteredAlerts.length === 0 ? (
                <div className="p-3 text-center text-xs text-[#71717A]">
                  No matching alerts found in current store.
                </div>
              ) : (
                filteredAlerts.map((a) => {
                  const isSelected = selectedAlertIds.includes(a.id);
                  return (
                    <div
                      key={a.id}
                      onClick={() => toggleAlertSelection(a.id)}
                      className={`flex cursor-pointer items-center justify-between rounded-md border p-2 text-xs transition ${
                        isSelected
                          ? 'border-[#FDE68A] bg-[#FEF3C7] text-[#18181B]'
                          : 'border-[#E4E4E7] bg-white hover:bg-zinc-50 text-[#18181B]'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isSelected
                              ? 'border-[#A16207] bg-[#EAB308] text-white'
                              : 'border-zinc-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                        <span className="font-mono text-[10px] font-bold shrink-0">{a.rule_id}</span>
                        <span className="truncate text-xs font-medium">{a.title}</span>
                      </div>
                      <SeverityBadge severity={a.severity} size="sm" />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Initial Analyst Note */}
          <div>
            <label htmlFor="inc-note" className="block text-xs font-semibold text-[#18181B] mb-1">
              Initial Analyst Note <span className="text-[11px] font-normal text-[#71717A]">(Optional)</span>
            </label>
            <input
              id="inc-note"
              type="text"
              value={initialNote}
              onChange={(e) => setInitialNote(e.target.value)}
              placeholder="e.g., Initiated escalation following morning triage review..."
              className="w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#18181B] focus:border-[#FACC15] focus:outline-hidden"
            />
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-end gap-2.5 border-t border-[#E4E4E7] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#E4E4E7] bg-white px-4 py-2 text-xs font-semibold text-[#71717A] hover:bg-zinc-50 hover:text-[#18181B] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-lg border border-[#EAB308] bg-[#FACC15] hover:bg-[#EAB308] px-4 py-2 text-xs font-semibold text-[#18181B] transition shadow-xs disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>{submitting ? 'Creating Incident...' : 'Create Incident'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
