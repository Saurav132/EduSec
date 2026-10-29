import React from 'react';
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import type { EventOutcome } from '../../types';

interface OutcomeBadgeProps {
  outcome: EventOutcome | string;
}

export const OutcomeBadge: React.FC<OutcomeBadgeProps> = ({ outcome }) => {
  const norm = String(outcome).toLowerCase();

  if (norm === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-[#15803D]">
        <CheckCircle2 className="h-3 w-3 shrink-0 text-[#15803D]" />
        <span>Success</span>
      </span>
    );
  }

  if (norm === 'failure' || norm === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-[#DC2626]">
        <XCircle className="h-3 w-3 shrink-0 text-[#DC2626]" />
        <span>Failure</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-[#71717A]">
      <HelpCircle className="h-3 w-3 shrink-0 text-[#71717A]" />
      <span>{norm || 'Unknown'}</span>
    </span>
  );
};
