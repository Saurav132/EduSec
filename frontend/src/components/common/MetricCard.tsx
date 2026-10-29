import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string | null;
  subtext?: string;
  icon: LucideIcon;
  variant?: 'yellow' | 'rose' | 'amber' | 'emerald' | 'slate';
  loading?: boolean;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  variant = 'yellow',
  loading = false,
  onClick,
}) => {
  const variantStyles = {
    yellow: {
      iconBox: 'border-[#FDE68A] bg-[#FEF3C7] text-[#A16207]',
    },
    rose: {
      iconBox: 'border-red-200 bg-red-50 text-red-600',
    },
    amber: {
      iconBox: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    emerald: {
      iconBox: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    slate: {
      iconBox: 'border-zinc-200 bg-zinc-100 text-zinc-700',
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border border-[#E4E4E7] bg-white p-5 transition-all shadow-xs ${
        onClick ? 'cursor-pointer hover:border-[#D4D4D8] hover:shadow-sm' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-[#71717A]">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            {loading ? (
              <div className="h-8 w-16 animate-pulse rounded-md bg-zinc-100" />
            ) : (
              <span className="text-2xl font-bold font-mono tracking-tight text-[#18181B]">
                {value !== null ? value : '—'}
              </span>
            )}
          </div>
          {subtext && <p className="mt-1.5 text-[11px] text-[#71717A]">{subtext}</p>}
        </div>

        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${style.iconBox}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};
