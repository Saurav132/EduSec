import React, { useState } from 'react';
import {
  FolderKanban,
  Search,
  Plus,
  RefreshCw,
  Filter,
  Eye,
  AlertTriangle,
  Layers,
  ChevronLeft,
  ChevronRight,
  Info,
  RotateCcw,
} from 'lucide-react';
import type { Incident } from '../../types';

import { SeverityBadge } from '../common/SeverityBadge';
import { IncidentStatusBadge } from './IncidentStatusBadge';
import { IncidentDetailDrawer } from './IncidentDetailDrawer';
import { CreateIncidentModal } from './CreateIncidentModal';

interface IncidentsViewProps {
  incidents: Incident[];
  totalIncidents: number;
  loading: boolean;
  error: string | null;
  source: 'live_backend' | 'development_fixture';
  statusFilter: string;
  severityFilter: string;
  onStatusFilterChange: (st: string) => void;
  onSeverityFilterChange: (sev: string) => void;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onRefresh: () => void;
  onResetFixtures?: () => void;
  selectedIncidentId: string | null;
  onSelectIncidentId: (id: string | null) => void;
  onIncidentCreated: (incident: Incident) => void;
  onIncidentUpdated: (incident: Incident) => void;
  onOpenAlertInTab?: (alertId: string) => void;
  createModalOpen: boolean;
  onCreateModalOpenChange: (open: boolean) => void;
  preSelectedAlertIds?: string[];
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  incidents,
  totalIncidents,
  loading,
  error,
  source,
  statusFilter,
  severityFilter,
  onStatusFilterChange,
  onSeverityFilterChange,
  page,
  pageSize,
  onPageChange,
  onRefresh,
  onResetFixtures,
  selectedIncidentId,
  onSelectIncidentId,
  onIncidentCreated,
  onIncidentUpdated,
  onOpenAlertInTab,
  createModalOpen,
  onCreateModalOpenChange,
  preSelectedAlertIds = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFixtureBanner, setShowFixtureBanner] = useState(true);

  // Filter incidents locally by search term
  const displayedIncidents = incidents.filter((inc) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    return (
      inc.id.toLowerCase().includes(q) ||
      inc.title.toLowerCase().includes(q) ||
      inc.description.toLowerCase().includes(q) ||
      (inc.assignee && inc.assignee.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.max(1, Math.ceil(totalIncidents / pageSize));
  const activeIncident = incidents.find((i) => i.id === selectedIncidentId) || null;

  // Status metrics counts
  const openCount = incidents.filter((i) => i.status === 'open').length;
  const investigatingCount = incidents.filter((i) => i.status === 'investigating').length;
  const containedCount = incidents.filter((i) => i.status === 'contained').length;
  const resolvedCount = incidents.filter((i) => i.status === 'resolved' || i.status === 'closed').length;

  return (
    <div className="space-y-5">
      {/* Incident Detail Drawer */}
      {selectedIncidentId && (
        <IncidentDetailDrawer
          incidentId={selectedIncidentId}
          initialIncident={activeIncident}
          onClose={() => onSelectIncidentId(null)}
          onIncidentUpdated={onIncidentUpdated}
          onOpenAlertInTab={onOpenAlertInTab}
        />
      )}

      {/* Create Incident Modal */}
      <CreateIncidentModal
        isOpen={createModalOpen}
        onClose={() => onCreateModalOpenChange(false)}
        onIncidentCreated={(newInc) => {
          onIncidentCreated(newInc);
          onSelectIncidentId(newInc.id);
        }}
        preSelectedAlertIds={preSelectedAlertIds}
      />

      {/* Notice Banner for Isolated Development Fixtures */}
      {source === 'development_fixture' && showFixtureBanner && (
        <div className="flex items-start justify-between rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-xs text-[#18181B] shadow-xs">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-[#A16207] shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-xs border border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-[#A16207]">
                  DEMO MODE
                </span>
                <p className="font-semibold text-[#18181B]">
                  Isolated Mock Fixtures Active (Backend Incident APIs Pending)
                </p>
              </div>
              <p className="text-[11px] text-[#71717A] mt-1 leading-relaxed">
                Backend incident APIs (<code>/api/v1/incidents</code>) are currently in development by the backend team. The interface operates in Demo Mode connected to isolated mock fixtures matching the agreed REST contract. Status changes, notes, and incident creations are simulated in your local browser session.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-4">
            {onResetFixtures && (
              <button
                type="button"
                onClick={onResetFixtures}
                className="flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#A16207] hover:bg-amber-100 transition"
                title="Reset fixtures to default sample state"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFixtureBanner(false)}
              className="text-[#71717A] hover:text-[#18181B] text-xs font-bold p-1"
              title="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Top Header Card */}
      <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#FDE68A] bg-[#FEF3C7] text-[#A16207]">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#18181B]">
                Incident Response & Case Management
              </h2>
              <p className="text-xs text-[#71717A]">
                Correlate alerts, coordinate containment, and track forensic investigations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-xs font-semibold text-[#71717A] hover:bg-zinc-50 hover:text-[#18181B] transition disabled:opacity-50"
              title="Refresh incident list"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#A16207]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Primary Yellow Action: Create Incident */}
            <button
              type="button"
              onClick={() => onCreateModalOpenChange(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[#EAB308] bg-[#FACC15] hover:bg-[#EAB308] px-3.5 py-1.5 text-xs font-semibold text-[#18181B] shadow-xs transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Create Incident</span>
            </button>
          </div>
        </div>

        {/* Quick Lifecycle Metric Badges */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#E4E4E7] pt-4 sm:grid-cols-4">
          <div className="rounded-lg border border-[#E4E4E7] bg-zinc-50/50 p-3">
            <span className="text-[10px] font-semibold uppercase text-[#71717A]">Open Cases</span>
            <p className="mt-1 text-lg font-bold text-[#A16207]">{openCount}</p>
          </div>
          <div className="rounded-lg border border-[#E4E4E7] bg-zinc-50/50 p-3">
            <span className="text-[10px] font-semibold uppercase text-[#71717A]">Investigating</span>
            <p className="mt-1 text-lg font-bold text-blue-700">{investigatingCount}</p>
          </div>
          <div className="rounded-lg border border-[#E4E4E7] bg-zinc-50/50 p-3">
            <span className="text-[10px] font-semibold uppercase text-[#71717A]">Contained</span>
            <p className="mt-1 text-lg font-bold text-indigo-700">{containedCount}</p>
          </div>
          <div className="rounded-lg border border-[#E4E4E7] bg-zinc-50/50 p-3">
            <span className="text-[10px] font-semibold uppercase text-[#71717A]">Resolved / Closed</span>
            <p className="mt-1 text-lg font-bold text-[#15803D]">{resolvedCount}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#71717A]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Incident ID, title, description, or assignee..."
            className="w-full rounded-lg border border-[#E4E4E7] bg-white pl-9 pr-4 py-2 text-xs text-[#18181B] placeholder:text-[#71717A] focus:border-[#FACC15] focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-[#71717A]" />
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1.5 text-xs text-[#18181B] focus:border-[#FACC15] focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="contained">Contained</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => onSeverityFilterChange(e.target.value)}
            className="rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1.5 text-xs text-[#18181B] focus:border-[#FACC15] focus:outline-hidden"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {(searchTerm || statusFilter !== 'all' || severityFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                onStatusFilterChange('all');
                onSeverityFilterChange('all');
              }}
              className="rounded-lg border border-[#E4E4E7] px-2.5 py-1.5 text-xs text-[#71717A] hover:bg-zinc-100 hover:text-[#18181B] transition"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Backend / Network Error State */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-md border border-red-300 bg-white px-2.5 py-1 font-semibold text-red-800 hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#18181B]">
            <thead className="border-b border-[#E4E4E7] bg-zinc-50/70 text-[10px] font-semibold uppercase tracking-wider text-[#71717A]">
              <tr>
                <th scope="col" className="px-5 py-3.5">
                  Incident ID
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Title & Triage Scope
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Severity
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Status
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Linked Alerts
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Assignee
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Last Updated
                </th>

                <th scope="col" className="px-5 py-3.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E4E7]">
              {loading && incidents.length === 0 ? (
                // Loading Skeleton Rows
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-5 py-4">
                      <div className="h-4 w-20 rounded bg-zinc-200" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-64 rounded bg-zinc-200" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-5 w-16 rounded bg-zinc-200" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-5 w-20 rounded bg-zinc-200" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-12 rounded bg-zinc-200" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-24 rounded bg-zinc-200" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-24 rounded bg-zinc-200" />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="ml-auto h-6 w-16 rounded bg-zinc-200" />
                    </td>
                  </tr>
                ))
              ) : displayedIncidents.length === 0 ? (
                // Empty State
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <FolderKanban className="mx-auto h-10 w-10 text-zinc-300" />
                    <h4 className="mt-3 text-sm font-semibold text-[#18181B]">
                      No incidents match current filter criteria
                    </h4>
                    <p className="mt-1 text-xs text-[#71717A]">
                      Try clearing filters, searching different keywords, or escalate new security alerts.
                    </p>
                    <div className="mt-4 flex justify-center gap-2">
                      {(searchTerm || statusFilter !== 'all' || severityFilter !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchTerm('');
                            onStatusFilterChange('all');
                            onSeverityFilterChange('all');
                          }}
                          className="rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-xs font-semibold text-[#71717A] hover:bg-zinc-50"
                        >
                          Clear Filters
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onCreateModalOpenChange(true)}
                        className="rounded-lg border border-[#EAB308] bg-[#FACC15] hover:bg-[#EAB308] px-3.5 py-1.5 text-xs font-semibold text-[#18181B]"
                      >
                        Create New Incident
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedIncidents.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => onSelectIncidentId(inc.id)}
                    className="cursor-pointer transition-colors hover:bg-zinc-50/80"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-[#18181B] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{inc.id}</span>
                        {inc.is_fixture && (
                          <span
                            className="rounded-xs border border-amber-300 bg-amber-50 px-1 py-0.2 text-[9px] font-semibold text-[#A16207]"
                            title="Development Fixture"
                          >
                            DEV
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 max-w-sm">
                      <div className="font-semibold text-[#18181B] truncate">{inc.title}</div>
                      <p className="text-[11px] text-[#71717A] truncate mt-0.5">
                        {inc.description}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <SeverityBadge severity={inc.severity} size="sm" />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <IncidentStatusBadge status={inc.status} size="sm" />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 rounded-md border border-[#E4E4E7] bg-zinc-50 px-2 py-0.5 font-mono text-[11px] font-medium text-[#18181B]">
                        <Layers className="h-3 w-3 text-[#A16207]" />
                        <span>{inc.alert_ids.length} alerts</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#71717A] whitespace-nowrap">
                      {inc.assignee || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-mono text-[11px] font-medium text-[#18181B]">
                        {new Date(inc.updated_at).toLocaleDateString()}{' '}
                        <span className="text-[10px] text-[#71717A]">
                          {new Date(inc.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-[#71717A]">
                        Created: {new Date(inc.created_at).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIncidentId(inc.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1 text-xs font-medium text-[#18181B] hover:bg-zinc-50 hover:border-[#FACC15] transition"
                      >
                        <Eye className="h-3 w-3 text-[#A16207]" />
                        <span>Investigate</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-[#E4E4E7] bg-zinc-50/50 px-5 py-3 text-xs text-[#71717A]">
          <div>
            Showing <span className="font-semibold text-[#18181B]">{displayedIncidents.length}</span> of{' '}
            <span className="font-semibold text-[#18181B]">{totalIncidents}</span> total incidents
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
              className="flex items-center gap-1 rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1 text-xs font-medium text-[#18181B] hover:bg-zinc-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
            <span className="font-mono text-xs text-[#18181B]">
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="flex items-center gap-1 rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1 text-xs font-medium text-[#18181B] hover:bg-zinc-50 disabled:opacity-50"
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
