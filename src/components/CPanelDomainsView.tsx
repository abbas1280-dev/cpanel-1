import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Plus,
  Search,
  ExternalLink,
  Home,
  CheckCircle2,
  AlertCircle,
  X,
  HelpCircle,
  Wrench,
  Mail,
  ArrowLeft,
  Lock,
  RefreshCw,
  Folder,
  Trash2,
  Sliders,
  Check,
  ChevronDown,
  Bell,
  User,
  ShieldCheck,
  Server,
  Layers,
  Code,
  FileText,
  AlertTriangle,
  Radio,
  FolderTree,
  ExternalLink as LinkIcon
} from 'lucide-react';
import { ServiceItem, ServerMetrics, CPanelDomainItem, DomainType } from '../types';

interface CPanelDomainsViewProps {
  currentService?: ServiceItem;
  allServices: ServiceItem[];
  serverMetrics?: ServerMetrics | null;
  onExit: () => void;
  onOpenFileManager?: (domain: string, docRoot?: string) => void;
}

export const formatDocRootDisplay = (username: string, docRoot?: string): string => {
  const clean = (docRoot || '').replace(/^\/+|\/+$/g, '');
  return clean ? `/home/${username}/${clean}/` : `/home/${username}/`;
};

export const CPanelDomainsView: React.FC<CPanelDomainsViewProps> = ({
  currentService,
  allServices,
  serverMetrics,
  onExit,
  onOpenFileManager
}) => {
  // Selected Domain Environment
  const [activeMainDomain, setActiveMainDomain] = useState<string>(
    currentService?.domain || (allServices.length > 0 ? allServices[0].domain : 'turkyhub.com')
  );

  const domainUsername = activeMainDomain.split('.')[0].slice(0, 7).toLowerCase() + '1';

  // Navigation View: 'list' | 'create_subdomain' | 'create_addon'
  const [currentView, setCurrentView] = useState<'list' | 'create_subdomain' | 'create_addon'>('list');

  // Domains Data from live server
  const [domains, setDomains] = useState<CPanelDomainItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Success Notification Banner
  const [successBanner, setSuccessBanner] = useState<{
    domain: string;
    docRoot: string;
    type: 'Subdomain' | 'Addon Domain';
  } | null>(null);

  // Search Query
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'primary' | 'subdomain' | 'addon'>('all');

  // Bulk Selection
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>('');

  // Form State: Create Subdomain
  const [subdomainPrefix, setSubdomainPrefix] = useState<string>('');
  const [subdomainParent, setSubdomainParent] = useState<string>(activeMainDomain);
  const [subdomainShareDoc, setSubdomainShareDoc] = useState<boolean>(false);
  const [subdomainCustomDoc, setSubdomainCustomDoc] = useState<string>('');
  const [subdomainHttps, setSubdomainHttps] = useState<boolean>(true);
  const [subdomainRedirect, setSubdomainRedirect] = useState<string>('');

  // Form State: Create Addon Domain
  const [addonDomainName, setAddonDomainName] = useState<string>('');
  const [addonCustomDoc, setAddonCustomDoc] = useState<string>('');
  const [addonHttps, setAddonHttps] = useState<boolean>(true);
  const [addonRedirect, setAddonRedirect] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Manage Modal State
  const [managingDomain, setManagingDomain] = useState<CPanelDomainItem | null>(null);
  const [manageTab, setManageTab] = useState<'general' | 'dns' | 'vhost' | 'ssl' | 'delete'>('general');
  const [manageRedirectInput, setManageRedirectInput] = useState<string>('');
  const [isSavingManage, setIsSavingManage] = useState<boolean>(false);

  // DNS Inspection State for Modal
  const [dnsRecords, setDnsRecords] = useState<any[]>([]);
  const [dnsServerIp, setDnsServerIp] = useState<string>('');
  const [loadingDns, setLoadingDns] = useState<boolean>(false);

  // VHost Inspection State for Modal
  const [vhostConfigs, setVhostConfigs] = useState<{ apache: string; nginx: string } | null>(null);
  const [loadingVhost, setLoadingVhost] = useState<boolean>(false);

  // Deletion Modal State
  const [purgeDocRootFiles, setPurgeDocRootFiles] = useState<boolean>(false);
  const [isDeletingDomain, setIsDeletingDomain] = useState<boolean>(false);
  const [isRepairing, setIsRepairing] = useState<string | null>(null);

  const handleRepairDomain = async (domainName: string) => {
    setIsRepairing(domainName);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/cpanel/domains/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainDomain: activeMainDomain,
          domain: domainName
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessBanner({
          domain: domainName,
          docRoot: data.domain?.documentRoot || `/${domainName}`,
          type: data.domain?.type === 'addon' ? 'Addon Domain' : 'Subdomain'
        });
        await fetchDomains();
      } else {
        setErrorMsg(data.error || 'Failed to repair domain document root.');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Network error while repairing domain.');
    } finally {
      setIsRepairing(null);
    }
  };

  // Load Domains from Server
  const fetchDomains = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/cpanel/domains/list?domain=${encodeURIComponent(activeMainDomain)}`);
      if (res.ok) {
        const data = await res.json();
        setDomains(data.domains || []);
      } else {
        setErrorMsg('Failed to load domains from server.');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Network error connecting to local server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
    setSelectedDomains(new Set());
    setSubdomainParent(activeMainDomain);
  }, [activeMainDomain]);

  // Auto-fill suggested document root when Subdomain prefix changes (Outside public_html - Requirement #9)
  useEffect(() => {
    if (subdomainPrefix.trim()) {
      const clean = subdomainPrefix.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      setSubdomainCustomDoc(`${clean}.${subdomainParent}`);
    } else {
      setSubdomainCustomDoc('');
    }
  }, [subdomainPrefix, subdomainParent]);

  // Auto-fill suggested document root when Addon Domain changes
  useEffect(() => {
    if (addonDomainName.trim()) {
      const clean = addonDomainName.trim().toLowerCase().replace(/[^a-z0-9.-]/g, '');
      setAddonCustomDoc(`domains/${clean}`);
    } else {
      setAddonCustomDoc('');
    }
  }, [addonDomainName]);

  // Fetch DNS records when opening DNS tab in Manage Modal
  useEffect(() => {
    if (managingDomain && manageTab === 'dns') {
      setLoadingDns(true);
      fetch(`/api/cpanel/domains/dns?domain=${encodeURIComponent(activeMainDomain)}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            setDnsRecords(d.records || []);
            setDnsServerIp(d.serverIp || '');
          }
        })
        .catch(console.error)
        .finally(() => setLoadingDns(false));
    }
  }, [managingDomain, manageTab, activeMainDomain]);

  // Fetch VHost configs when opening VHost tab in Manage Modal
  useEffect(() => {
    if (managingDomain && manageTab === 'vhost') {
      setLoadingVhost(true);
      fetch(`/api/cpanel/domains/vhost?domain=${encodeURIComponent(activeMainDomain)}&targetDomain=${encodeURIComponent(managingDomain.domain)}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            setVhostConfigs({ apache: d.apache, nginx: d.nginx });
          }
        })
        .catch(console.error)
        .finally(() => setLoadingVhost(false));
    }
  }, [managingDomain, manageTab, activeMainDomain]);

  // Submit Handler: Create Subdomain
  const handleCreateSubdomain = async (stayOnPage: boolean = false) => {
    if (!subdomainPrefix.trim()) {
      alert('Please enter a subdomain prefix (e.g. blog, store, app).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const effectiveDocRoot = subdomainShareDoc
      ? '/public_html'
      : (subdomainCustomDoc.trim().startsWith('/') ? subdomainCustomDoc.trim() : `/${subdomainCustomDoc.trim()}`);

    try {
      const res = await fetch('/api/cpanel/domains/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainDomain: activeMainDomain,
          type: 'subdomain',
          subdomainPrefix: subdomainPrefix.trim().toLowerCase(),
          parentDomain: subdomainParent || activeMainDomain,
          shareDocumentRoot: subdomainShareDoc,
          documentRoot: effectiveDocRoot,
          forceHttps: subdomainHttps,
          redirectsTo: subdomainRedirect.trim() || null
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessBanner({
          domain: data.domain.domain,
          docRoot: data.domain.documentRoot,
          type: 'Subdomain'
        });

        await fetchDomains();

        if (stayOnPage) {
          setSubdomainPrefix('');
          setSubdomainShareDoc(false);
          setSubdomainCustomDoc('');
          setSubdomainRedirect('');
        } else {
          setCurrentView('list');
          setSubdomainPrefix('');
          setSubdomainShareDoc(false);
          setSubdomainCustomDoc('');
          setSubdomainRedirect('');
        }
      } else {
        alert(data.error || 'Failed to create subdomain.');
      }
    } catch (e) {
      console.error(e);
      alert('Error creating subdomain on host server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Handler: Create Addon Domain
  const handleCreateAddonDomain = async (stayOnPage: boolean = false) => {
    if (!addonDomainName.trim()) {
      alert('Please enter a valid domain name (e.g. myshop.com).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const effectiveDocRoot = addonCustomDoc.trim().startsWith('/')
      ? addonCustomDoc.trim()
      : `/${addonCustomDoc.trim()}`;

    try {
      const res = await fetch('/api/cpanel/domains/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainDomain: activeMainDomain,
          type: 'addon',
          domain: addonDomainName.trim().toLowerCase(),
          documentRoot: effectiveDocRoot,
          forceHttps: addonHttps,
          redirectsTo: addonRedirect.trim() || null
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessBanner({
          domain: data.domain.domain,
          docRoot: data.domain.documentRoot,
          type: 'Addon Domain'
        });

        await fetchDomains();

        if (stayOnPage) {
          setAddonDomainName('');
          setAddonCustomDoc('');
          setAddonRedirect('');
        } else {
          setCurrentView('list');
          setAddonDomainName('');
          setAddonCustomDoc('');
          setAddonRedirect('');
        }
      } else {
        alert(data.error || 'Failed to create addon domain.');
      }
    } catch (e) {
      console.error(e);
      alert('Error creating addon domain on host server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Force HTTPS Switch
  const handleToggleHttps = async (targetDomain: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/cpanel/domains/toggle-https', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainDomain: activeMainDomain,
          domain: targetDomain,
          forceHttps: !currentStatus
        })
      });
      if (res.ok) {
        setDomains(prev =>
          prev.map(d => (d.domain === targetDomain ? { ...d, forceHttps: !currentStatus } : d))
        );
      }
    } catch (e) {
      console.error('Failed to toggle HTTPS', e);
    }
  };

  // Save Manage (Redirect update)
  const handleSaveManageRedirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingDomain) return;

    setIsSavingManage(true);
    try {
      const res = await fetch('/api/cpanel/domains/update-redirect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainDomain: activeMainDomain,
          domain: managingDomain.domain,
          redirectsTo: manageRedirectInput.trim() || null
        })
      });
      if (res.ok) {
        setDomains(prev =>
          prev.map(d =>
            d.domain === managingDomain.domain
              ? { ...d, redirectsTo: manageRedirectInput.trim() || null }
              : d
          )
        );
        alert('Redirection updated successfully!');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingManage(false);
    }
  };

  // Delete Domain Handler
  const handleExecuteDeleteDomain = async () => {
    if (!managingDomain) return;
    if (managingDomain.isMain || managingDomain.type === 'primary') {
      alert('The primary main domain cannot be deleted.');
      return;
    }

    setIsDeletingDomain(true);
    try {
      const res = await fetch('/api/cpanel/domains/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainDomain: activeMainDomain,
          domain: managingDomain.domain,
          purgeFiles: purgeDocRootFiles
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message || `Domain "${managingDomain.domain}" deleted successfully.`);
        setManagingDomain(null);
        await fetchDomains();
      } else {
        alert(data.error || 'Failed to delete domain.');
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting domain from host server.');
    } finally {
      setIsDeletingDomain(false);
    }
  };

  // Bulk Actions
  const handleApplyBulk = async () => {
    if (!bulkAction || selectedDomains.size === 0) return;

    if (bulkAction === 'enable_https') {
      for (const dom of selectedDomains) {
        await handleToggleHttps(dom, false);
      }
      setSelectedDomains(new Set());
      setBulkAction('');
    } else if (bulkAction === 'disable_https') {
      for (const dom of selectedDomains) {
        await handleToggleHttps(dom, true);
      }
      setSelectedDomains(new Set());
      setBulkAction('');
    } else if (bulkAction === 'delete') {
      const deletables = Array.from(selectedDomains).filter(d => {
        const item = domains.find(x => x.domain === d);
        return item && !item.isMain && item.type !== 'primary';
      });

      if (deletables.length === 0) {
        alert('No eligible subdomains or addon domains selected for deletion. (Primary domain cannot be deleted)');
        return;
      }

      if (!confirm(`Are you sure you want to delete ${deletables.length} selected domain(s)? This will remove their DNS and web server configurations.`)) {
        return;
      }

      for (const d of deletables) {
        await fetch('/api/cpanel/domains/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mainDomain: activeMainDomain, domain: d, purgeFiles: false })
        });
      }
      await fetchDomains();
      setSelectedDomains(new Set());
      setBulkAction('');
    }
  };

  // Filtered Domains
  const filteredDomains = useMemo(() => {
    return domains.filter(d => {
      const matchSearch = d.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.documentRoot.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchSearch) return false;

      if (filterType === 'primary') return d.isMain || d.type === 'primary';
      if (filterType === 'subdomain') return d.type === 'subdomain';
      if (filterType === 'addon') return d.type === 'addon';
      return true;
    });
  }, [domains, searchQuery, filterType]);

  // Statistics
  const stats = useMemo(() => {
    let primary = 0, sub = 0, addon = 0;
    for (const d of domains) {
      if (d.isMain || d.type === 'primary') primary++;
      else if (d.type === 'addon') addon++;
      else sub++;
    }
    return { total: domains.length, primary, sub, addon };
  }, [domains]);

  const primaryDomainItem = useMemo(() => domains.find(d => d.isMain || d.type === 'primary'), [domains]);
  const subdomainItems = useMemo(() => domains.filter(d => !d.isMain && d.type === 'subdomain'), [domains]);
  const addonItems = useMemo(() => domains.filter(d => d.type === 'addon'), [domains]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors flex items-center gap-1 text-xs font-semibold"
              title="Return to cPanel Dashboard"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>cPanel</span>
            </button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#ff6c2c] text-white flex items-center justify-center font-black text-xs">
                cP
              </div>
              <span className="font-extrabold text-sm tracking-tight font-mono text-slate-900">
                Domain Manager
              </span>
            </div>
          </div>

          {/* Center: Account Switcher */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Globe className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-slate-500">Active Account:</span>
            <select
              value={activeMainDomain}
              onChange={e => setActiveMainDomain(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              {allServices.map(s => (
                <option key={s.id} value={s.domain}>
                  {s.domain}
                </option>
              ))}
            </select>
          </div>

          {/* Right: Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSuccessBanner(null);
                setCurrentView('create_subdomain');
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Subdomain</span>
            </button>
            <button
              onClick={() => {
                setSuccessBanner(null);
                setCurrentView('create_addon');
              }}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Addon Domain</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        {/* Success Banner */}
        {successBanner && (
          <div className="rounded-xl border border-emerald-300 bg-[#e3f4db] text-[#2c6827] px-4 py-3.5 flex items-start justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <div className="text-xs leading-relaxed">
                <strong className="font-bold">Success:</strong> You have successfully created the new {successBanner.type} &ldquo;
                <span className="font-bold">{successBanner.domain}</span>&rdquo; with isolated document root of &ldquo;
                <span className="font-bold font-mono">{formatDocRootDisplay(domainUsername, successBanner.docRoot)}</span>&rdquo;.
                The web server and DNS records are live and actively serving.
              </div>
            </div>
            <button
              onClick={() => setSuccessBanner(null)}
              className="text-emerald-700 hover:text-emerald-950 p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: DOMAINS LIST TABLE */}
        {/* ========================================================================= */}
        {currentView === 'list' && (
          <div className="space-y-4">
            {/* Header & Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Hosted</div>
                <div className="text-xl font-extrabold text-slate-800 mt-1">{stats.total} Domains</div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider">Primary Domain</div>
                <div className="text-xl font-extrabold text-indigo-700 mt-1">{stats.primary} Root</div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Subdomains</div>
                <div className="text-xl font-extrabold text-emerald-700 mt-1">{stats.sub} Active</div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[11px] font-bold text-sky-600 uppercase tracking-wider">Addon Domains</div>
                <div className="text-xl font-extrabold text-sky-700 mt-1">{stats.addon} Isolated</div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 flex-1 max-w-lg">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search domains or document roots..."
                    className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
                {/* Type Filter Buttons */}
                <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${filterType === 'all' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterType('subdomain')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${filterType === 'subdomain' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-emerald-700'}`}
                  >
                    Subdomains
                  </button>
                  <button
                    onClick={() => setFilterType('addon')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${filterType === 'addon' ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-500 hover:text-sky-700'}`}
                  >
                    Addons
                  </button>
                </div>
              </div>

              {/* Bulk Actions */}
              <div className="flex items-center gap-2">
                <select
                  value={bulkAction}
                  onChange={e => setBulkAction(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                >
                  <option value="">Bulk Actions...</option>
                  <option value="enable_https">Enable Force HTTPS Redirect</option>
                  <option value="disable_https">Disable Force HTTPS Redirect</option>
                  <option value="delete">Delete Selected</option>
                </select>
                <button
                  type="button"
                  onClick={handleApplyBulk}
                  disabled={!bulkAction || selectedDomains.size === 0}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 transition-colors disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Domains Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-700 font-bold">
                      <th className="py-3.5 px-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedDomains.size > 0 && selectedDomains.size === filteredDomains.length}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedDomains(new Set(filteredDomains.map(d => d.domain)));
                            } else {
                              setSelectedDomains(new Set());
                            }
                          }}
                          className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                        />
                      </th>
                      <th className="py-3.5 px-4">Domain Name & Type</th>
                      <th className="py-3.5 px-4">Document Root (Isolated)</th>
                      <th className="py-3.5 px-4">DNS Status</th>
                      <th className="py-3.5 px-4">SSL & HTTPS</th>
                      <th className="py-3.5 px-4">Web Server</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-600" />
                          Loading domain architecture from host storage...
                        </td>
                      </tr>
                    ) : filteredDomains.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-slate-400 font-medium">
                          No domains found matching &ldquo;{searchQuery}&rdquo;.
                        </td>
                      </tr>
                    ) : (
                      filteredDomains.map(item => {
                        const isSelected = selectedDomains.has(item.domain);
                        const isPrimary = item.isMain || item.type === 'primary';
                        const isAddon = item.type === 'addon';
                        const isSub = !isPrimary && !isAddon;

                        return (
                          <tr
                            key={item.domain}
                            className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-sky-50/40' : ''}`}
                          >
                            {/* Checkbox */}
                            <td className="py-4 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={e => {
                                  const next = new Set(selectedDomains);
                                  if (e.target.checked) next.add(item.domain);
                                  else next.delete(item.domain);
                                  setSelectedDomains(next);
                                }}
                                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                              />
                            </td>

                            {/* Domain Name & Badges */}
                            <td className="py-4 px-4 font-medium">
                              <div className="space-y-1">
                                <span className="font-mono text-[13px] font-bold text-slate-800 block">
                                  {item.domain}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {isPrimary && (
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold uppercase">
                                      Primary Domain
                                    </span>
                                  )}
                                  {isSub && (
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase">
                                      Subdomain
                                    </span>
                                  )}
                                  {isAddon && (
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-extrabold uppercase">
                                      Addon Domain
                                    </span>
                                  )}
                                  {(item.status === 'config_error' || item.documentRootStatus === 'missing') && (
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-extrabold uppercase flex items-center gap-1">
                                      <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                                      Directory Missing
                                    </span>
                                  )}
                                  {item.redirectsTo && (
                                    <span className="inline-block px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium">
                                      Redirects to {item.redirectsTo}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Document Root (Clickable directly to File Manager) */}
                            <td className="py-4 px-4">
                              {item.status === 'config_error' || item.documentRootStatus === 'missing' ? (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <Folder className="w-4 h-4 text-rose-400 shrink-0" />
                                    <span className="font-mono text-xs text-rose-700 font-medium line-through">
                                      {formatDocRootDisplay(domainUsername, item.documentRoot)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                                      <AlertCircle className="w-3 h-3 text-rose-500" />
                                      Directory missing on disk
                                    </span>
                                    <button
                                      type="button"
                                      disabled={isRepairing === item.domain}
                                      onClick={() => handleRepairDomain(item.domain)}
                                      className="text-[10px] font-bold text-sky-700 hover:text-sky-900 underline ml-1"
                                    >
                                      {isRepairing === item.domain ? 'Repairing...' : 'Repair now'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                                    <button
                                      onClick={() => {
                                        if (onOpenFileManager) {
                                          onOpenFileManager(activeMainDomain, item.documentRoot);
                                        }
                                      }}
                                      className="hover:underline font-mono text-xs text-sky-700 hover:text-sky-900 text-left font-medium"
                                      title="Open this domain's isolated directory in File Manager"
                                    >
                                      {formatDocRootDisplay(domainUsername, item.documentRoot)}
                                    </button>
                                  </div>
                                  <span className="text-[10px] text-slate-400 block mt-0.5">
                                    Click to browse files
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* DNS Status */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${item.status === 'config_error' ? 'bg-amber-400' : 'bg-emerald-500'} shrink-0`} />
                                <span className="font-semibold text-slate-700 text-xs">{item.status === 'config_error' ? 'Config Attention' : 'Active'}</span>
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                                IP: {serverMetrics?.serverIp || '192.168.0.104'}
                              </span>
                            </td>

                            {/* SSL & Force HTTPS Switch */}
                            <td className="py-4 px-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>AutoSSL Active</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleHttps(item.domain, item.forceHttps)}
                                    className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      item.forceHttps ? 'bg-sky-600' : 'bg-slate-300'
                                    }`}
                                    title="Toggle Force HTTPS Redirect"
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        item.forceHttps ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    HTTPS: {item.forceHttps ? 'Enforced' : 'Optional'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Web Server */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-1 text-slate-700 font-medium text-xs">
                                <Server className="w-3.5 h-3.5 text-slate-400" />
                                <span>Dual Engine</span>
                              </div>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                Apache + Nginx
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {(item.status === 'config_error' || item.documentRootStatus === 'missing') && (
                                  <button
                                    type="button"
                                    disabled={isRepairing === item.domain}
                                    onClick={() => handleRepairDomain(item.domain)}
                                    className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold flex items-center gap-1 transition-colors"
                                    title="Re-create missing folder, fix document root, and sync Nginx/DNS"
                                  >
                                    <Wrench className={`w-3 h-3 text-amber-600 ${isRepairing === item.domain ? 'animate-spin' : ''}`} />
                                    <span>{isRepairing === item.domain ? 'Repairing...' : 'Repair'}</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setManagingDomain(item);
                                    setManageTab('general');
                                    setManageRedirectInput(item.redirectsTo || '');
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                                >
                                  <Wrench className="w-3 h-3 text-slate-500" />
                                  <span>Manage</span>
                                </button>
                                {!isPrimary && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setManagingDomain(item);
                                      setManageTab('delete');
                                      setPurgeDocRootFiles(false);
                                    }}
                                    className="p-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                                    title="Delete this domain"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between text-xs text-slate-500">
                <span>
                  Showing {filteredDomains.length} of {domains.length} total domains and subdomains
                </span>
                <span className="font-mono text-[11px]">
                  Account Storage Root: /home/{domainUsername}/
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: CREATE SUBDOMAIN */}
        {/* ========================================================================= */}
        {currentView === 'create_subdomain' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            {/* Breadcrumb */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Create a Subdomain</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Subdomains are branches of your primary domain, with dedicated isolated document roots.
                </p>
              </div>
              <button
                onClick={() => setCurrentView('list')}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Domains</span>
              </button>
            </div>

            {/* Form Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
              {/* Parent Domain Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Parent Domain:
                </label>
                <select
                  value={subdomainParent}
                  onChange={e => {
                    const newParent = e.target.value;
                    setSubdomainParent(newParent);
                    if (!subdomainShareDoc && subdomainPrefix) {
                      setSubdomainCustomDoc(`${subdomainPrefix}.${newParent}`);
                    }
                  }}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {allServices.map(s => (
                    <option key={s.id} value={s.domain}>
                      {s.domain}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subdomain Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Subdomain Prefix:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={subdomainPrefix}
                    onChange={e => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                      setSubdomainPrefix(val);
                      if (!subdomainShareDoc) {
                        setSubdomainCustomDoc(val ? `${val}.${subdomainParent}` : '');
                      }
                    }}
                    placeholder="e.g. blog, store, app"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-xs font-bold text-slate-500 font-mono">
                    .{subdomainParent}
                  </span>
                </div>
                {subdomainPrefix && (
                  <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-mono">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Full Domain: <strong>{subdomainPrefix}.{subdomainParent}</strong></span>
                  </div>
                )}
              </div>

              {/* Document Root */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700">
                  Document Root (Isolated Storage Location):
                </label>

                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    id="shareDoc"
                    checked={subdomainShareDoc}
                    onChange={e => {
                      const checked = e.target.checked;
                      setSubdomainShareDoc(checked);
                      if (!checked && subdomainPrefix) {
                        setSubdomainCustomDoc(`${subdomainPrefix}.${subdomainParent}`);
                      }
                    }}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="shareDoc" className="text-slate-700 font-medium cursor-pointer">
                    Share document root (<code className="font-mono text-indigo-600">/public_html</code>) with {subdomainParent}
                  </label>
                </div>

                {!subdomainShareDoc && (
                  <div>
                    <div className="flex items-center rounded-xl border border-slate-300 overflow-hidden bg-slate-50 font-mono text-xs">
                      <span className="px-3 py-2 text-slate-400 bg-slate-100 border-r border-slate-200 select-none">
                        /home/{domainUsername}/
                      </span>
                      <input
                        type="text"
                        value={subdomainCustomDoc}
                        onChange={e => setSubdomainCustomDoc(e.target.value)}
                        placeholder={`${subdomainPrefix || 'blog'}.${subdomainParent}`}
                        className="flex-1 px-3 py-2 bg-transparent text-slate-800 font-semibold focus:outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 font-mono">
                      Target Hierarchy: <strong className="text-emerald-700">{formatDocRootDisplay(domainUsername, subdomainShareDoc ? '/public_html' : (subdomainCustomDoc || `${subdomainPrefix || 'blog'}.${subdomainParent}`))}</strong>
                    </p>
                  </div>
                )}
              </div>

              {/* Force HTTPS Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800">AutoSSL & Force HTTPS Redirect</div>
                  <div className="text-[11px] text-slate-500">Automatically provisions SSL and forces HTTPS traffic.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubdomainHttps(!subdomainHttps)}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    subdomainHttps ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      subdomainHttps ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Optional Redirect */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Optional Redirection (Redirects To):
                </label>
                <input
                  type="url"
                  value={subdomainRedirect}
                  onChange={e => setSubdomainRedirect(e.target.value)}
                  placeholder="https://example.com/target (Leave blank if not redirecting)"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentView('list')}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleCreateSubdomain(true)}
                  className="px-4 py-2 rounded-xl border border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-50 text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Submit And Create Another'}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleCreateSubdomain(false)}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating Subdomain...' : 'Create Subdomain'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: CREATE ADDON DOMAIN */}
        {/* ========================================================================= */}
        {currentView === 'create_addon' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            {/* Breadcrumb */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Create an Addon Domain</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  An Addon Domain allows you to host an entirely independent domain with isolated files within this account.
                </p>
              </div>
              <button
                onClick={() => setCurrentView('list')}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Domains</span>
              </button>
            </div>

            {/* Architecture Info Banner */}
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex items-start gap-3 text-xs text-sky-900 leading-relaxed">
              <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Addon Domain Isolation Guarantee:</strong> Unlike subdomains, files uploaded to an addon domain reside in an isolated document root (<code className="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200 text-sky-700">/domains/yourdomain.com</code>). They do not share or contaminate your primary <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200 text-sky-700">public_html</code> directory.
              </div>
            </div>

            {/* Form Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
              {/* Addon Domain Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  New Domain Name:
                </label>
                <input
                  type="text"
                  value={addonDomainName}
                  onChange={e => setAddonDomainName(e.target.value.toLowerCase().trim())}
                  placeholder="e.g. techgadgethub.org, myshop.com"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter the fully qualified domain name (without http:// or www).
                </p>
              </div>

              {/* Document Root */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Document Root (Completely Isolated):
                </label>
                <div className="flex items-center rounded-xl border border-slate-300 overflow-hidden bg-slate-50 font-mono text-xs">
                  <span className="px-3 py-2 text-slate-400 bg-slate-100 border-r border-slate-200 select-none">
                    /home/{domainUsername}/
                  </span>
                  <input
                    type="text"
                    value={addonCustomDoc}
                    onChange={e => setAddonCustomDoc(e.target.value)}
                    placeholder="domains/myshop.com"
                    className="flex-1 px-3 py-2 bg-transparent text-slate-800 font-semibold focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                  Target Hierarchy: <strong className="text-sky-700">{formatDocRootDisplay(domainUsername, addonCustomDoc || `domains/${addonDomainName || 'myshop.com'}`)}</strong>
                </p>
              </div>

              {/* Force HTTPS Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800">AutoSSL & Force HTTPS Redirect</div>
                  <div className="text-[11px] text-slate-500">Automatically provisions SSL and forces HTTPS traffic.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setAddonHttps(!addonHttps)}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    addonHttps ? 'bg-sky-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      addonHttps ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Optional Redirect */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Optional Redirection (Redirects To):
                </label>
                <input
                  type="url"
                  value={addonRedirect}
                  onChange={e => setAddonRedirect(e.target.value)}
                  placeholder="https://example.com/target (Leave blank if not redirecting)"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentView('list')}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleCreateAddonDomain(true)}
                  className="px-4 py-2 rounded-xl border border-sky-600 text-sky-700 bg-white hover:bg-sky-50 text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Submit And Create Another'}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleCreateAddonDomain(false)}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating Addon Domain...' : 'Create Addon Domain'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* COMPREHENSIVE MANAGE MODAL */}
      {/* ========================================================================= */}
      {managingDomain && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 text-xs space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <span>Manage {managingDomain.domain}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-100 text-slate-600">
                      {managingDomain.isMain ? 'Primary' : managingDomain.type}
                    </span>
                  </h3>
                  <p className="text-slate-400 text-[11px]">
                    Live Server Configuration & Resource Routing
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingDomain(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex items-center gap-1 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-bold">
              <button
                onClick={() => setManageTab('general')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${manageTab === 'general' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Overview & Redirect</span>
              </button>
              <button
                onClick={() => setManageTab('dns')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${manageTab === 'dns' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>DNS Zone Records</span>
              </button>
              <button
                onClick={() => setManageTab('vhost')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${manageTab === 'vhost' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Web Server Config</span>
              </button>
              <button
                onClick={() => setManageTab('ssl')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${manageTab === 'ssl' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>SSL & HTTPS</span>
              </button>
              {!managingDomain.isMain && managingDomain.type !== 'primary' && (
                <button
                  onClick={() => setManageTab('delete')}
                  className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${manageTab === 'delete' ? 'bg-rose-600 text-white' : 'text-rose-600 hover:bg-rose-50'}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Domain</span>
                </button>
              )}
            </div>

            {/* TAB 1: GENERAL & REDIRECTION */}
            {manageTab === 'general' && (
              <div className="space-y-4">
                {/* Document Root Details */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Document Root (Isolated Filesystem):</span>
                    <button
                      onClick={() => {
                        if (onOpenFileManager) {
                          onOpenFileManager(activeMainDomain, managingDomain.documentRoot);
                        }
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-sky-700 font-bold flex items-center gap-1 text-[11px] shadow-2xs"
                    >
                      <Folder className="w-3.5 h-3.5 text-amber-500" />
                      <span>Open in File Manager</span>
                    </button>
                  </div>
                  <div className="font-mono text-xs text-slate-800 font-semibold bg-white p-2.5 rounded-lg border border-slate-200">
                    {formatDocRootDisplay(domainUsername, managingDomain.documentRoot)}
                  </div>
                  <div className="text-[11px] text-slate-500 pt-1 font-mono">
                    Physical storage path: <code className="text-indigo-600">server_storage/domains/{activeMainDomain}{managingDomain.documentRoot}</code>
                  </div>
                </div>

                {/* Redirect Management Form */}
                <form onSubmit={handleSaveManageRedirect} className="space-y-3 pt-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Target Redirection URL (Redirects To):
                    </label>
                    <input
                      type="url"
                      value={manageRedirectInput}
                      onChange={e => setManageRedirectInput(e.target.value)}
                      placeholder="e.g. https://turkyhub.com/app or leave empty to disable"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Leave empty and click &ldquo;Save Redirection&rdquo; to disable redirection.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={isSavingManage}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-xs transition-colors"
                    >
                      {isSavingManage ? 'Saving...' : 'Save Redirection'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 2: DNS ZONE RECORDS */}
            {manageTab === 'dns' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800">DNS Zone Records for {activeMainDomain}</h4>
                    <p className="text-[11px] text-slate-400">All records resolve directly to host server IP: <code className="font-mono text-emerald-600 font-bold">{dnsServerIp || '192.168.0.104'}</code></p>
                  </div>
                </div>

                {loadingDns ? (
                  <div className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-600" />
                    Loading DNS records...
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">TTL</th>
                          <th className="py-2.5 px-3">Value / Target</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {dnsRecords.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50/60">
                            <td className="py-2 px-3 font-bold text-indigo-600">{r.type}</td>
                            <td className="py-2 px-3 text-slate-800">{r.name}</td>
                            <td className="py-2 px-3 text-slate-500">{r.ttl}</td>
                            <td className="py-2 px-3 text-slate-700 font-semibold">{r.value}</td>
                            <td className="py-2 px-3 text-emerald-600 font-sans font-bold">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                              {r.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: WEB SERVER VIRTUAL HOST CONFIGS */}
            {manageTab === 'vhost' && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-slate-800">Generated Web Server Configurations</h4>
                  <p className="text-[11px] text-slate-400">Real virtual host configs generated and validated on host SSD storage.</p>
                </div>

                {loadingVhost ? (
                  <div className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-600" />
                    Reading virtual host files from disk...
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                        <span>Nginx Server Block (<code className="font-mono text-sky-600">vhosts/nginx/{managingDomain.domain}.conf</code>):</span>
                      </div>
                      <pre className="p-3 bg-slate-900 text-slate-100 font-mono text-[11px] rounded-xl overflow-x-auto max-h-48 border border-slate-800">
                        {vhostConfigs?.nginx}
                      </pre>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                        <span>Apache VirtualHost (<code className="font-mono text-sky-600">vhosts/apache/{managingDomain.domain}.conf</code>):</span>
                      </div>
                      <pre className="p-3 bg-slate-900 text-slate-100 font-mono text-[11px] rounded-xl overflow-x-auto max-h-48 border border-slate-800">
                        {vhostConfigs?.apache}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: SSL & HTTPS */}
            {manageTab === 'ssl' && (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <span>AutoSSL Status: Fully Protected & Active</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    A valid 2048-bit RSA TLS certificate has been generated and provisioned for <strong>{managingDomain.domain}</strong> under <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-200">ssl/certs/{managingDomain.domain}.crt</code>.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800 block">Force HTTPS Redirection</span>
                    <span className="text-[11px] text-slate-500">Automatically redirect all HTTP requests to encrypted HTTPS.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleHttps(managingDomain.domain, managingDomain.forceHttps)}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      managingDomain.forceHttps ? 'bg-sky-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        managingDomain.forceHttps ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 5: DELETE DOMAIN */}
            {manageTab === 'delete' && (
              <div className="space-y-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="font-bold text-sm text-rose-800">Delete Domain: {managingDomain.domain}</h4>
                    <p className="text-xs leading-relaxed text-rose-700">
                      Are you sure you want to remove <strong>{managingDomain.domain}</strong>? This action will permanently remove its web server configurations (Apache & Nginx) and DNS zone records.
                    </p>
                    <div className="flex items-center gap-2 pt-2 text-xs">
                      <input
                        type="checkbox"
                        id="purgeFilesCheck"
                        checked={purgeDocRootFiles}
                        onChange={e => setPurgeDocRootFiles(e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-rose-300 cursor-pointer"
                      />
                      <label htmlFor="purgeFilesCheck" className="text-rose-800 font-semibold cursor-pointer select-none">
                        Also permanently purge document root directory (<code className="font-mono text-rose-950 font-bold">{managingDomain.documentRoot}</code>) from disk
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-rose-200">
                  <button
                    type="button"
                    onClick={() => setManageTab('general')}
                    className="px-4 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingDomain}
                    onClick={handleExecuteDeleteDomain}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isDeletingDomain ? 'Deleting...' : 'Confirm Permanent Deletion'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
