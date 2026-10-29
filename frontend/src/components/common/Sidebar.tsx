import React from 'react';
import {
  LayoutDashboard,
  Terminal,
  AlertTriangle,
  FolderKanban,
  Shield,
  Radio,
  X,
} from 'lucide-react';
import type { NavigationTab } from '../../types';

interface SidebarProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  backendOnline: boolean;
  alertsCount?: number;
  incidentsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  mobileOpen,
  onMobileClose,
  backendOnline,
  alertsCount = 0,
  incidentsCount = 0,
}) => {
  const navItems = [
    {
      id: 'overview' as NavigationTab,
      label: 'SOC Overview',
      icon: LayoutDashboard,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'events' as NavigationTab,
      label: 'Security Events',
      icon: Terminal,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'alerts' as NavigationTab,
      label: 'Alerts & Detections',
      icon: AlertTriangle,
      badge: alertsCount > 0 ? String(alertsCount) : null,
      badgeColor: 'bg-red-50 text-red-700 border border-red-200',
    },
    {
      id: 'incidents' as NavigationTab,
      label: 'Incident Response',
      icon: FolderKanban,
      badge: incidentsCount > 0 ? String(incidentsCount) : 'Active',
      badgeColor: 'bg-amber-50 text-amber-800 border border-amber-200',
    },
  ];


  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-[#E4E4E7] bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-[#E4E4E7] px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#FACC15] bg-[#FEF3C7] text-[#A16207]">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold tracking-wider text-[#18181B]">
                <span>EDUSEC</span>
                <span className="rounded-xs border border-[#FDE68A] bg-[#FEF3C7] px-1 py-0.5 text-[10px] font-semibold text-[#A16207]">
                  SIEM
                </span>
              </div>
              <p className="text-[11px] text-[#71717A]">Security Operations</p>
            </div>
          </div>
          <button
            onClick={onMobileClose}
            className="rounded-lg p-1 text-[#71717A] hover:bg-zinc-100 hover:text-[#18181B] lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1 p-3">
          <div className="px-3 py-2 text-[10px] font-semibold tracking-wider text-[#71717A] uppercase">
            Monitoring & Response
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  onMobileClose();
                }}
                className={`group flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'border-l-4 border-[#FACC15] bg-[#FEF3C7] text-[#18181B] font-semibold'
                    : 'text-[#71717A] hover:bg-zinc-100 hover:text-[#18181B]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive ? 'text-[#A16207]' : 'text-[#71717A] group-hover:text-[#18181B]'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      item.badgeColor || 'bg-zinc-100 text-[#71717A]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Telemetry Status Footer */}
        <div className="border-t border-[#E4E4E7] bg-white p-3.5">
          <div className="flex items-center justify-between rounded-lg border border-[#E4E4E7] bg-zinc-50 p-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {backendOnline && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                    backendOnline ? 'bg-emerald-600' : 'bg-red-600'
                  }`}
                />
              </span>
              <div>
                <p className="text-[11px] font-medium text-[#18181B]">
                  {backendOnline ? 'SIEM Engine Online' : 'Backend Offline'}
                </p>
                <p className="text-[10px] text-[#71717A]">127.0.0.1:8080</p>
              </div>
            </div>
            <Radio className={`h-4 w-4 ${backendOnline ? 'text-emerald-600' : 'text-red-600'}`} />
          </div>
          <p className="mt-2 text-center text-[10px] text-[#71717A]">EduSec v0.1.0 • Academic SIEM</p>
        </div>
      </aside>
    </>
  );
};
