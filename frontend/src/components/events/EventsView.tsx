import React, { useState, useMemo } from 'react';
import {
  Search,
  Terminal,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Database,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import type { SecurityEvent } from '../../types';
import { OutcomeBadge } from '../common/OutcomeBadge';
import { EventDetailModal } from './EventDetailModal';

interface EventsViewProps {
  events: SecurityEvent[];
  totalEvents: number;
  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newSize: number) => void;
  onRefresh: () => void;
  selectedEvent: SecurityEvent | null;
  onSelectEvent: (event: SecurityEvent | null) => void;
}

export const EventsView: React.FC<EventsViewProps> = ({
  events,
  totalEvents,
  loading,
  error,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  selectedEvent,
  onSelectEvent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');

  // Available unique event types on current page for quick filter
  const eventTypes = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      if (e.event_type) set.add(e.event_type);
    });
    return Array.from(set).sort();
  }, [events]);

  // Client-side filtering of current page
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Outcome filter
      if (outcomeFilter !== 'all' && ev.outcome !== outcomeFilter) {
        return false;
      }
      // Event Type filter
      if (eventTypeFilter !== 'all' && ev.event_type !== eventTypeFilter) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesUser = ev.username?.toLowerCase().includes(query) ?? false;
        const matchesIp = ev.source_ip?.toLowerCase().includes(query) ?? false;
        const matchesType = ev.event_type?.toLowerCase().includes(query) ?? false;
        const matchesAsset = ev.asset_id?.toLowerCase().includes(query) ?? false;
        const matchesId = ev.id?.toLowerCase().includes(query) ?? false;
        return matchesUser || matchesIp || matchesType || matchesAsset || matchesId;
      }
      return true;
    });
  }, [events, searchTerm, outcomeFilter, eventTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(totalEvents / pageSize));
  const isFiltered = searchTerm.trim() !== '' || outcomeFilter !== 'all' || eventTypeFilter !== 'all';

  return (
    <div className="space-y-5">
      {/* Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => onSelectEvent(null)}
        />
      )}

      {/* Header & Controls Card */}
      <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#FDE68A] bg-[#FEF3C7] text-[#A16207]">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#18181B]">
                Security Event Log
              </h2>
              <p className="text-xs text-[#71717A]">
                Real-time ingested security events retrieved from backend SQLite store
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-md border border-[#E4E4E7] bg-zinc-50 px-3 py-1.5 font-mono text-xs font-medium text-[#18181B]">
              <Database className="h-3.5 w-3.5 text-[#A16207]" />
              <span>{totalEvents} Total Stored</span>
            </span>
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

        {/* Filters and search row */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
          {/* Search bar */}
          <div className="relative sm:col-span-6">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by user, source IP, event type, asset..."
              className="w-full rounded-lg border border-[#E4E4E7] bg-white py-2 pr-3 pl-9 text-xs text-[#18181B] placeholder-[#71717A] focus:border-[#FACC15] focus:outline-hidden focus:ring-1 focus:ring-[#FACC15]"
            />
          </div>

          {/* Outcome Filter */}
          <div className="relative sm:col-span-3">
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#18181B] focus:border-[#FACC15] focus:outline-hidden focus:ring-1 focus:ring-[#FACC15]"
            >
              <option value="all">All Outcomes</option>
              <option value="success">Success only</option>
              <option value="failure">Failure only</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          {/* Event Type Filter */}
          <div className="relative sm:col-span-3">
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#18181B] focus:border-[#FACC15] focus:outline-hidden focus:ring-1 focus:ring-[#FACC15]"
            >
              <option value="all">All Event Types</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter status banner explaining page scope */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E4E4E7] pt-2 text-[11px] text-[#71717A]">
          <div>
            {isFiltered ? (
              <span className="text-[#A16207]">
                Filtered: Showing <strong>{filteredEvents.length}</strong> of{' '}
                <strong>{events.length}</strong> events on this page (out of {totalEvents} total in database).
              </span>
            ) : (
              <span>
                Showing <strong>{events.length}</strong> events on page {page + 1} of {totalPages} (backend paginated).
              </span>
            )}
          </div>

          {isFiltered && (
            <button
              onClick={() => {
                setSearchTerm('');
                setOutcomeFilter('all');
                setEventTypeFilter('all');
              }}
              className="text-xs font-semibold text-[#A16207] hover:underline"
            >
              Clear filters
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

      {/* Events Table Card */}
      <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-white shadow-xs">
        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded-lg bg-zinc-100" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-zinc-50">
            <Terminal className="h-10 w-10 text-[#A1A1AA] mb-3" />
            <h3 className="text-sm font-semibold text-[#18181B]">No Events Found</h3>
            <p className="mt-1 max-w-sm text-xs text-[#71717A]">
              {isFiltered
                ? 'No events match the current search/filter criteria on this page.'
                : 'No security events exist in the database.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E4E7] bg-zinc-50 text-[#71717A]">
                  <th className="py-3 px-4 font-medium">Outcome</th>
                  <th className="py-3 px-4 font-medium">Event Type</th>
                  <th className="py-3 px-4 font-medium">User</th>
                  <th className="py-3 px-4 font-medium">Source IP</th>
                  <th className="py-3 px-4 font-medium">Asset ID</th>
                  <th className="py-3 px-4 font-medium">Timestamp (UTC)</th>
                  <th className="py-3 px-4 text-right font-medium">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7]">
                {filteredEvents.map((event) => {
                  const evDate = new Date(event.timestamp || event.created_at);
                  const formattedUtc = evDate.toUTCString().replace('GMT', 'UTC');
                  const formattedLocal = evDate.toLocaleString();

                  return (
                    <tr
                      key={event.id}
                      className="group transition-colors hover:bg-amber-50/30"
                    >
                      <td className="py-3 px-4">
                        <OutcomeBadge outcome={event.outcome} />
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[#18181B] font-medium">
                          {event.event_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#18181B]">
                        {event.username || (
                          <span className="text-[#A1A1AA] italic">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#71717A]">
                        {event.source_ip || (
                          <span className="text-[#A1A1AA] italic">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#71717A]">
                        {event.asset_id || '—'}
                      </td>
                      <td
                        className="py-3 px-4 font-mono text-[11px] text-[#71717A] cursor-help"
                        title={`Local Time: ${formattedLocal}`}
                      >
                        {formattedUtc}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onSelectEvent(event)}
                          className="inline-flex items-center gap-1 rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1 text-[11px] font-medium text-[#18181B] shadow-xs transition hover:border-[#FACC15] hover:bg-[#FEF3C7]"
                          title="View metadata and event payload"
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
          <div className="flex items-center gap-3">
            <span>
              Page <strong className="text-[#18181B]">{page + 1}</strong> of{' '}
              <strong className="text-[#18181B]">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1.5">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="rounded-md border border-[#E4E4E7] bg-white px-2 py-1 text-[#18181B] focus:outline-hidden"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>per page</span>
            </div>
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
