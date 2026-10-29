import React from 'react';
import {
  FolderKanban,
  Clock,
  ShieldCheck,
  CheckCircle2,
  CircleDot,
  FileText,
  Users,
  Workflow,
  Sparkles,
} from 'lucide-react';

export const IncidentsPlaceholder: React.FC = () => {
  const roadmapSteps = [
    {
      phase: 'Phase 1',
      title: 'Workspace Architecture & Planning',
      status: 'completed',
      desc: 'Project boundaries, data models, and lightweight SQLite schema designed.',
    },
    {
      phase: 'Phase 2',
      title: 'FastAPI Backend Foundation',
      status: 'completed',
      desc: 'Pydantic validation, structured logging, health checks, and SQLite initialization.',
    },
    {
      phase: 'Phase 3',
      title: 'Event Ingestion & Normalization',
      status: 'completed',
      desc: 'POST /api/v1/events with UTC normalization, schema validation, and retrieval APIs.',
    },
    {
      phase: 'Phase 4',
      title: 'Rule-Based Detection Engine',
      status: 'completed',
      desc: 'NG-AUTH-001 (Brute Force) & NG-AUTH-002 (Account Takeover), fingerprint deduplication.',
    },
    {
      phase: 'Phase 5',
      title: 'React SOC Dashboard',
      status: 'active',
      desc: 'Clean white & yellow SOC dashboard, real-time telemetry, backend integration, alert & event tables.',
    },
    {
      phase: 'Phase 6',
      title: 'Incident Response & Case Management',
      status: 'upcoming',
      desc: 'Alert escalation to incidents, containment status, analyst notes, and remediation timeline.',
    },
  ];

  const plannedFeatures = [
    {
      icon: Workflow,
      title: 'Alert-to-Incident Escalation',
      desc: 'Convert one or multiple correlated alerts into a tracked security case.',
    },
    {
      icon: Users,
      title: 'Analyst Case Assignment',
      desc: 'Designate responsible SOC operator and track containment workflow.',
    },
    {
      icon: FileText,
      title: 'Incident Journal & Timeline',
      desc: 'Chronological timeline of analyst notes, forensic evidence, and resolution summary.',
    },
    {
      icon: ShieldCheck,
      title: 'Remediation Verification',
      desc: 'Verify credential reset, IP block, or system patching before incident closure.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-xl border border-[#FDE68A] bg-[#FEF3C7]/40 p-6 shadow-xs">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-3 py-1 text-xs font-semibold text-[#A16207]">
            <Clock className="h-3.5 w-3.5" />
            <span>Scheduled for Phase 6</span>
          </div>
          <h2 className="mt-3 text-xl font-bold text-[#18181B] sm:text-2xl">
            Incident Response & Case Management
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-[#71717A] leading-relaxed">
            Per the project guidelines, EduSec strictly relies on genuine API contracts without fabricating mock incident data. The incident management lifecycle and case progression engine are scheduled for implementation in <strong>Phase 6</strong>.
          </p>
        </div>
      </div>

      {/* Planned Capabilities */}
      <div>
        <h3 className="text-sm font-semibold text-[#18181B] mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#A16207]" />
          <span>Planned Phase 6 Capabilities</span>
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plannedFeatures.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="rounded-xl border border-[#E4E4E7] bg-white p-4.5 space-y-2 shadow-xs"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#FDE68A] bg-[#FEF3C7] text-[#A16207]">
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className="text-xs font-semibold text-[#18181B]">{feat.title}</h4>
                <p className="text-[11px] text-[#71717A] leading-relaxed">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* EduSec Implementation Progress Roadmap */}
      <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
        <div className="mb-4 flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-[#A16207]" />
          <h3 className="text-sm font-semibold tracking-wide text-[#18181B]">
            EduSec SIEM Development Roadmap
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roadmapSteps.map((step) => {
            const isDone = step.status === 'completed';
            const isActive = step.status === 'active';

            return (
              <div
                key={step.phase}
                className={`relative rounded-lg border p-3.5 transition-all ${
                  isActive
                    ? 'border-2 border-[#FACC15] bg-[#FEF3C7]/30 shadow-xs'
                    : isDone
                    ? 'border-[#E4E4E7] bg-white'
                    : 'border-[#E4E4E7] bg-zinc-50 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${
                      isActive ? 'text-[#A16207]' : isDone ? 'text-emerald-700' : 'text-[#71717A]'
                    }`}
                  >
                    {step.phase}
                  </span>
                  {isDone ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Verified</span>
                    </span>
                  ) : isActive ? (
                    <span className="flex items-center gap-1 text-[10px] text-[#A16207] font-semibold">
                      <CircleDot className="h-3 w-3" />
                      <span>Current Phase</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#71717A]">Pending Approval</span>
                  )}
                </div>

                <h4 className="mt-1 text-xs font-semibold text-[#18181B]">{step.title}</h4>
                <p className="mt-1 text-[11px] text-[#71717A] leading-normal">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
