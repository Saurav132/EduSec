import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ShieldAlert } from 'lucide-react';
import type { Alert } from '../../types';

interface SeverityDistributionProps {
  alerts: Alert[];
  totalAlerts: number;
  loading?: boolean;
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: {
    label: 'Critical',
    color: '#DC2626',
    bg: 'bg-red-50 text-red-700 border-red-200',
  },
  high: {
    label: 'High',
    color: '#EA580C',
    bg: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  medium: {
    label: 'Medium',
    color: '#FACC15',
    bg: 'bg-amber-50 text-[#A16207] border-amber-200',
  },
  low: {
    label: 'Low',
    color: '#71717A',
    bg: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  },
};

export const SeverityDistributionChart: React.FC<SeverityDistributionProps> = ({
  alerts,
  totalAlerts,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-[#E4E4E7] bg-white p-6 shadow-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FACC15] border-t-transparent" />
          <span className="text-xs text-[#71717A]">Loading severity breakdown...</span>
        </div>
      </div>
    );
  }

  // Count severities from actual records
  const counts: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  alerts.forEach((alert) => {
    const sev = alert.severity?.toLowerCase();
    if (sev && counts[sev] !== undefined) {
      counts[sev] += 1;
    }
  });

  const chartData = [
    { name: 'Critical', value: counts.critical, key: 'critical', color: SEVERITY_CONFIG.critical.color },
    { name: 'High', value: counts.high, key: 'high', color: SEVERITY_CONFIG.high.color },
    { name: 'Medium', value: counts.medium, key: 'medium', color: SEVERITY_CONFIG.medium.color },
    { name: 'Low', value: counts.low, key: 'low', color: SEVERITY_CONFIG.low.color },
  ].filter((item) => item.value > 0);

  const hasData = chartData.length > 0;

  return (
    <div className="flex flex-col rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#A16207]" />
          <h2 className="text-sm font-semibold tracking-wide text-[#18181B]">
            Alert Severity Breakdown
          </h2>
        </div>
        <span className="text-xs font-mono font-medium text-[#71717A]">
          {totalAlerts} Total
        </span>
      </div>
      <p className="text-xs text-[#71717A] mb-4">
        Distribution derived from {alerts.length} actual alert records
      </p>

      {!hasData ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-[#E4E4E7] bg-zinc-50 p-4 text-center">
          <ShieldAlert className="h-6 w-6 text-[#A1A1AA] mb-2" />
          <p className="text-xs font-medium text-[#18181B]">No Security Alerts</p>
          <p className="text-[11px] text-[#71717A] mt-1">
            Zero security alerts currently recorded in EduSec.
          </p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Donut chart */}
          <div className="relative h-44 w-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={68}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const percent = totalAlerts > 0 ? ((data.value / totalAlerts) * 100).toFixed(1) : 0;
                      return (
                        <div className="rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1.5 text-xs shadow-md">
                          <span className="font-semibold" style={{ color: data.color }}>
                            {data.name}:
                          </span>{' '}
                          <span className="font-mono font-bold text-[#18181B]">{data.value}</span> ({percent}%)
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-bold font-mono text-[#18181B]">{totalAlerts}</span>
              <span className="text-[10px] uppercase tracking-wider text-[#71717A]">Alerts</span>
            </div>
          </div>

          {/* Breakdown items */}
          <div className="flex-1 w-full space-y-2">
            {(['critical', 'high', 'medium', 'low'] as const).map((key) => {
              const count = counts[key];
              const cfg = SEVERITY_CONFIG[key];
              const percent = totalAlerts > 0 ? Math.round((count / totalAlerts) * 100) : 0;

              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-[#E4E4E7] bg-zinc-50 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: cfg.color }}
                    />
                    <span className="font-medium text-[#18181B]">{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-semibold text-[#18181B]">{count}</span>
                    <span className="text-[11px] text-[#71717A]">({percent}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
