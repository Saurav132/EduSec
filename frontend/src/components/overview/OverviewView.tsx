import React from 'react';
import {
  Activity,
  AlertTriangle,
  Flame,
  ShieldAlert,
  ArrowRight,
  Database,
  ExternalLink,
  RefreshCw,
  Zap,
} from 'lucide-react';
import type { Alert, NavigationTab, SecurityEvent } from '../../types';
import { MetricCard } from '../common/MetricCard';
import { SeverityBadge } from '../common/SeverityBadge';
import { OutcomeBadge } from '../common/OutcomeBadge';
import { StatusBadge } from '../common/StatusBadge';
import { ActivityChart } from './ActivityChart';
import { SeverityDistributionChart } from './SeverityDistributionChart';

interface OverviewViewProps {
  totalEvents: number | null;
  totalAlerts: number | null;
  openAlerts: number | null;
  criticalAlerts: number | null;
  highAlerts: number | null;
  recentEvents: SecurityEvent[];
  recentAlerts: Alert[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onNavigateTab: (tab: NavigationTab) => void;
  onSelectEvent?: (event: SecurityEvent) => void;
  onSelectAlert?: (alert: Alert) => void;
  onRunDetection: () => Promise<void>;
  runningDetection: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  totalEvents,
  totalAlerts,
  openAlerts,
  criticalAlerts,
  highAlerts,
  recentEvents,
  recentAlerts,
  loading,
  error,
  onRefresh,
  onNavigateTab,
  onSelectEvent,
  onSelectAlert,
  onRunDetection,
  runningDetection,
}) => {
  return (
    <div className="space-y-6">
      {/* Error Banner - Clear backend communication error with Retry action */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <p className="font-semibold text-red-900">Backend Communication Issue</p>
              <p className="text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-800 shadow-xs hover:bg-red-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Stored Events"
          value={totalEvents}
          subtext="From X-Total-Count header"
          icon={Database}
          variant="yellow"
          loading={loading}
          onClick={() => onNavigateTab('events')}
        />
        <MetricCard
          title="Total Alerts"
          value={totalAlerts}
          subtext="Detected security alerts"
          icon={ShieldAlert}
          variant="slate"
          loading={loading}
          onClick={() => onNavigateTab('alerts')}
        />
        <MetricCard
          title="Open Alerts"
          value={openAlerts}
          subtext="Requiring investigation"
          icon={Activity}
          variant="amber"
          loading={loading}
          onClick={() => onNavigateTab('alerts')}
        />
        <MetricCard
          title="High Severity"
          value={highAlerts}
          subtext="Confirmed brute force / auth"
          icon={AlertTriangle}
          variant="rose"
          loading={loading}
          onClick={() => onNavigateTab('alerts')}
        />
        <MetricCard
          title="Critical Severity"
          value={criticalAlerts}
          subtext="Verified severe attacks"
          icon={Flame}
          variant="rose"
          loading={loading}
          onClick={() => onNavigateTab('alerts')}
        />
      </div>

      {/* Telemetry Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityChart events={recentEvents} loading={loading} />
        </div>
        <div>
          <SeverityDistributionChart
            alerts={recentAlerts}
            totalAlerts={totalAlerts ?? 0}
            loading={loading}
          />
        </div>
      </div>

      {/* Recent Alerts & Events Dual Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Alerts Card */}
        <div className="flex flex-col rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[#A16207]" />
              <h2 className="text-sm font-semibold tracking-wide text-[#18181B]">
                Recent Security Alerts
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab('alerts')}
              className="flex items-center gap-1 text-xs font-medium text-[#A16207] hover:text-[#854D0E]"
            >
              <span>View all ({totalAlerts ?? 0})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2 py-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : recentAlerts.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-[#E4E4E7] bg-zinc-50 p-4 text-center">
              <ShieldAlert className="h-6 w-6 text-[#A1A1AA] mb-2" />
              <p className="text-xs font-medium text-[#18181B]">No Security Alerts Detected</p>
              <p className="text-[11px] text-[#71717A] mt-1 max-w-xs">
                Run detections over stored events to evaluate detection rules.
              </p>
              <button
                onClick={onRunDetection}
                disabled={runningDetection}
                className="mt-3 flex items-center gap-1.5 rounded-lg border border-[#EAB308] bg-[#FACC15] hover:bg-[#EAB308] px-3.5 py-1.5 text-xs font-medium text-[#18181B] shadow-xs"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Run Detection Engine</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E4E7] text-[#71717A]">
                    <th className="pb-2.5 font-medium">Severity</th>
                    <th className="pb-2.5 font-medium">Rule & Title</th>
                    <th className="pb-2.5 font-medium">Status</th>
                    <th className="pb-2.5 font-medium">Time (UTC)</th>
                    <th className="pb-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {recentAlerts.slice(0, 5).map((alert) => (
                    <tr
                      key={alert.id}
                      className="group transition-colors hover:bg-amber-50/40"
                    >
                      <td className="py-2.5">
                        <SeverityBadge severity={alert.severity} size="sm" />
                      </td>
                      <td className="py-2.5">
                        <div className="font-medium text-[#18181B] line-clamp-1">{alert.title}</div>
                        <div className="font-mono text-[10px] text-[#71717A]">{alert.rule_id}</div>
                      </td>
                      <td className="py-2.5">
                        <StatusBadge status={alert.status} />
                      </td>
                      <td className="py-2.5 font-mono text-[11px] text-[#71717A]">
                        {new Date(alert.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 text-right">
                        {onSelectAlert && (
                          <button
                            onClick={() => onSelectAlert(alert)}
                            className="inline-flex items-center gap-1 rounded-md border border-[#E4E4E7] bg-white px-2 py-1 text-[11px] font-medium text-[#18181B] shadow-xs hover:border-[#FACC15] hover:bg-[#FEF3C7]"
                            title="Inspect alert details"
                          >
                            <span>Inspect</span>
                            <ExternalLink className="h-3 w-3 text-[#71717A]" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Events Card */}
        <div className="flex flex-col rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#A16207]" />
              <h2 className="text-sm font-semibold tracking-wide text-[#18181B]">
                Recent Ingested Events
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab('events')}
              className="flex items-center gap-1 text-xs font-medium text-[#A16207] hover:text-[#854D0E]"
            >
              <span>View all ({totalEvents ?? 0})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2 py-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : recentEvents.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-[#E4E4E7] bg-zinc-50 p-4 text-center">
              <Activity className="h-6 w-6 text-[#A1A1AA] mb-2" />
              <p className="text-xs font-medium text-[#18181B]">No Events Stored</p>
              <p className="text-[11px] text-[#71717A] mt-1 max-w-xs">
                The SIEM database has no ingested events. Use POST /api/v1/events to send logs.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E4E7] text-[#71717A]">
                    <th className="pb-2.5 font-medium">Outcome</th>
                    <th className="pb-2.5 font-medium">Type</th>
                    <th className="pb-2.5 font-medium">User / Source</th>
                    <th className="pb-2.5 font-medium">Time (UTC)</th>
                    <th className="pb-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {recentEvents.slice(0, 5).map((event) => (
                    <tr
                      key={event.id}
                      className="group transition-colors hover:bg-amber-50/40"
                    >
                      <td className="py-2.5">
                        <OutcomeBadge outcome={event.outcome} />
                      </td>
                      <td className="py-2.5">
                        <span className="font-mono text-[#18181B] font-medium text-[11px]">{event.event_type}</span>
                      </td>
                      <td className="py-2.5">
                        <div className="font-medium text-[#18181B]">{event.username || '—'}</div>
                        <div className="font-mono text-[10px] text-[#71717A]">{event.source_ip || '—'}</div>
                      </td>
                      <td className="py-2.5 font-mono text-[11px] text-[#71717A]">
                        {new Date(event.timestamp || event.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 text-right">
                        {onSelectEvent && (
                          <button
                            onClick={() => onSelectEvent(event)}
                            className="inline-flex items-center gap-1 rounded-md border border-[#E4E4E7] bg-white px-2 py-1 text-[11px] font-medium text-[#18181B] shadow-xs hover:border-[#FACC15] hover:bg-[#FEF3C7]"
                            title="Inspect event details"
                          >
                            <span>Inspect</span>
                            <ExternalLink className="h-3 w-3 text-[#71717A]" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
