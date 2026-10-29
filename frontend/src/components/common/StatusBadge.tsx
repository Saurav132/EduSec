import React from 'react';
import { CircleDot, Eye, CheckCheck, Archive } from 'lucide-react';
import type { AlertStatus } from '../../types';

interface StatusBadgeProps {
  status: AlertStatus | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const norm = String(status).toLowerCase();

  switch (norm) {
    case 'open':
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-[#FDE68A] bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-medium text-[#A16207]">
          <CircleDot className="h-3 w-3 text-[#A16207]" />
          <span>Open</span>
        </span>
      );
    case 'acknowledged':
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
          <Eye className="h-3 w-3 text-blue-600" />
          <span>Investigating</span>
        </span>
      );
    case 'resolved':
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-[#15803D]">
          <CheckCheck className="h-3 w-3 text-[#15803D]" />
          <span>Resolved</span>
        </span>
      );
    case 'closed':
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-[#71717A]">
          <Archive className="h-3 w-3 text-zinc-500" />
          <span>Closed</span>
        </span>
      );
  }
};
