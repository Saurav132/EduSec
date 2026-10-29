import React, { useEffect, useState } from 'react';
import {
  Menu,
  RotateCw,
  Zap,
  Clock,
  ShieldCheck,
  AlertCircle,
  Database,
} from 'lucide-react';
import type { HealthResponse } from '../../types';

interface HeaderProps {
  onMobileMenuToggle: () => void;
  pageTitle: string;
  pageSubtitle?: string;
  health: HealthResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onRunDetection: () => Promise<void>;
  runningDetection: boolean;
  autoRefreshEnabled?: boolean;
  onToggleAutoRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onMobileMenuToggle,
  pageTitle,
  pageSubtitle,
  health,
  loading,
  onRefresh,
  onRunDetection,
  runningDetection,
  autoRefreshEnabled = true,
  onToggleAutoRefresh,
}) => {
  const [utcTime, setUtcTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().replace('GMT', 'UTC'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isHealthy = health?.status === 'healthy';
  const isDbReady = health?.database?.ready === true;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E4E4E7] bg-white px-4 sm:px-6">
      {/* Left title & hamburger */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="rounded-lg p-2 text-[#71717A] hover:bg-zinc-100 hover:text-[#18181B] lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-base font-semibold tracking-wide text-[#18181B] sm:text-lg">
            {pageTitle}
          </h1>
          {pageSubtitle && (
            <p className="hidden text-xs text-[#71717A] sm:block">{pageSubtitle}</p>
          )}
        </div>
      </div>

      {/* Right status & actions */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {/* UTC Clock for SOC operators */}
        <div className="hidden items-center gap-1.5 rounded-md border border-[#E4E4E7] bg-zinc-50 px-2.5 py-1 text-xs text-[#18181B] md:flex">
          <Clock className="h-3.5 w-3.5 text-[#71717A]" />
          <span className="font-mono text-[11px] font-medium">{utcTime}</span>
        </div>

        {/* Database Health Badge */}
        <div
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
            isHealthy && isDbReady
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
          title={health?.database?.details || 'Backend status'}
        >
          {isHealthy && isDbReady ? (
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-red-600" />
          )}
          <span className="hidden sm:inline">
            {isHealthy && isDbReady ? 'Ready' : 'Degraded'}
          </span>
          <Database className="h-3 w-3 opacity-60" />
        </div>

        {/* Trigger Detection Run - Primary Yellow Action */}
        <button
          onClick={onRunDetection}
          disabled={runningDetection || !isHealthy}
          className="flex items-center gap-1.5 rounded-md border border-[#EAB308] bg-[#FACC15] hover:bg-[#EAB308] px-3.5 py-1.5 text-xs font-semibold text-[#18181B] shadow-xs transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          title="Execute detection engine over stored security events"
        >
          <Zap className={`h-3.5 w-3.5 ${runningDetection ? 'animate-bounce text-[#18181B]' : 'text-[#18181B]'}`} />
          <span className="hidden sm:inline">
            {runningDetection ? 'Running...' : 'Run Detection'}
          </span>
        </button>

        {/* Auto-Refresh Toggle */}
        {onToggleAutoRefresh && (
          <button
            type="button"
            onClick={onToggleAutoRefresh}
            role="switch"
            aria-checked={autoRefreshEnabled}
            aria-label={`Toggle automatic dashboard refresh (currently ${autoRefreshEnabled ? 'enabled' : 'disabled'})`}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer select-none ${
              autoRefreshEnabled
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                : 'border-[#E4E4E7] bg-white text-[#71717A] hover:bg-zinc-50 hover:text-[#18181B]'
            }`}
            title={`Toggle 5s auto-refresh for active view (${autoRefreshEnabled ? 'Enabled' : 'Paused'})`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full transition-colors ${
                autoRefreshEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300'
              }`}
            />
            <span className="font-mono text-[11px] font-medium hidden sm:inline">
              {autoRefreshEnabled ? 'Auto 5s' : 'Auto Off'}
            </span>
          </button>
        )}

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="rounded-md border border-[#E4E4E7] bg-white p-1.5 text-[#71717A] transition hover:bg-zinc-50 hover:text-[#18181B] disabled:opacity-50"
          title="Refresh dashboard telemetry"
        >
          <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin text-[#A16207]' : ''}`} />
        </button>
      </div>
    </header>
  );
};
