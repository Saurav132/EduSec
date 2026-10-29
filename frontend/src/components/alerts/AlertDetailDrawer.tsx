import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldAlert,
  Clock,
  Key,
  Layers,
  FileText,
  Copy,
  Check,
  AlertTriangle,
  Info,
  FolderKanban,
} from 'lucide-react';
import type { Alert } from '../../types';
import { apiClient, ApiError } from '../../api/client';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';

interface AlertDetailDrawerProps {
  alertId: string | null;
  initialAlert?: Alert | null;
  onClose: () => void;
  onEscalateToIncident?: (alertId: string) => void;
}


export const AlertDetailDrawer: React.FC<AlertDetailDrawerProps> = ({
  alertId,
  initialAlert,
  onClose,
  onEscalateToIncident,
}) => {

  const [alert, setAlert] = useState<Alert | null>(initialAlert || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchDetails = async () => {
      if (!alertId) {
        if (isMounted) setAlert(null);
        return;
      }

      if (initialAlert && initialAlert.id === alertId) {
        if (isMounted) setAlert(initialAlert);
      }

      setLoading(true);
      setError(null);
      try {
        const freshAlert = await apiClient.getAlertById(alertId);
        if (isMounted) {
          setAlert(freshAlert);
        }
      } catch (err) {
        if (isMounted) {
          if (err instanceof ApiError && err.status === 404) {
            setError(`Alert ${alertId} was not found on the backend.`);
          } else {
            setError((err as Error).message || 'Failed to fetch alert details.');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [alertId, initialAlert]);

  if (!alertId) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full max-w-xl flex-col border-l border-[#E4E4E7] bg-white shadow-2xl transition-transform"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[#E4E4E7] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-[#DC2626]">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#18181B]">
                Alert Details & Evidence
              </h3>
              <p className="font-mono text-[11px] text-[#71717A]">ID: {alertId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#71717A] hover:bg-zinc-100 hover:text-[#18181B]"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading && !alert && (
            <div className="flex h-48 flex-col items-center justify-center space-y-3">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#FACC15] border-t-transparent" />
              <p className="text-xs text-[#71717A]">Fetching alert evidence from backend...</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-900 shadow-xs">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {alert && (
            <>
              {/* Alert Title & Status Row */}
              <div className="rounded-xl border border-[#E4E4E7] bg-zinc-50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={alert.severity} size="md" />
                    <StatusBadge status={alert.status} />
                  </div>
                  <span className="rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1 font-mono text-[11px] font-medium text-[#18181B]">
                    Rule: {alert.rule_id}
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-semibold text-[#18181B]">{alert.title}</h4>
                  <p className="mt-1 text-xs text-[#71717A] leading-relaxed">
                    {alert.description}
                  </p>
                </div>
              </div>

              {/* Deduplication Fingerprint */}
              {alert.fingerprint && (
                <div className="rounded-lg border border-[#E4E4E7] bg-zinc-50 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#71717A] font-semibold uppercase text-[10px] tracking-wider">
                      <Key className="h-3.5 w-3.5 text-[#A16207]" />
                      <span>Deduplication Fingerprint (SHA-256)</span>
                    </span>
                    <button
                      onClick={() => handleCopy(alert.fingerprint!, 'fingerprint')}
                      className="text-[11px] font-medium text-[#A16207] hover:text-[#854D0E] flex items-center gap-1"
                    >
                      {copiedId === 'fingerprint' ? <Check className="h-3 w-3 text-[#15803D]" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedId === 'fingerprint' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="mt-1.5 font-mono text-[11px] text-[#18181B] break-all bg-white p-2 rounded-md border border-[#E4E4E7]">
                    {alert.fingerprint}
                  </p>
                </div>
              )}

              {/* Detection Evidence */}
              <div className="rounded-xl border border-[#E4E4E7] bg-zinc-50 p-4 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold uppercase text-[10px] tracking-wider text-[#71717A]">
                    <FileText className="h-3.5 w-3.5 text-[#A16207]" />
                    <span>Detection Engine Evidence</span>
                  </span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(alert.evidence, null, 2), 'evidence')}
                    className="flex items-center gap-1 text-[11px] font-medium text-[#A16207] hover:text-[#854D0E]"
                  >
                    {copiedId === 'evidence' ? <Check className="h-3 w-3 text-[#15803D]" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedId === 'evidence' ? 'Copied JSON' : 'Copy'}</span>
                  </button>
                </div>

                {/* Evidence Key-Value Pairs */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {Object.entries(alert.evidence || {}).map(([k, v]) => (
                    <div
                      key={k}
                      className="rounded-lg border border-[#E4E4E7] bg-white p-2.5"
                    >
                      <span className="text-[10px] uppercase tracking-wider text-[#71717A] font-medium">
                        {k.replace(/_/g, ' ')}
                      </span>
                      <p className="mt-0.5 font-mono text-xs font-semibold text-[#18181B] truncate">
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Raw Evidence JSON */}
                <pre className="max-h-40 overflow-auto rounded-md bg-zinc-900 p-3 font-mono text-[11px] text-zinc-100 leading-relaxed border border-zinc-800">
                  {JSON.stringify(alert.evidence, null, 2)}
                </pre>
              </div>

              {/* Supporting Event IDs */}
              <div className="rounded-xl border border-[#E4E4E7] bg-zinc-50 p-4 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold uppercase text-[10px] tracking-wider text-[#71717A]">
                    <Layers className="h-3.5 w-3.5 text-[#A16207]" />
                    <span>Correlated Events ({alert.related_event_ids?.length || 0})</span>
                  </span>
                </div>

                {alert.related_event_ids && alert.related_event_ids.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {alert.related_event_ids.map((id, idx) => (
                      <div
                        key={id}
                        className="flex items-center justify-between rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 font-mono text-[11px] text-[#18181B]"
                      >
                        <span className="truncate">
                          #{idx + 1}: {id}
                        </span>
                        <button
                          onClick={() => handleCopy(id, `event-${id}`)}
                          className="ml-2 text-[#71717A] hover:text-[#18181B]"
                          title="Copy Event ID"
                        >
                          {copiedId === `event-${id}` ? (
                            <Check className="h-3.5 w-3.5 text-[#15803D]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#71717A] text-xs italic">No related event IDs recorded.</p>
                )}
              </div>

              {/* Timestamps */}
              <div className="rounded-lg border border-[#E4E4E7] bg-zinc-50 p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#71717A] font-semibold uppercase text-[10px] tracking-wider">
                  <Clock className="h-3.5 w-3.5 text-[#A16207]" />
                  <span>Detection Timestamp</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#18181B]">
                  <div>
                    <span className="text-[#71717A]">UTC: </span>
                    <span className="font-mono font-medium">
                      {new Date(alert.created_at).toUTCString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#71717A]">Local: </span>
                    <span className="font-mono font-medium">
                      {new Date(alert.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Phase 6 integration notice */}
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <Info className="h-4 w-4 text-[#A16207] shrink-0 mt-0.5" />
                <p>
                  <strong>Incident Escalation:</strong> Correlate this alert into a security incident case for structured investigation and containment.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#E4E4E7] px-6 py-3.5 bg-white">
          {onEscalateToIncident && alert ? (
            <button
              type="button"
              onClick={() => onEscalateToIncident(alert.id)}
              className="flex items-center gap-1.5 rounded-lg border border-[#EAB308] bg-[#FACC15] hover:bg-[#EAB308] px-3.5 py-1.5 text-xs font-semibold text-[#18181B] transition shadow-xs active:scale-95"
            >
              <FolderKanban className="h-3.5 w-3.5" />
              <span>Escalate to Incident</span>
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#E4E4E7] bg-white px-4 py-1.5 text-xs font-medium text-[#18181B] shadow-xs hover:bg-zinc-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>

  );
};
