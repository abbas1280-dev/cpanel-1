import React from 'react';
import { ServiceItem, ServerMetrics, DomainSubTab } from '../types';

interface CustomCPanelDashboardProps {
  initialService?: ServiceItem;
  allServices: ServiceItem[];
  onExit: () => void;
  serverMetrics?: ServerMetrics | null;
  onOpenFileManager?: (service: ServiceItem) => void;
  onOpenDomains?: (service: ServiceItem, initialTab?: DomainSubTab) => void;
  onOpenDatabases?: (service: ServiceItem, initialTab?: string) => void;
}

export const CustomCPanelDashboard: React.FC<CustomCPanelDashboardProps> = ({
  initialService,
  allServices,
  onExit,
  serverMetrics,
  onOpenFileManager,
  onOpenDomains,
  onOpenDatabases
}) => {
  const activeDomain = initialService?.domain || (allServices.length > 0 ? allServices[0].domain : 'turkyhub.com');

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.type === 'OPEN_FILEMANAGER') {
        const targetDomain = event.data.domain || activeDomain;
        const targetService: ServiceItem = allServices.find(s => s.domain === targetDomain) || initialService || {
          id: 'srv-' + targetDomain,
          product: 'Premium cPanel Hosting',
          domain: targetDomain,
          pricing: '$9.99/mo',
          billingCycle: 'Monthly',
          nextDueDate: '2027-01-01',
          status: 'Active',
          serverIp: '127.0.0.1'
        };
        if (onOpenFileManager) {
          onOpenFileManager(targetService);
        }
      } else if (event.data.type === 'OPEN_DOMAINS') {
        const targetDomain = event.data.domain || activeDomain;
        const targetService = allServices.find(s => s.domain === targetDomain) || initialService;
        if (targetService && onOpenDomains) {
          onOpenDomains(targetService, event.data.tab as DomainSubTab);
        }
      } else if (event.data.type === 'OPEN_DATABASES') {
        const targetDomain = event.data.domain || activeDomain;
        const targetService = allServices.find(s => s.domain === targetDomain) || initialService;
        if (targetService && onOpenDatabases) {
          onOpenDatabases(targetService, event.data.tab);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeDomain, allServices, initialService, onOpenFileManager, onOpenDomains, onOpenDatabases]);

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
        <div className="flex items-center gap-2">
          {onOpenFileManager && (
            <button
              onClick={() => {
                const srv = allServices.find(s => s.domain === activeDomain) || initialService;
                if (srv) onOpenFileManager(srv);
              }}
              className="px-3 py-1.5 bg-orange-500/90 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold shadow-sm"
              title="Open cPanel File Manager"
            >
              <span>📁 File Manager</span>
            </button>
          )}
          <button
            onClick={onExit}
            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
          >
            <span>&larr; Return to Client Portal</span>
          </button>
        </div>
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
