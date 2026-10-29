import React from 'react';
import { CircleDot, Eye, CheckCheck, Archive, Lock } from 'lucide-react';

import type { IncidentStatus } from '../../types';

interface IncidentStatusBadgeProps {
  status: IncidentStatus | string;
  size?: 'sm' | 'md';
}

export const IncidentStatusBadge: React.FC<IncidentStatusBadgeProps> = ({
  status,
  size = 'sm',
}) => {
  const norm = String(status).toLowerCase();
  const baseSize = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  switch (norm) {
    case 'open':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border border-[#FDE68A] bg-[#FEF3C7] font-medium text-[#A16207] ${baseSize}`}
        >
          <CircleDot className={`${iconSize} text-[#A16207] shrink-0`} />
          <span className="capitalize">Open</span>
        </span>
      );
    case 'investigating':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 font-medium text-blue-700 ${baseSize}`}
        >
          <Eye className={`${iconSize} text-blue-600 shrink-0`} />
          <span className="capitalize">Investigating</span>
        </span>
      );
    case 'contained':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 font-medium text-indigo-700 ${baseSize}`}
        >
          <Lock className={`${iconSize} text-indigo-600 shrink-0`} />
          <span className="capitalize">Contained</span>
        </span>
      );
    case 'resolved':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 font-medium text-[#15803D] ${baseSize}`}
        >
          <CheckCheck className={`${iconSize} text-[#15803D] shrink-0`} />
          <span className="capitalize">Resolved</span>
        </span>
      );
    case 'closed':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-100 font-medium text-[#71717A] ${baseSize}`}
        >
          <Archive className={`${iconSize} text-zinc-500 shrink-0`} />
          <span className="capitalize">Closed</span>
        </span>
      );
  }
};
