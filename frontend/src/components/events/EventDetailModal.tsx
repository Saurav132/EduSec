import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Clock, Shield, Monitor, User, Globe } from 'lucide-react';
import type { SecurityEvent } from '../../types';
import { OutcomeBadge } from '../common/OutcomeBadge';

interface EventDetailModalProps {
  event: SecurityEvent | null;
  onClose: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!event) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const localTime = new Date(event.timestamp || event.created_at).toLocaleString();
  const utcTime = new Date(event.timestamp || event.created_at).toUTCString();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-[#E4E4E7] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E4E4E7] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#FDE68A] bg-[#FEF3C7] text-[#A16207]">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#18181B]">
                Security Event Inspection
              </h3>
              <p className="font-mono text-[11px] text-[#71717A]">{event.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#71717A] hover:bg-zinc-100 hover:text-[#18181B]"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Top highlight row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[#E4E4E7] bg-zinc-50 p-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#71717A]">
                Event Type
              </span>
              <p className="mt-1 font-mono text-xs font-semibold text-[#18181B]">
                {event.event_type}
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-zinc-50 p-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#71717A]">
                Outcome
              </span>
              <div className="mt-1">
                <OutcomeBadge outcome={event.outcome} />
              </div>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-zinc-50 p-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#71717A]">
                Source IP
              </span>
              <p className="mt-1 font-mono text-xs text-[#18181B]">
                {event.source_ip || 'None'}
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-zinc-50 p-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#71717A]">
                User
              </span>
              <p className="mt-1 font-mono text-xs text-[#18181B]">
                {event.username || 'None'}
              </p>
            </div>
          </div>

          {/* Detailed Context */}
          <div className="rounded-lg border border-[#E4E4E7] bg-zinc-50 p-4 space-y-2.5 text-xs">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">
              Event Context & Environment
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex items-center gap-2 text-[#18181B]">
                <User className="h-4 w-4 text-[#71717A] shrink-0" />
                <span className="text-[#71717A]">Subject:</span>
                <span className="font-mono text-[#18181B] font-medium">{event.username || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-[#18181B]">
                <Globe className="h-4 w-4 text-[#71717A] shrink-0" />
                <span className="text-[#71717A]">Network IP:</span>
                <span className="font-mono text-[#18181B] font-medium">{event.source_ip || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-[#18181B]">
                <Monitor className="h-4 w-4 text-[#71717A] shrink-0" />
                <span className="text-[#71717A]">Asset ID:</span>
                <span className="font-mono text-[#18181B] font-medium">{event.asset_id || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-[#18181B]">
                <Shield className="h-4 w-4 text-[#71717A] shrink-0" />
                <span className="text-[#71717A]">Event Class:</span>
                <span className="font-mono text-[#18181B] font-medium">{event.event_type}</span>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="rounded-lg border border-[#E4E4E7] bg-zinc-50 p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 text-[#71717A] font-semibold uppercase text-[10px] tracking-wider">
              <Clock className="h-3.5 w-3.5 text-[#A16207]" />
              <span>Timestamps</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#18181B]">
              <div>
                <span className="text-[#71717A]">Event Time (UTC): </span>
                <span className="font-mono font-medium">{utcTime}</span>
              </div>
              <div>
                <span className="text-[#71717A]">Local Browser Time: </span>
                <span className="font-mono font-medium">{localTime}</span>
              </div>
              <div>
                <span className="text-[#71717A]">Ingested At: </span>
                <span className="font-mono font-medium">{new Date(event.created_at).toUTCString()}</span>
              </div>
            </div>
          </div>

          {/* Structured Metadata (JSON) */}
          <div className="rounded-lg border border-[#E4E4E7] bg-zinc-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71717A]">
                Raw Metadata Payload
              </span>
              <button
                onClick={handleCopyJson}
                className="flex items-center gap-1 rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1 text-[11px] font-medium text-[#18181B] shadow-xs hover:border-[#FACC15] hover:bg-[#FEF3C7]"
              >
                {copied ? <Check className="h-3 w-3 text-[#15803D]" /> : <Copy className="h-3 w-3 text-[#71717A]" />}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="max-h-48 overflow-auto rounded-md bg-zinc-900 p-3 font-mono text-[11px] text-zinc-100 leading-relaxed border border-zinc-800">
              {JSON.stringify(event.metadata, null, 2)}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[#E4E4E7] px-6 py-3 bg-white">
          <button
            onClick={onClose}
            className="rounded-lg border border-[#E4E4E7] bg-white px-4 py-1.5 text-xs font-medium text-[#18181B] shadow-xs hover:bg-zinc-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
