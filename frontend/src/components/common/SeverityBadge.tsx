import React from 'react';
import { ShieldAlert, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { AlertSeverity } from '../../types';

interface SeverityBadgeProps {
  severity: AlertSeverity | string;
  size?: 'sm' | 'md';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'sm' }) => {
  const norm = String(severity).toLowerCase();

  switch (norm) {
    case 'critical':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wider rounded-md border border-red-200 bg-red-50 text-[#DC2626] ${
            size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <ShieldAlert className="h-3 w-3 text-[#DC2626] shrink-0" />
          <span>Critical</span>
        </span>
      );
    case 'high':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wider rounded-md border border-orange-200 bg-orange-50 text-orange-700 ${
            size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <AlertTriangle className="h-3 w-3 text-orange-600 shrink-0" />
          <span>High</span>
        </span>
      );
    case 'medium':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wider rounded-md border border-amber-200 bg-amber-50 text-[#A16207] ${
            size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <AlertCircle className="h-3 w-3 text-[#A16207] shrink-0" />
          <span>Medium</span>
        </span>
      );
    case 'low':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wider rounded-md border border-zinc-200 bg-zinc-100 text-zinc-700 ${
            size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <Info className="h-3 w-3 text-zinc-500 shrink-0" />
          <span>{norm.toUpperCase() || 'LOW'}</span>
        </span>
      );
  }
};
