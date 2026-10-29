import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Activity, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { SecurityEvent } from '../../types';

interface ActivityChartProps {
  events: SecurityEvent[];
  loading?: boolean;
}

interface ChartDataPoint {
  timeLabel: string;
  total: number;
  failures: number;
  successes: number;
  timestamp: number;
}

export const ActivityChart: React.FC<ActivityChartProps> = ({ events, loading = false }) => {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-[#E4E4E7] bg-white p-6 shadow-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FACC15] border-t-transparent" />
          <span className="text-xs text-[#71717A]">Loading event telemetry...</span>
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[#E4E4E7] bg-white p-6 text-center shadow-xs">
        <Activity className="h-8 w-8 text-[#A1A1AA] mb-2" />
        <p className="text-sm font-medium text-[#18181B]">No Security Events Recorded</p>
        <p className="text-xs text-[#71717A] mt-1 max-w-sm">
          No security events have been ingested into the SIEM yet. Ingest events via the API to populate telemetry.
        </p>
      </div>
    );
  }

  // Aggregate events into chronological buckets
  const bucketMap = new Map<string, ChartDataPoint>();

  // Sort events chronologically (oldest to newest for timeline chart)
  const sortedEvents = [...events].sort((a, b) => {
    const tA = new Date(a.timestamp || a.created_at).getTime();
    const tB = new Date(b.timestamp || b.created_at).getTime();
    return tA - tB;
  });

  sortedEvents.forEach((ev) => {
    const date = new Date(ev.timestamp || ev.created_at);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    const key = `${hours}:${minutes}:${seconds}`;

    const existing = bucketMap.get(key) || {
      timeLabel: key,
      total: 0,
      failures: 0,
      successes: 0,
      timestamp: date.getTime(),
    };

    existing.total += 1;
    if (ev.outcome === 'failure') {
      existing.failures += 1;
    } else if (ev.outcome === 'success') {
      existing.successes += 1;
    }

    bucketMap.set(key, existing);
  });

  const chartData = Array.from(bucketMap.values());

  return (
    <div className="flex flex-col rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#A16207]" />
            <h2 className="text-sm font-semibold tracking-wide text-[#18181B]">
              Event Activity Timeline
            </h2>
          </div>
          <p className="text-xs text-[#71717A] mt-0.5">
            Derived from actual event timestamps ({events.length} sample records)
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-[#71717A]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FACC15]" />
            <span className="font-medium text-[#18181B]">Total Events</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#71717A]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
            <span className="font-medium text-[#18181B]">Failures</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#71717A]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#15803D]" />
            <span className="font-medium text-[#18181B]">Successes</span>
          </div>
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="yellowGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FACC15" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#FEF3C7" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#DC2626" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#FEE2E2" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" vertical={false} />
            <XAxis
              dataKey="timeLabel"
              stroke="#D4D4D8"
              tick={{ fill: '#71717A', fontSize: 10 }}
              tickLine={false}
            />
            <YAxis
              stroke="#D4D4D8"
              tick={{ fill: '#71717A', fontSize: 10 }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border border-[#E4E4E7] bg-white p-3 shadow-lg">
                      <p className="text-[11px] font-mono text-[#71717A] font-medium mb-1.5">
                        UTC: {label}
                      </p>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between gap-4 text-[#18181B]">
                          <span className="flex items-center gap-1 font-medium">
                            <Activity className="h-3 w-3 text-[#A16207]" /> Total:
                          </span>
                          <span className="font-mono font-bold text-[#18181B]">
                            {payload[0]?.value}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-[#18181B]">
                          <span className="flex items-center gap-1 font-medium">
                            <ShieldAlert className="h-3 w-3 text-[#DC2626]" /> Failures:
                          </span>
                          <span className="font-mono font-bold text-[#DC2626]">
                            {payload[1]?.value || 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-[#18181B]">
                          <span className="flex items-center gap-1 font-medium">
                            <ShieldCheck className="h-3 w-3 text-[#15803D]" /> Successes:
                          </span>
                          <span className="font-mono font-bold text-[#15803D]">
                            {payload[2]?.value || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#EAB308"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#yellowGradient)"
            />
            <Area
              type="monotone"
              dataKey="failures"
              stroke="#DC2626"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#redGradient)"
            />
            <Area
              type="monotone"
              dataKey="successes"
              stroke="#15803D"
              strokeWidth={1.5}
              fillOpacity={0}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
