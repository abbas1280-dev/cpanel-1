import React from 'react';
import { ServiceItem, ServerMetrics } from '../types';

interface CustomCPanelDashboardProps {
  initialService?: ServiceItem;
  allServices: ServiceItem[];
  onExit: () => void;
  serverMetrics?: ServerMetrics | null;
  onOpenFileManager?: (service: ServiceItem) => void;
  onOpenDomains?: (service: ServiceItem) => void;
  onOpenDatabases?: (service: ServiceItem, initialTab?: string) => void;
}

export const CustomCPanelDashboard: React.FC<CustomCPanelDashboardProps> = ({
  initialService,
  allServices,
  onExit
}) => {
  const activeDomain = initialService?.domain || (allServices.length > 0 ? allServices[0].domain : 'turkyhub.com');

  return (
    <div className="fixed inset-0 z-50 bg-[#f8fafc] flex flex-col h-screen w-screen overflow-hidden">
      {/* Top Banner to easily return to Client Area */}
      <div className="bg-[#1e1740] text-white px-4 py-2 flex items-center justify-between text-xs font-semibold border-b border-indigo-950/40 select-none shadow-md">
        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="font-bold tracking-wide">
            cPanel Jupiter Live Environment &mdash; <span className="text-orange-400 font-mono">{activeDomain}</span>
          </span>
        </div>
        <button
          onClick={onExit}
          className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
        >
          <span>&larr; Return to Client Portal</span>
        </button>
      </div>

      {/* Embedded 100% Exact cPanel Jupiter HTML Interface */}
      <iframe
        src={`/cpanel.html?domain=${encodeURIComponent(activeDomain)}`}
        className="flex-1 w-full h-full border-0"
        title="cPanel Jupiter Control Panel"
      />
    </div>
  );
};
