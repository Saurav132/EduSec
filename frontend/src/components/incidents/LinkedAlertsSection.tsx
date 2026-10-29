import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Fingerprint,
} from 'lucide-react';

import type { Alert } from '../../types';
import { apiClient } from '../../api/client';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';

interface LinkedAlertsSectionProps {
  alertIds: string[];
  onOpenAlertInTab?: (alertId: string) => void;
}

export const LinkedAlertsSection: React.FC<LinkedAlertsSectionProps> = ({
  alertIds,
  onOpenAlertInTab,
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchLinkedAlerts = async () => {
      if (!alertIds || alertIds.length === 0) {
        if (isMounted) {
          setAlerts([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const loaded = await Promise.all(
          alertIds.map(async (id) => {
            try {
              return await apiClient.getAlertById(id);
            } catch {
              // Fallback placeholder if alert was deleted or not found
              const fallback: Alert = {
                id,
                rule_id: 'UNKNOWN',
                title: `Linked Alert (${id.slice(0, 8)}...)`,
                description: 'Detailed alert record not found on backend or in local session.',
                severity: 'medium',
                related_event_ids: [],
                evidence: {},
                fingerprint: null,
                status: 'open',
                created_at: new Date().toISOString(),
              };
              return fallback;
            }
          })
        );
        if (isMounted) {
          setAlerts(loaded);
          // Auto expand first alert if only 1-2 alerts
          if (loaded.length === 1) {
            setExpandedAlertId(loaded[0].id);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLinkedAlerts();

    return () => {
      isMounted = false;
    };
  }, [alertIds]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        <div className="h-14 animate-pulse rounded-lg border border-[#E4E4E7] bg-zinc-50" />
        <div className="h-14 animate-pulse rounded-lg border border-[#E4E4E7] bg-zinc-50" />
      </div>
    );
  }

  if (alertIds.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#E4E4E7] bg-zinc-50/50 p-6 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-[#71717A]" />
        <p className="mt-2 text-xs font-medium text-[#18181B]">No alerts currently linked</p>
        <p className="text-[11px] text-[#71717A]">
          This incident was created without initial linked alerts or during manual anomaly triage.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const isExpanded = expandedAlertId === alert.id;
        const evidenceEntries = Object.entries(alert.evidence || {});
        const sourceIp = alert.evidence && alert.evidence.source_ip ? String(alert.evidence.source_ip) : null;

        return (
          <div
            key={alert.id}
            className="overflow-hidden rounded-lg border border-[#E4E4E7] bg-white transition-all shadow-xs"
          >
            {/* Alert Header Row */}
            <div
              onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
              className="flex cursor-pointer items-start justify-between p-3.5 hover:bg-zinc-50/70"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-[#DC2626]">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-[#18181B] bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                      {alert.rule_id}
                    </span>
                    {sourceIp && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#A16207]">
                        <span>IP: {sourceIp}</span>
                      </span>
                    )}
                    <SeverityBadge severity={alert.severity} size="sm" />
                    <StatusBadge status={alert.status} />
                  </div>
                  <h4 className="mt-1 text-xs font-semibold text-[#18181B]">{alert.title}</h4>
                  <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] text-[#71717A]">
                    <span>ID: {alert.id.slice(0, 13)}...</span>
                    <span>•</span>
                    <span>UTC: {new Date(alert.created_at).toUTCString()}</span>
                    <span>•</span>
                    <span>Local: {new Date(alert.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>


              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(alert.id, `id-${alert.id}`);
                  }}
                  className="rounded-md border border-[#E4E4E7] p-1 text-[#71717A] hover:bg-zinc-100 hover:text-[#18181B]"
                  title="Copy alert ID"
                >
                  {copiedKey === `id-${alert.id}` ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                {onOpenAlertInTab && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAlertInTab(alert.id);
                    }}
                    className="rounded-md border border-[#E4E4E7] p-1 text-[#71717A] hover:bg-zinc-100 hover:text-[#18181B]"
                    title="View in Alerts tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-md p-1 text-[#71717A] hover:bg-zinc-100 hover:text-[#18181B]"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Expanded Evidence & Supporting Telemetry */}
            {isExpanded && (
              <div className="border-t border-[#E4E4E7] bg-zinc-50/50 p-4 space-y-3.5 text-xs">
                <div>
                  <h5 className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
                    Alert Description
                  </h5>
                  <p className="mt-1 text-xs text-[#18181B]">{alert.description}</p>
                </div>

                {/* Evidence Grid */}
                {evidenceEntries.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
                      <Layers className="h-3.5 w-3.5 text-[#A16207]" />
                      <span>Forensic Evidence</span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {evidenceEntries.map(([k, val]) => {
                        const valString =
                          typeof val === 'object' ? JSON.stringify(val) : String(val);
                        return (
                          <div
                            key={k}
                            className="rounded-md border border-[#E4E4E7] bg-white p-2.5"
                          >
                            <span className="font-mono text-[10px] font-medium text-[#71717A] uppercase">
                              {k.replace(/_/g, ' ')}
                            </span>
                            <p className="mt-0.5 font-mono text-[11px] font-semibold text-[#18181B] break-all">
                              {valString}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Fingerprint & Related Event IDs */}
                <div className="space-y-2 pt-1">
                  {alert.fingerprint && (
                    <div className="flex items-center justify-between rounded-md border border-[#E4E4E7] bg-white p-2 text-[11px]">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Fingerprint className="h-3.5 w-3.5 text-[#71717A] shrink-0" />
                        <span className="text-[#71717A]">Fingerprint:</span>
                        <span className="font-mono text-[10px] text-[#18181B] truncate">
                          {alert.fingerprint}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(alert.fingerprint || '', `fp-${alert.id}`)}
                        className="ml-2 text-[#71717A] hover:text-[#18181B]"
                        title="Copy fingerprint"
                      >
                        {copiedKey === `fp-${alert.id}` ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  )}

                  {alert.related_event_ids && alert.related_event_ids.length > 0 && (
                    <div className="rounded-md border border-[#E4E4E7] bg-white p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-[#71717A] uppercase">
                          Supporting Event IDs ({alert.related_event_ids.length})
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {alert.related_event_ids.map((eventId) => (
                          <span
                            key={eventId}
                            className="inline-block rounded-xs border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-[#18181B]"
                            title={eventId}
                          >
                            {eventId.slice(0, 8)}...
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
