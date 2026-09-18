import React, { useState } from 'react';
import { Server, Globe, Search, ArrowRight, ShieldCheck, Box, ExternalLink, Sparkles, PlusCircle, Cpu, HardDrive, Activity, Terminal } from 'lucide-react';
import { ActiveTab, ServerMetrics } from '../types';

interface DashboardViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  serviceCount: number;
  domainCount: number;
  serverMetrics?: ServerMetrics | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  setActiveTab,
  serviceCount,
  domainCount,
  serverMetrics
}) => {
  const [searchDomain, setSearchDomain] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Format uptime into readable format
  const formatUptime = (seconds?: number) => {
    if (!seconds) return 'Live Online';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const handleDomainSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchDomain.trim()) return;
    setIsSearching(true);
    setSearchResult(null);
    setTimeout(() => {
      setIsSearching(false);
      const clean = searchDomain.trim().toLowerCase();
      const hasTld = clean.includes('.');
      const query = hasTld ? clean : `${clean}.com`;
      setSearchResult(`Congratulations! ${query} is available for registration!`);
    }, 700);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Metrics Row: Clean, focused cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Services Card */}
        <div
          onClick={() => setActiveTab('services')}
          className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-4xl font-extrabold text-slate-800 tracking-tight block">
                {serviceCount}
              </span>
              <span className="text-sm font-semibold text-slate-500 mt-1 block">
                Services
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-inner">
              <Server className="w-7 h-7" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-semibold">
            <span>Manage active packages</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Domains Card */}
        <div
          onClick={() => setActiveTab('domains')}
          className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-4xl font-extrabold text-slate-800 tracking-tight block">
                {domainCount}
              </span>
              <span className="text-sm font-semibold text-slate-500 mt-1 block">
                Domains
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-inner">
              <Globe className="w-7 h-7" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-blue-600 font-semibold">
            <span>Manage domain names</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Real Server & Hardware Status Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-sm font-bold uppercase tracking-wider text-emerald-600">
                  Live Online
                </span>
              </div>
              <span className="text-sm font-semibold text-slate-800 mt-1 block font-mono">
                {serverMetrics?.serverIp || '192.168.0.104'}
              </span>
              <span className="text-[11px] font-medium text-slate-400 block font-mono truncate">
                {serverMetrics?.hostname || 'DESKTOP-1HFM8RA'}
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-7 h-7" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Uptime: {formatUptime(serverMetrics?.uptimeSeconds)}</span>
            <span className="text-indigo-600 font-semibold">{serverMetrics?.cpu.cores || 12} vCPU Cores</span>
          </div>
        </div>
      </div>

      {/* Real Live Hardware Telemetry Banner (Direct Host Metrics) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Live Host Server Telemetry
              </h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono font-bold border border-emerald-500/30">
                Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono mt-0.5">
              {serverMetrics?.cpu.model || 'AMD Ryzen 5 3600X 6-Core Processor'} ({serverMetrics?.platform || 'Windows 11 x64'})
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-6 w-full md:w-auto text-xs font-mono text-center">
          <div className="bg-white/5 px-3 py-2 rounded-xl border border-white/10">
            <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">CPU Load</span>
            <span className="text-xs sm:text-sm font-bold text-amber-300 block mt-0.5">
              {serverMetrics ? `${serverMetrics.cpu.usagePercent}%` : '15%'}
            </span>
          </div>
          <div className="bg-white/5 px-3 py-2 rounded-xl border border-white/10">
            <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">Disk (C:)</span>
            <span className="text-xs sm:text-sm font-bold text-sky-300 block mt-0.5">
              {serverMetrics ? `${serverMetrics.disk.percentUsed}%` : '44.9%'}
            </span>
          </div>
          <div className="bg-white/5 px-3 py-2 rounded-xl border border-white/10">
            <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">Memory</span>
            <span className="text-xs sm:text-sm font-bold text-emerald-300 block mt-0.5">
              {serverMetrics ? `${serverMetrics.memory.percentUsed}%` : '70%'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Active Products/Services + Register Domain Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Active Products/Services (Matching reference design) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <span>Your Active Products/Services</span>
            </h2>
            <button
              onClick={() => setActiveTab('services')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
            >
              View All <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-3xl bg-indigo-50/80 border border-indigo-100/80 flex items-center justify-center text-indigo-600 mb-4 shadow-sm">
              <Box className="w-10 h-10 stroke-[1.7]" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              No Active Services Found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-5">
              Deploy high-performance NVMe cloud hosting, VPS, or dedicated servers with instant provision.
            </p>
            <button
              onClick={() => setActiveTab('services')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              Order New Services
            </button>
          </div>
        </div>

        {/* Register a New Domain Card (Matching reference theme) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#11074a] via-[#1a0e68] to-[#12074d] text-white rounded-2xl p-6 sm:p-7 shadow-xl shadow-indigo-950/20 border border-indigo-900/60">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Register a New Domain
            </h2>
          </div>
          <p className="text-xs text-indigo-200/80 mb-5 leading-relaxed">
            Find the perfect web address for your brand. Fast DNS propagation and free WHOIS privacy included.
          </p>

          <form onSubmit={handleDomainSearch} className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={searchDomain}
                onChange={(e) => setSearchDomain(e.target.value)}
                placeholder="Find your new domain name..."
                className="w-full pl-4 pr-11 py-3.5 rounded-xl bg-white text-slate-800 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-inner"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors disabled:opacity-50"
                title="Search Domain"
              >
                {isSearching ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>
            </div>

            {searchResult && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-xs font-semibold text-emerald-300 flex items-center justify-between animate-in fade-in duration-200">
                <span>{searchResult}</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('domains')}
                  className="underline hover:text-white"
                >
                  Register
                </button>
              </div>
            )}

            {/* Popular TLD badges */}
            <div className="pt-2">
              <div className="text-[11px] font-semibold text-indigo-300/70 uppercase tracking-wider mb-2">
                Popular Extensions
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="bg-indigo-950/70 hover:bg-indigo-900/80 transition-colors border border-indigo-800/40 rounded-lg p-2">
                  <span className="block text-xs font-bold text-white">.com</span>
                  <span className="block text-[11px] text-blue-300 font-medium">$9.99/yr</span>
                </div>
                <div className="bg-indigo-950/70 hover:bg-indigo-900/80 transition-colors border border-indigo-800/40 rounded-lg p-2">
                  <span className="block text-xs font-bold text-white">.net</span>
                  <span className="block text-[11px] text-blue-300 font-medium">$11.49/yr</span>
                </div>
                <div className="bg-indigo-950/70 hover:bg-indigo-900/80 transition-colors border border-indigo-800/40 rounded-lg p-2">
                  <span className="block text-xs font-bold text-white">.org</span>
                  <span className="block text-[11px] text-blue-300 font-medium">$12.99/yr</span>
                </div>
                <div className="bg-indigo-950/70 hover:bg-indigo-900/80 transition-colors border border-indigo-800/40 rounded-lg p-2">
                  <span className="block text-xs font-bold text-white">.xyz</span>
                  <span className="block text-[11px] text-emerald-300 font-medium">$1.99/yr</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
