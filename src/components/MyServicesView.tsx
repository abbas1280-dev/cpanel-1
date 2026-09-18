import React, { useState, useMemo } from 'react';
import {
  Server,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cpu,
  HardDrive,
  Globe,
  ArrowRight,
  ExternalLink,
  Shield,
  Layers,
  Check,
  Copy,
  Lock,
  Database,
  FolderTree,
  Mail,
  Terminal,
  Sparkles,
  X,
  Search,
  MoreHorizontal,
  ShoppingBag,
  SlidersHorizontal,
  ChevronDown,
  Info,
  Activity,
  Calendar,
  KeyRound,
  Eye
} from 'lucide-react';
import { ServiceItem, DomainItem, ServerMetrics } from '../types';
import { ProductDetailsView } from './ProductDetailsView';

interface MyServicesViewProps {
  services: ServiceItem[];
  domains: DomainItem[];
  onAddService: (newService: ServiceItem) => void;
  onOpenFullCpanel?: (newService: ServiceItem) => void;
  serverMetrics?: ServerMetrics | null;
}

type ProvisioningStage = 'idle' | 'provisioning' | 'completed';

export const MyServicesView: React.FC<MyServicesViewProps> = ({
  services,
  domains,
  onAddService,
  onOpenFullCpanel,
  serverMetrics
}) => {
  // Navigation: Product Details View State
  const [viewingProductDetails, setViewingProductDetails] = useState<ServiceItem | null>(null);

  // Navigation / View State: toggle between list and Add New domain form
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [domainOption, setDomainOption] = useState<'register' | 'transfer' | 'existing'>('existing');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Entries');
  const [entriesPerPage, setEntriesPerPage] = useState(10);

  // Domain input form states
  const [domainNamePart, setDomainNamePart] = useState('example');
  const [tldPart, setTldPart] = useState('com');

  // Automated cPanel provisioning state
  const [provisionStage, setProvisionStage] = useState<ProvisioningStage>('idle');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [createdCpanelInfo, setCreatedCpanelInfo] = useState<{
    domain: string;
    username: string;
    password: string;
    ip: string;
    cpanelUrl: string;
  } | null>(null);

  // Three dots (...) Domain Details Modal
  const [selectedServiceDetail, setSelectedServiceDetail] = useState<ServiceItem | null>(null);

  // Simulated cPanel interactive modal
  const [activeCpanelModal, setActiveCpanelModal] = useState<ServiceItem | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  const handleLaunchPma = async (domain: string) => {
    try {
      const res = await fetch('/api/pma-sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      });
      const data = await res.json();
      const redirectUrl = data.redirectUrl || data.ssoUrl;
      if (redirectUrl) {
        window.open(redirectUrl, '_blank');
      } else {
        alert('Could not start phpMyAdmin session: ' + (data.error || 'Server returned empty redirect'));
      }
    } catch (err: any) {
      alert('Failed to launch phpMyAdmin: ' + (err.message || String(err)));
    }
  };

  // Addons modal
  const [showAddonsModal, setShowAddonsModal] = useState(false);

  const provisioningSteps = [
    'Allocating Server Node in Shared Cloud Pool...',
    'Creating cPanel user account & assigning shared resources...',
    'Configuring DNS Zone & Nameservers (ns1.sitechai.com, ns2.sitechai.com)...',
    'Issuing Let\'s Encrypt AutoSSL certificate...',
    'Finalizing web server virtual hosts & cPanel access...'
  ];

  // When user selects a domain from existing domains dropdown
  const handleSelectExistingDomain = (fullDomain: string) => {
    const parts = fullDomain.split('.');
    if (parts.length >= 2) {
      setDomainNamePart(parts[0]);
      setTldPart(parts.slice(1).join('.'));
    } else {
      setDomainNamePart(fullDomain);
    }
  };

  // Trigger automated cPanel creation
  const handleUseDomain = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDomain = `${domainNamePart.trim().replace(/\./g, '')}.${tldPart.trim().replace(/\./g, '')}`.toLowerCase();
    if (!cleanDomain || cleanDomain.startsWith('.')) return;

    setProvisionStage('provisioning');
    setCurrentStepIndex(0);

    const realServerIp = serverMetrics?.serverIp || '192.168.0.104';
    const generatedUsername = `${domainNamePart.slice(0, 7).replace(/[^a-zA-Z0-9]/g, '')}1`.toLowerCase();
    const generatedPassword = `Sec#${Math.random().toString(36).slice(-6)}!2026`;

    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < provisioningSteps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setProvisionStage('completed');

          const newService: ServiceItem = {
            id: 'srv-' + Date.now().toString().slice(-4),
            product: 'Shared Cloud Hosting',
            domain: cleanDomain,
            pricing: '', // Price removed per requirement
            billingCycle: 'Annual',
            nextDueDate: 'Friday, October 16th, 2026',
            status: 'Active',
            serverIp: realServerIp
          };

          setCreatedCpanelInfo({
            domain: cleanDomain,
            username: generatedUsername,
            password: generatedPassword,
            ip: realServerIp,
            cpanelUrl: `https://cpanel.${cleanDomain}`
          });

          onAddService(newService);
          return prev;
        }
      });
    }, 650);
  };

  const copyPassword = () => {
    if (createdCpanelInfo?.password) {
      navigator.clipboard.writeText(createdCpanelInfo.password);
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  // Filtered services list
  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      const matchesSearch =
        srv.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
        srv.product.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'All Entries' || srv.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [services, searchTerm, statusFilter]);

  const renderCpanelModal = () => {
    if (!activeCpanelModal) return null;
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 text-slate-100 rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-800 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ff6c2c] text-white flex items-center justify-center font-extrabold text-sm shadow-md">
                cP
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  cPanel Control Panel
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Live
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {activeCpanelModal.domain} ({activeCpanelModal.serverIp})
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveCpanelModal(null)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60">
              <span className="text-[11px] text-slate-400 block">Server Pool Storage</span>
              <span className="text-sm font-bold text-white block mt-0.5">Shared / 100 GB</span>
              <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-indigo-500 h-full w-[12%]"></div>
              </div>
            </div>
            <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60">
              <span className="text-[11px] text-slate-400 block">MySQL Databases</span>
              <span className="text-sm font-bold text-white block mt-0.5">1 / Unlimited</span>
              <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-emerald-500 h-full w-[10%]"></div>
              </div>
            </div>
            <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60">
              <span className="text-[11px] text-slate-400 block">Email Accounts</span>
              <span className="text-sm font-bold text-white block mt-0.5">2 / Unlimited</span>
              <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-blue-500 h-full w-[15%]"></div>
              </div>
            </div>
            <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60">
              <span className="text-[11px] text-slate-400 block">AutoSSL Status</span>
              <span className="text-sm font-bold text-emerald-400 block mt-0.5 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> Active
              </span>
              <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-emerald-400 h-full w-full"></div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Common cPanel Tools
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                onClick={() => alert(`Launching File Manager for ${activeCpanelModal.domain}`)}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <FolderTree className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block group-hover:text-amber-300">File Manager</span>
                  <span className="text-[10px] text-slate-400">public_html</span>
                </div>
              </button>

              <button
                onClick={() => handleLaunchPma(activeCpanelModal.domain)}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block group-hover:text-orange-300">phpMyAdmin</span>
                  <span className="text-[10px] text-slate-400">MySQL Admin</span>
                </div>
              </button>

              <button
                onClick={() => alert(`Managing Email Accounts for ${activeCpanelModal.domain}`)}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block group-hover:text-blue-300">Email Accounts</span>
                  <span className="text-[10px] text-slate-400">Webmail & IMAP</span>
                </div>
              </button>

              <button
                onClick={() => alert(`Opening SSH Web Terminal for ${activeCpanelModal.domain}`)}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block group-hover:text-emerald-300">Terminal</span>
                  <span className="text-[10px] text-slate-400">Bash / SSH</span>
                </div>
              </button>

              <button
                onClick={() => alert(`WordPress 1-Click Softaculous installer for ${activeCpanelModal.domain}`)}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block group-hover:text-indigo-300">WordPress</span>
                  <span className="text-[10px] text-slate-400">1-Click Auto Install</span>
                </div>
              </button>

              <button
                onClick={() => alert(`SSL/TLS certificates manager for ${activeCpanelModal.domain}`)}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block group-hover:text-teal-300">SSL/TLS Status</span>
                  <span className="text-[10px] text-slate-400">HTTPS Certificate</span>
                </div>
              </button>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => setActiveCpanelModal(null)}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
            >
              Close cPanel Session
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (viewingProductDetails) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <ProductDetailsView
          service={viewingProductDetails}
          onBack={() => setViewingProductDetails(null)}
          onOpenCpanel={(srv) => {
            if (onOpenFullCpanel) onOpenFullCpanel(srv);
            else setActiveCpanelModal(srv);
          }}
          serverMetrics={serverMetrics}
        />
        {renderCpanelModal()}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Title & Controls (Matching Screenshot) */}
      {!showDomainForm && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              My Products & Services
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Portal Home / Client Area / <span className="text-slate-800">My Products & Services</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input matching screenshot */}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Enter search term..."
                className="w-56 sm:w-64 pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 placeholder:text-slate-400 font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            {/* + Add New Button matching screenshot */}
            <button
              onClick={() => {
                setShowDomainForm(true);
                setProvisionStage('idle');
                setDomainOption('existing');
                if (domains.length > 0) {
                  handleSelectExistingDomain(domains[0].domainName);
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add New
            </button>
          </div>
        </div>
      )}

      {/* Shared Server Resource Pool Information Card */}
      {!showDomainForm && (
        <div className="bg-gradient-to-r from-[#11074a] via-[#1a1063] to-[#251582] text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-indigo-950 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-blue-300 shrink-0 border border-white/10">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight">Shared Host Server Resource Pool</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Host Pool Active
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                প্রতিটি ডোমেইনের জন্য কৃত্রিম সীমা নেই—হোস্ট সার্ভারের মোট রিসোর্স ({serverMetrics?.disk.totalGB || '476.3'} GB NVMe Storage, {serverMetrics?.cpu.cores || 12} Cores {serverMetrics?.cpu.model || 'AMD Ryzen'}, IP: {serverMetrics?.serverIp || '192.168.0.104'}) সকল ডোমেইনের মাঝে গতিশীলভাবে ভাগ হয়ে কাজ করে।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-indigo-200/90 shrink-0 bg-white/5 px-4 py-2.5 rounded-xl border border-white/10">
            <div>
              <span className="block text-[10px] text-indigo-300/70 uppercase font-bold">Total Storage</span>
              <span className="font-bold text-white text-sm">{serverMetrics?.disk.totalGB || '476.3'} GB</span>
            </div>
            <div className="w-px h-7 bg-white/10"></div>
            <div>
              <span className="block text-[10px] text-indigo-300/70 uppercase font-bold">Server IP</span>
              <span className="font-bold text-sky-400 text-sm font-mono">{serverMetrics?.serverIp || '192.168.0.104'}</span>
            </div>
            <div className="w-px h-7 bg-white/10"></div>
            <div>
              <span className="block text-[10px] text-indigo-300/70 uppercase font-bold">Connected</span>
              <span className="font-bold text-emerald-400 text-sm">{services.length} Domains</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CHOOSE A DOMAIN FORM (MATCHING PREVIOUS USER SCREENSHOT) */}
      {/* ========================================================================= */}
      {showDomainForm && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowDomainForm(false)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 transition-colors"
            >
              ← Back to My Products & Services
            </button>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
              New Domain Service Provisioning
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-10 pb-6 border-b border-slate-100">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Choose a Domain...
              </h1>
              <p className="text-sm text-slate-500 mt-1 font-medium">
                Selected Product: <span className="font-bold text-slate-700">Shared Cloud Hosting (Dynamic Resource Pool)</span>
              </p>
            </div>

            <div className="p-6 sm:p-10 pt-6 space-y-4">
              <label className="flex items-center gap-3.5 cursor-pointer text-slate-700 font-medium text-sm group">
                <input
                  type="radio"
                  name="domainOption"
                  checked={domainOption === 'register'}
                  onChange={() => setDomainOption('register')}
                  className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                <span className="group-hover:text-slate-900">Register a new domain</span>
              </label>

              <label className="flex items-center gap-3.5 cursor-pointer text-slate-700 font-medium text-sm group">
                <input
                  type="radio"
                  name="domainOption"
                  checked={domainOption === 'transfer'}
                  onChange={() => setDomainOption('transfer')}
                  className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                <span className="group-hover:text-slate-900">Transfer your domain from another registrar</span>
              </label>

              <label className="flex items-center gap-3.5 cursor-pointer text-slate-900 font-semibold text-sm group">
                <input
                  type="radio"
                  name="domainOption"
                  checked={domainOption === 'existing'}
                  onChange={() => setDomainOption('existing')}
                  className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                <span>I will use my existing domain and update my nameservers</span>
              </label>

              {domainOption === 'existing' && domains.length > 0 && (
                <div className="pt-2 pl-7 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">Quick select existing domain:</span>
                  {domains.map((dom) => (
                    <button
                      key={dom.id}
                      type="button"
                      onClick={() => handleSelectExistingDomain(dom.domainName)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60 transition-colors"
                    >
                      {dom.domainName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#11074a] p-6 sm:p-8">
              <form onSubmit={handleUseDomain} className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-3">
                <div className="w-full sm:flex-[3]">
                  <input
                    type="text"
                    required
                    value={domainNamePart}
                    onChange={(e) => setDomainNamePart(e.target.value)}
                    placeholder="example"
                    className="w-full px-4 py-3 bg-white text-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-400"
                  />
                </div>

                <div className="w-full sm:w-28">
                  <input
                    type="text"
                    required
                    value={tldPart}
                    onChange={(e) => setTldPart(e.target.value)}
                    placeholder="com"
                    className="w-full px-4 py-3 bg-white text-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={provisionStage === 'provisioning'}
                  className="w-full sm:w-auto px-8 py-3 bg-[#0d0538] hover:bg-[#1a0f63] text-white font-bold text-sm rounded-lg transition-colors border border-indigo-900/80 shadow-md active:scale-95 disabled:opacity-50"
                >
                  Use
                </button>
              </form>
            </div>
          </div>

          {/* Automated Provisioning Wizard */}
          {provisionStage === 'provisioning' && (
            <div className="bg-white rounded-2xl border border-indigo-200 p-8 shadow-xl max-w-2xl mx-auto animate-in fade-in duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center animate-spin">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    Automated cPanel Provisioning in Progress
                  </h3>
                  <p className="text-xs text-slate-500">
                    Connecting Domain: <span className="font-semibold text-indigo-600">{domainNamePart}.{tldPart}</span> to Shared Resource Pool
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {provisioningSteps.map((stepText, idx) => {
                  const isDone = idx < currentStepIndex;
                  const isCurrent = idx === currentStepIndex;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-xl text-xs font-semibold transition-all ${
                        isDone
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : isCurrent
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 ring-2 ring-indigo-500/20'
                          : 'text-slate-400 bg-slate-50'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : isCurrent ? (
                        <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                      )}
                      <span>{stepText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed Notification Card */}
          {provisionStage === 'completed' && createdCpanelInfo && (
            <div className="bg-white rounded-2xl border-2 border-emerald-500 p-8 shadow-xl max-w-2xl mx-auto animate-in zoom-in-95 duration-200">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3 ring-8 ring-emerald-50">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-800">
                  cPanel Successfully Created & Connected!
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Domain <span className="font-bold text-slate-800">{createdCpanelInfo.domain}</span> is now active under Shared Resource Pool.
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2.5 text-xs font-medium mb-6">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">Domain Name:</span>
                  <span className="font-bold text-slate-800">{createdCpanelInfo.domain}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">cPanel Username:</span>
                  <span className="font-mono font-bold text-indigo-700">{createdCpanelInfo.username}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">cPanel Password:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800">{createdCpanelInfo.password}</span>
                    <button
                      onClick={copyPassword}
                      className="p-1 text-indigo-600 hover:text-indigo-800"
                      title="Copy password"
                    >
                      {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">Server Dedicated IP:</span>
                  <span className="font-mono text-slate-800 font-semibold">{createdCpanelInfo.ip}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Nameservers:</span>
                  <span className="font-mono text-slate-700">ns1.sitechai.com / ns2.sitechai.com</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={() => {
                    const matched = services.find(s => s.domain === createdCpanelInfo.domain) || {
                      id: 'srv-now',
                      product: 'Shared Cloud Hosting',
                      domain: createdCpanelInfo.domain,
                      pricing: '',
                      billingCycle: 'Annual',
                      nextDueDate: 'Friday, October 16th, 2026',
                      status: 'Active',
                      serverIp: createdCpanelInfo.ip
                    };
                    setActiveCpanelModal(matched);
                  }}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#ff6c2c] hover:bg-[#e05b20] text-white font-bold text-xs shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  <ExternalLink className="w-4 h-4" /> Open cPanel Dashboard
                </button>
                <button
                  onClick={() => {
                    setShowDomainForm(false);
                    setProvisionStage('idle');
                  }}
                  className="w-full sm:w-auto py-3 px-5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors"
                >
                  Back to Products & Services Table
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN PRODUCTS & SERVICES TABLE WITH ACTIONS (MATCHING SCREENSHOT) */}
      {/* ========================================================================= */}
      {!showDomainForm && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Actions Sub-panel matching screenshot */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">
                Actions
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setShowDomainForm(true);
                    setProvisionStage('idle');
                    setDomainOption('existing');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors text-left"
                >
                  <ShoppingBag className="w-4 h-4 text-indigo-600" />
                  Place a New Order
                </button>
                <button
                  onClick={() => setShowAddonsModal(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors text-left"
                >
                  <Layers className="w-4 h-4 text-indigo-600" />
                  View Available Addons
                </button>
              </div>
            </div>

            {/* Quick Server Health Summary */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-xs font-bold text-slate-700">Cluster Status</span>
              </div>
              <p className="text-xs text-slate-500">
                All cloud hypervisors and DNS nodes operational.
              </p>
            </div>
          </div>

          {/* Right Main Table Card */}
          <div className="lg:col-span-9 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {/* Table Header Filter (View All Entries) */}
            <div className="px-6 py-3.5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span>View</span>
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="appearance-none bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
                  >
                    <option>All Entries</option>
                    <option>Active</option>
                    <option>Terminated</option>
                    <option>Cancelled</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2 pointer-events-none" />
                </div>
              </div>

              <div className="text-xs text-slate-400 font-medium">
                Total: {filteredServices.length} Records
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-6">Product/Service ⇅</th>
                    {/* Pricing column is REMOVED as requested */}
                    <th className="py-3.5 px-6">Next Due Date ⇅</th>
                    <th className="py-3.5 px-6">Status ⇅</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredServices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400 text-xs">
                        No products or services found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredServices.map((srv) => {
                      const isTerminated = srv.status === 'Terminated';
                      const isCancelled = srv.status === 'Cancelled';
                      const isActive = srv.status === 'Active';

                      return (
                        <tr
                          key={srv.id}
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                          onClick={() => setSelectedServiceDetail(srv)}
                        >
                          {/* Product / Service & Domain Name (No individual GB limit shown) */}
                          <td className="py-4 px-6">
                            <div className="font-bold text-slate-900 text-sm">
                              {srv.product.includes('Hosting') ? 'Shared Cloud Hosting' : srv.product}
                            </div>
                            <div className="text-xs text-indigo-600 font-semibold mt-0.5 flex items-center gap-1">
                              <Globe className="w-3.5 h-3.5 text-indigo-400" />
                              {srv.domain}
                            </div>
                          </td>

                          {/* Next Due Date */}
                          <td className="py-4 px-6 text-xs text-slate-600 font-medium">
                            {srv.nextDueDate}
                          </td>

                          {/* Status with dot indicator matching screenshot */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isActive
                                    ? 'bg-emerald-500'
                                    : isCancelled
                                    ? 'bg-amber-500'
                                    : 'bg-slate-400'
                                }`}
                              />
                              <span
                                className={`text-xs font-semibold ${
                                  isActive
                                    ? 'text-emerald-700'
                                    : isCancelled
                                    ? 'text-amber-700'
                                    : 'text-slate-500'
                                }`}
                              >
                                {srv.status}
                              </span>
                            </div>
                          </td>

                          {/* Actions Three Dots Column */}
                          <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedServiceDetail(srv)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="View Domain Details & Actions"
                            >
                              <MoreHorizontal className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer: Show Entries & Pagination */}
            <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>Show</span>
                <select
                  value={entriesPerPage}
                  onChange={(e) => setEntriesPerPage(Number(e.target.value))}
                  className="border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 bg-white"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span>entries</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  disabled
                  className="px-3 py-1 rounded-lg border border-slate-200 text-slate-400 cursor-not-allowed text-xs font-medium"
                >
                  Previous
                </button>
                <button className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-sm">
                  1
                </button>
                <button
                  disabled
                  className="px-3 py-1 rounded-lg border border-slate-200 text-slate-400 cursor-not-allowed text-xs font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* THREE DOTS (...) DOMAIN DETAILS MODAL (READY FOR FUTURE CUSTOM INSTRUCTIONS) */}
      {/* ========================================================================= */}
      {selectedServiceDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    {selectedServiceDetail.domain}
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    Service ID: {selectedServiceDetail.id}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedServiceDetail(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Service & Domain Details Grid */}
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Domain Name:</span>
                  <span className="font-bold text-slate-800">{selectedServiceDetail.domain}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Resource Policy:</span>
                  <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/50">
                    Shared Server Resource Pool (No Individual Limit)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Dedicated Server IP:</span>
                  <span className="font-mono text-slate-800 font-semibold">{serverMetrics?.serverIp || selectedServiceDetail.serverIp}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Next Due Date:</span>
                  <span className="font-semibold text-slate-700">{selectedServiceDetail.nextDueDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Service Status:</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold ${
                    selectedServiceDetail.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    {selectedServiceDetail.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">AutoSSL Certificate:</span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active (256-bit TLS)
                  </span>
                </div>
              </div>

              {/* Ready for User Instructions Note */}
              <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100 flex items-start gap-3">
                <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-900 leading-relaxed">
                  <span className="font-bold block text-indigo-950 mb-0.5">Custom Action Ready</span>
                  এই ডোমেইনের ডিটেইল এখানে প্রদর্শিত হচ্ছে। আপনি পরবর্তী নির্দেশে যেভাবে বলবেন (যেমন: ডিএনএস এডিট, প্যাকেজ আপগ্রেড, পাসওয়ার্ড রিসেট ইত্যাদি), সেই অনুযায়ী এখানে পরবর্তী অ্যাকশন যুক্ত করা হবে।
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  onClick={() => {
                    setViewingProductDetails(selectedServiceDetail);
                    setSelectedServiceDetail(null);
                  }}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
                >
                  <Eye className="w-4 h-4" /> View Full Details
                </button>
                <button
                  onClick={() => {
                    if (onOpenFullCpanel) {
                      onOpenFullCpanel(selectedServiceDetail);
                    } else {
                      setActiveCpanelModal(selectedServiceDetail);
                    }
                    setSelectedServiceDetail(null);
                  }}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-[#ff6c2c] hover:bg-[#e05b20] text-white font-bold text-xs shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  <ExternalLink className="w-4 h-4" /> cPanel
                </button>
                <button
                  onClick={() => setSelectedServiceDetail(null)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simulated Interactive cPanel Modal */}
      {renderCpanelModal()}

      {/* Available Addons Modal */}
      {showAddonsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-800 mb-1">Available Service Addons</h3>
            <p className="text-xs text-slate-500 mb-4">Enhance your shared cloud services.</p>
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 block">Dedicated IPv4 Address</span>
                  <span className="text-slate-500">Improves email deliverability</span>
                </div>
                <button
                  onClick={() => {
                    alert('Dedicated IP requested');
                    setShowAddonsModal(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold"
                >
                  Order
                </button>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 block">Daily Cloud Backup Vault</span>
                  <span className="text-slate-500">Automated disaster recovery snapshots</span>
                </div>
                <button
                  onClick={() => {
                    alert('Cloud Backup Vault requested');
                    setShowAddonsModal(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold"
                >
                  Order
                </button>
              </div>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowAddonsModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
