import React from 'react';
import { LayoutDashboard, Server, Globe, User, ShieldCheck, Settings } from 'lucide-react';
import { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  domainsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isMobileOpen,
  setIsMobileOpen,
  domainsCount
}) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'services',
      label: 'My Services',
      icon: <Server className="w-5 h-5" />,
    },
    {
      id: 'domains',
      label: 'My Domains',
      icon: <Globe className="w-5 h-5" />,
      badge: domainsCount && domainsCount > 0 ? String(domainsCount) : undefined,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#11074a] text-slate-100 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } shadow-xl lg:shadow-none`}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center px-6 border-b border-indigo-950/80 bg-[#0e063d]">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-blue-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20M2 12h20" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-0.5">
                HOSTER 1280
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-indigo-300/70">
                Client Portal
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-indigo-300/60">
            Navigation
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-[#22157d] text-white shadow-md shadow-indigo-950/40 border-l-4 border-blue-400 font-semibold'
                    : 'text-indigo-100/80 hover:bg-[#1c106b] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`transition-transform duration-200 ${isActive ? 'text-blue-300' : 'text-indigo-300 group-hover:text-white'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    isActive ? 'bg-blue-500 text-white' : 'bg-indigo-900/80 text-indigo-200 group-hover:bg-indigo-800'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-6 px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-indigo-300/60">
            Account Management
          </div>

          <button
            onClick={() => {
              setActiveTab('profile');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-sm font-medium transition-all group ${
              activeTab === 'profile'
                ? 'bg-[#22157d] text-white shadow-md shadow-indigo-950/40 border-l-4 border-blue-400 font-semibold'
                : 'text-indigo-100/80 hover:bg-[#1c106b] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`transition-transform duration-200 ${activeTab === 'profile' ? 'text-blue-300' : 'text-indigo-300 group-hover:text-white'}`}>
                <User className="w-5 h-5" />
              </span>
              <span>Account Profile</span>
            </div>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              Active
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('settings');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-sm font-medium transition-all group ${
              activeTab === 'settings'
                ? 'bg-[#22157d] text-white shadow-md shadow-indigo-950/40 border-l-4 border-blue-400 font-semibold'
                : 'text-indigo-100/80 hover:bg-[#1c106b] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`transition-transform duration-200 ${activeTab === 'settings' ? 'text-blue-300' : 'text-indigo-300 group-hover:text-white'}`}>
                <Settings className="w-5 h-5" />
              </span>
              <span>General Settings</span>
            </div>
          </button>
        </div>

        {/* System Health / Status Indicator footer in sidebar */}
        <div className="p-4 mx-3 mb-4 rounded-xl bg-indigo-950/60 border border-indigo-800/40">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> All Systems Online
            </span>
          </div>
          <p className="text-[11px] text-indigo-300/70">
            DNS & Cloud hosting running smoothly
          </p>
        </div>
      </aside>
    </>
  );
};
