import React, { useState } from 'react';
import {
  AlertTriangle,
  Search,
  RefreshCw,
  Zap,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  CheckSquare,
  FolderKanban,
} from 'lucide-react';
import type { Alert } from '../../types';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { AlertDetailDrawer } from './AlertDetailDrawer';

interface AlertsViewProps {
  alerts: Alert[];
  totalAlerts: number;
  loading: boolean;
  error: string | null;
  severityFilter: string;
  statusFilter: string;
  onSeverityFilterChange: (sev: string) => void;
  onStatusFilterChange: (stat: string) => void;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onRefresh: () => void;
  selectedAlertId: string | null;
  onSelectAlertId: (id: string | null) => void;
  onRunDetection: () => Promise<void>;
  runningDetection: boolean;
  onEscalateToIncident?: (alertId: string | string[]) => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts,
  totalAlerts,
  loading,
  error,
  severityFilter,
  statusFilter,
  onSeverityFilterChange,
  onStatusFilterChange,
  page,
  pageSize,
  onPageChange,
  onRefresh,
  selectedAlertId,
  onSelectAlertId,
  onRunDetection,
  runningDetection,
  onEscalateToIncident,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatchAlertIds, setSelectedBatchAlertIds] = useState<string[]>([]);

  // Filter alerts by search term on the loaded page
  const displayedAlerts = alerts.filter((alert) => {
    if (!searchTerm.trim()) return true;
    const query = searchTerm.toLowerCase();
    const matchesTitle = alert.title.toLowerCase().includes(query);
    const matchesRule = alert.rule_id.toLowerCase().includes(query);
    const matchesDesc = alert.description.toLowerCase().includes(query);
    const matchesEvidence = JSON.stringify(alert.evidence || {}).toLowerCase().includes(query);
    return matchesTitle || matchesRule || matchesDesc || matchesEvidence;
  });

  const toggleSelectAlert = (alertId: string) => {
    setSelectedBatchAlertIds((prev) =>
      prev.includes(alertId) ? prev.filter((id) => id !== alertId) : Array.from(new Set([...prev, alertId]))
    );
  };

  const toggleSelectAll = () => {
    if (selectedBatchAlertIds.length === displayedAlerts.length) {
      setSelectedBatchAlertIds([]);
    } else {
      setSelectedBatchAlertIds(displayedAlerts.map((a) => a.id));
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalAlerts / pageSize));
  const activeAlert = alerts.find((a) => a.id === selectedAlertId) || null;

  return (
    <div className="space-y-5">
      {/* Detail Drawer */}
      {selectedAlertId && (
        <AlertDetailDrawer
          alertId={selectedAlertId}
          initialAlert={activeAlert}
          onClose={() => onSelectAlertId(null)}
          onEscalateToIncident={onEscalateToIncident}
        />
      )}



      {/* Header & Controls Card */}
      <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-[#DC2626]">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#18181B]">
                Security Alerts & Detections
              </h2>
              <p className="text-xs text-[#71717A]">
                Correlated security alerts produced by EduSec detection engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Run Detection Engine Button - Primary Yellow Action */}
            <button
              onClick={onRunDetection}
              disabled={runningDetection}
              className="flex items-center gap-1.5 rounded-lg border border-[#EAB308] bg-[#FACC15] hover:bg-[#EAB308] px-3.5 py-1.5 text-xs font-semibold text-[#18181B] shadow-xs transition disabled:opacity-50"
              title="Evaluate rules against recent security events"
            >
              <Zap className={`h-3.5 w-3.5 ${runningDetection ? 'animate-bounce text-[#18181B]' : 'text-[#18181B]'}`} />
              <span>{runningDetection ? 'Evaluating...' : 'Run Detection'}</span>
            </button>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-xs font-medium text-[#18181B] shadow-xs hover:bg-zinc-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#A16207]' : 'text-[#71717A]'}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filters row */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
          {/* Search bar */}
          <div className="relative sm:col-span-6">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by rule ID, title, or evidence..."
              className="w-full rounded-lg border border-[#E4E4E7] bg-white py-2 pr-3 pl-9 text-xs text-[#18181B] placeholder-[#71717A] focus:border-[#FACC15] focus:outline-hidden focus:ring-1 focus:ring-[#FACC15]"
            />
          </div>

          {/* Severity filter (backend query param) */}
          <div className="relative sm:col-span-3">
            <select
              value={severityFilter}
              onChange={(e) => {
                onSeverityFilterChange(e.target.value);
                onPageChange(0);
              }}
              className="w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#18181B] focus:border-[#FACC15] focus:outline-hidden focus:ring-1 focus:ring-[#FACC15]"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Status filter (backend query param) */}
          <div className="relative sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                onStatusFilterChange(e.target.value);
                onPageChange(0);
              }}
              className="w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#18181B] focus:border-[#FACC15] focus:outline-hidden focus:ring-1 focus:ring-[#FACC15]"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {/* Filter status banner */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E4E4E7] pt-2 text-[11px] text-[#71717A]">
          <div>
            <span>
              Showing <strong>{displayedAlerts.length}</strong> of{' '}
              <strong className="text-[#18181B]">{totalAlerts}</strong> matching alerts (Backend Query Filtered).
            </span>
          </div>

          {(severityFilter !== 'all' || statusFilter !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                onSeverityFilterChange('all');
                onStatusFilterChange('all');
                setSearchTerm('');
                onPageChange(0);
              }}
              className="text-xs font-semibold text-[#A16207] hover:underline"
            >
              Reset all filters
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 shadow-xs">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Batch Selection Action Bar */}
      {selectedBatchAlertIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FACC15] bg-[#FEFCE8] p-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-[#854D0E]">
            <CheckSquare className="h-4 w-4 text-[#A16207]" />
            <span>
              <strong>{selectedBatchAlertIds.length}</strong> {selectedBatchAlertIds.length === 1 ? 'alert' : 'alerts'} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedBatchAlertIds([])}
              className="rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1 text-xs text-[#71717A] hover:bg-zinc-50"
            >
              Clear selection
            </button>
            {onEscalateToIncident && (
              <button
                onClick={() => {
                  onEscalateToIncident(selectedBatchAlertIds);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-[#EAB308] bg-[#FACC15] hover:bg-[#EAB308] px-3 py-1 text-xs font-semibold text-[#18181B] shadow-xs transition"
              >
                <FolderKanban className="h-3.5 w-3.5" />
                <span>Create Incident from Selected ({selectedBatchAlertIds.length})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Alerts Table Card */}
      <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-white shadow-xs">
        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-zinc-100" />
            ))}
          </div>
        ) : displayedAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-zinc-50">
            <AlertTriangle className="h-10 w-10 text-[#A1A1AA] mb-3" />
            <h3 className="text-sm font-semibold text-[#18181B]">No Alerts Found</h3>
            <p className="mt-1 max-w-sm text-xs text-[#71717A]">
              {totalAlerts === 0
                ? 'No alerts have been generated yet. Trigger detection to evaluate stored events.'
                : 'No alerts match the selected filter criteria.'}
            </p>
            {totalAlerts === 0 && (
              <button
                onClick={onRunDetection}
                disabled={runningDetection}
                className="mt-4 flex items-center gap-1.5 rounded-lg border border-[#EAB308] bg-[#FACC15] hover:bg-[#EAB308] px-3.5 py-1.5 text-xs font-semibold text-[#18181B] shadow-xs"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Run Detection Engine</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E4E7] bg-zinc-50 text-[#71717A]">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all alerts on page"
                      checked={displayedAlerts.length > 0 && selectedBatchAlertIds.length === displayedAlerts.length}
                      onChange={toggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-[#D4D4D8] text-[#EAB308] focus:ring-[#FACC15] cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4 font-medium">Severity</th>
                  <th className="py-3 px-4 font-medium">Rule & Title</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Evidence Summary</th>
                  <th className="py-3 px-4 font-medium">Detected (UTC)</th>
                  <th className="py-3 px-4 text-right font-medium">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7]">
                {displayedAlerts.map((alert) => {
                  const alertDate = new Date(alert.created_at);
                  const formattedUtc = alertDate.toUTCString().replace('GMT', 'UTC');
                  const formattedLocal = alertDate.toLocaleString();

                  const evidenceKeys = Object.entries(alert.evidence || {});
                  const evidenceSnippet = evidenceKeys
                    .slice(0, 2)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' | ');

                  const isSelected = selectedBatchAlertIds.includes(alert.id);

                  return (
                    <tr
                      key={alert.id}
                      className={`group transition-colors ${isSelected ? 'bg-amber-50/70' : 'hover:bg-amber-50/30'}`}
                    >
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select alert ${alert.title}`}
                          checked={isSelected}
                          onChange={() => toggleSelectAlert(alert.id)}
                          className="h-3.5 w-3.5 rounded border-[#D4D4D8] text-[#EAB308] focus:ring-[#FACC15] cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <SeverityBadge severity={alert.severity} size="sm" />
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#18181B]">{alert.title}</div>
                        <div className="font-mono text-[10px] text-[#71717A]">{alert.rule_id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={alert.status} />
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <span className="font-mono text-[11px] text-[#18181B] truncate block">
                          {evidenceSnippet || 'Detection metadata recorded'}
                        </span>
                        <span className="text-[10px] text-[#71717A]">
                          {alert.related_event_ids?.length || 0} correlated events
                        </span>
                      </td>
                      <td
                        className="py-3 px-4 font-mono text-[11px] text-[#71717A] cursor-help"
                        title={`Local Time: ${formattedLocal}`}
                      >
                        {formattedUtc}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onSelectAlertId(alert.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1 text-[11px] font-medium text-[#18181B] shadow-xs transition hover:border-[#FACC15] hover:bg-[#FEF3C7]"
                          title="Inspect alert evidence and correlated events"
                        >
                          <span>Inspect</span>
                          <ExternalLink className="h-3 w-3 text-[#71717A]" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#E4E4E7] bg-white px-4 py-3 text-xs text-[#71717A]">
          <div>
            <span>
              Page <strong className="text-[#18181B]">{page + 1}</strong> of{' '}
              <strong className="text-[#18181B]">{totalPages}</strong> ({totalAlerts} total alerts)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(Math.max(0, page - 1))}
              disabled={page === 0 || loading}
              className="flex items-center gap-1 rounded-md border border-[#E4E4E7] bg-white px-3 py-1 font-medium text-[#18181B] shadow-xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages - 1 || loading}
              className="flex items-center gap-1 rounded-md border border-[#E4E4E7] bg-white px-3 py-1 font-medium text-[#18181B] shadow-xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
