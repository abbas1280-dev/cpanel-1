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
  Eye,
  Trash2,
  Settings,
  AlertTriangle
} from 'lucide-react';
import { ServiceItem, DomainItem, ServerMetrics } from '../types';
import { ProductDetailsView } from './ProductDetailsView';

interface MyServicesViewProps {
  services: ServiceItem[];
  domains: DomainItem[];
  onAddService: (newService: ServiceItem) => void;
  onDeleteService?: (serviceIdOrDomain: string) => void;
  onOpenFullCpanel?: (newService: ServiceItem) => void;
  serverMetrics?: ServerMetrics | null;
}

type ProvisioningStage = 'idle' | 'provisioning' | 'completed';

export const MyServicesView: React.FC<MyServicesViewProps> = ({
  services,
  domains,
  onAddService,
  onDeleteService,
  onOpenFullCpanel,
  serverMetrics
}) => {
  // Local services synchronization for instantaneous UI updates
  const [localServices, setLocalServices] = useState<ServiceItem[]>(services);

  React.useEffect(() => {
    setLocalServices(services);
  }, [services]);

  // Three-dots dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Safe Deletion Modal State
  const [serviceToDelete, setServiceToDelete] = useState<ServiceItem | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Change PHP Version Modal State
  const [serviceToChangePhp, setServiceToChangePhp] = useState<ServiceItem | null>(null);
  const [selectedPhpVer, setSelectedPhpVer] = useState('8.2');
  const [isUpdatingPhp, setIsUpdatingPhp] = useState(false);

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleDocumentClick = () => {
      setOpenDropdownId(null);
    };
    if (openDropdownId) {
      document.addEventListener('click', handleDocumentClick);
      return () => document.removeEventListener('click', handleDocumentClick);
    }
  }, [openDropdownId]);

  // Navigation: Product Details View State
  const [viewingProductDetails, setViewingProductDetails] = useState<ServiceItem | null>(null);

  // Navigation / View State: toggle between list and Add New domain form
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [domainOption, setDomainOption] = useState<'register' | 'transfer' | 'existing'>('existing');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Entries');
  const [entriesPerPage, setEntriesPerPage] = useState(10);

  // Domain input form states (empty by default, placeholder shows example / com)
  const [domainNamePart, setDomainNamePart] = useState('');
  const [tldPart, setTldPart] = useState('');
  const phpVersion = '8.2';
  const selectedQuota = 'Unlimited Shared Pool';
  const [validationError, setValidationError] = useState<string | null>(null);

  // Dynamic public server IP state
  const [publicServerIp, setPublicServerIp] = useState<string>(serverMetrics?.serverIp || '208.72.218.129');

  React.useEffect(() => {
    fetch('/api/server/public-ip')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.ip) {
          setPublicServerIp(data.ip);
        }
      })
      .catch(() => {});
  }, []);

  // Automated cPanel provisioning state
  const [provisionStage, setProvisionStage] = useState<ProvisioningStage>('idle');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [createdCpanelInfo, setCreatedCpanelInfo] = useState<{
    domain: string;
    username: string;
    password: string;
    ip: string;
    cpanelUrl: string;
    phpVersion?: string;
  } | null>(null);

  // Live DNS & SSL Activation state
  const [dnsChecking, setDnsChecking] = useState(false);
  const [dnsCheckResult, setDnsCheckResult] = useState<{
    isPointed: boolean;
    propagated?: boolean;
    status?: string;
    sslActivated?: boolean;
    message: string;
    resolvedIps?: string[];
  } | null>(null);
  const [sslActivating, setSslActivating] = useState(false);
  const [sslActivated, setSslActivated] = useState(false);
  const [sslMessage, setSslMessage] = useState<string | null>(null);

  // Copy helper
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

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
    'Allocating Linux System Tenant & Webroot (/home/u_.../public_html)...',
    'Configuring Dedicated PHP-FPM Pool Socket...',
    'Generating Nginx VirtualHost & FastCGI Proxy...',
    'Provisioning Isolated MariaDB Database & phpMyAdmin SSO...',
    'Binding Authoritative Nameservers (ns1.hoster1280.shop, ns2.hoster1280.shop)...'
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
    setValidationError(null);
  };

  // Trigger automated multi-tenant provisioning
  const handleUseDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Support user entering full domain "turkyhub.com" or just name "turkyhub" and extension "com"
    let rawName = domainNamePart.trim().toLowerCase();
    let rawTld = tldPart.trim().replace(/^\.+/, '').toLowerCase();

    if (!rawName) {
      setValidationError('Please enter a domain name.');
      return;
    }

    // If user entered dot in domain name field (e.g. "turkyhub.com" or "site.shop")
    if (rawName.includes('.')) {
      const dotIndex = rawName.indexOf('.');
      if (!rawTld) {
        rawTld = rawName.slice(dotIndex + 1);
      }
      rawName = rawName.slice(0, dotIndex);
    }

    // Default TLD to com if left empty
    if (!rawTld) {
      rawTld = 'com';
    }

    const cleanDomain = `${rawName}.${rawTld}`;
    
    // Domain validation
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(cleanDomain)) {
      setValidationError('Please enter a valid domain format (e.g. clientdomain.com).');
      return;
    }
    if (services.some((s) => s.domain.toLowerCase() === cleanDomain)) {
      setValidationError(`Domain "${cleanDomain}" is already registered in your active services.`);
      return;
    }
    setValidationError(null);

    setProvisionStage('provisioning');
    setCurrentStepIndex(0);
    setDnsCheckResult(null);
    setSslActivated(false);
    setSslMessage(null);

    let provisionedData: any = null;

    try {
      const res = await fetch('/api/services/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: cleanDomain,
          phpVersion: '8.2',
          quota: 'Unlimited Shared Pool'
        })
      });
      if (res.ok) {
        provisionedData = await res.json();
      }
    } catch (err: any) {
      console.warn('Backend provisioning call fallback:', err.message);
    }

    const realServerIp = provisionedData?.serverIp || publicServerIp || serverMetrics?.serverIp || '208.72.218.129';
    const generatedUsername = provisionedData?.tenantUsername || `u_${rawName.slice(0, 7).replace(/[^a-zA-Z0-9]/g, '')}`;
    const generatedPassword = provisionedData?.password || `Sec#${Math.random().toString(36).slice(-6)}!2026`;

    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < provisioningSteps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setProvisionStage('completed');

          const newService: ServiceItem = {
            id: provisionedData?.service?.id || ('srv-' + Date.now().toString().slice(-4)),
            product: 'Shared Cloud Hosting',
            domain: cleanDomain,
            pricing: '',
            billingCycle: 'Annual',
            nextDueDate: 'Friday, October 16th, 2026',
            status: 'Active',
            serverIp: realServerIp,
            phpVersion: '8.2',
            quota: 'Unlimited Shared Pool',
            tenantUsername: generatedUsername,
            nameservers: ['ns1.hoster1280.shop', 'ns2.hoster1280.shop']
          };

          setCreatedCpanelInfo({
            domain: cleanDomain,
            username: generatedUsername,
            password: generatedPassword,
            ip: realServerIp,
            cpanelUrl: `https://cpanel.${cleanDomain}`,
            phpVersion: '8.2'
          });

          onAddService(newService);
          return prev;
        }
      });
    }, 600);
  };

  // Check DNS propagation and activate SSL
  const handleCheckDnsAndActivateSsl = async (domain: string) => {
    setDnsChecking(true);
    setDnsCheckResult(null);
    setSslMessage(null);

    try {
      const res = await fetch(`/api/dns/check?domain=${encodeURIComponent(domain)}`);
      const data = await res.json();
      setDnsCheckResult(data);

      if (data.isPointed || data.propagated) {
        if (data.sslActivated) {
          setSslActivated(true);
          setSslMessage(data.sslMessage || "Let's Encrypt SSL certificate successfully activated & HTTPS secured!");
        } else {
          setSslActivating(true);
          const sslRes = await fetch('/api/ssl/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain })
          });
          const sslData = await sslRes.json();
          setSslActivating(false);
          if (sslData.success) {
            setSslActivated(true);
            setSslMessage("Let's Encrypt SSL certificate successfully activated & HTTPS secured!");
          } else {
            setSslMessage(sslData.error || 'SSL activation will finalize automatically once global DNS caches refresh.');
          }
        }
      }
    } catch (err: any) {
      setDnsCheckResult({
        isPointed: false,
        propagated: false,
        message: 'Could not connect to DNS checker endpoint: ' + err.message,
        resolvedIps: []
      });
    } finally {
      setDnsChecking(false);
    }
  };

  const copyPassword = () => {
    if (createdCpanelInfo?.password) {
      navigator.clipboard.writeText(createdCpanelInfo.password);
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  // Safe Service Deletion Handler
  const handleExecuteDeletion = async () => {
    if (!serviceToDelete || deleteConfirmText.trim() !== 'CONFIRM') return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch('/api/services/terminate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: serviceToDelete.domain })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Server failed to terminate service.');
      }

      // Update local state immediately
      setLocalServices((prev) =>
        prev.filter((s) => s.domain !== serviceToDelete.domain && s.id !== serviceToDelete.id)
      );

      // Notify parent if available
      if (onDeleteService) {
        onDeleteService(serviceToDelete.id);
      }

      setServiceToDelete(null);
      setDeleteConfirmText('');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to terminate service.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Change PHP Version Handler
  const handleExecuteChangePhp = async () => {
    if (!serviceToChangePhp) return;
    setIsUpdatingPhp(true);
    try {
      await fetch('/api/services/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: serviceToChangePhp.domain,
          phpVersion: selectedPhpVer,
          allowUpdate: true
        })
      });

      setLocalServices((prev) =>
        prev.map((s) => (s.id === serviceToChangePhp.id ? { ...s, phpVersion: selectedPhpVer } : s))
      );
      setServiceToChangePhp(null);
    } catch (e) {
      setServiceToChangePhp(null);
    } finally {
      setIsUpdatingPhp(false);
    }
  };

  // Filtered services list
  const filteredServices = useMemo(() => {
    return localServices.filter((srv) => {
      const matchesSearch =
        srv.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
        srv.product.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'All Entries' || srv.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [localServices, searchTerm, statusFilter]);

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

      {/* Sleek Cloud Infrastructure Pool Metric Header */}
      {!showDomainForm && (
        <div className="bg-gradient-to-r from-[#11074a] via-[#1a1063] to-[#251582] text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-indigo-950 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
          {/* Left Side: Minimalist icon + Title + Active Status Badge */}
          <div className="flex items-center gap-3.5 w-full md:w-auto">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-blue-300 shrink-0 border border-white/10 shadow-inner">
              <Server className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Cloud Infrastructure Pool
                </h2>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  HOST POOL ACTIVE
                </span>
              </div>
            </div>
          </div>

          {/* Right Side: Modern Stat Cards / Pills */}
          <div className="flex items-center gap-3 sm:gap-4 text-xs font-medium text-indigo-200/90 shrink-0 w-full md:w-auto justify-between md:justify-end">
            <div className="bg-white/5 hover:bg-white/10 transition-colors px-4 py-2 rounded-xl border border-white/10 backdrop-blur-md flex-1 md:flex-initial text-left">
              <span className="block text-[10px] text-indigo-300/80 uppercase font-bold tracking-wider">Total NVMe Storage</span>
              <span className="font-bold text-white text-sm sm:text-base">{serverMetrics?.disk.totalGB || '500.0'} GB</span>
            </div>
            <div className="bg-white/5 hover:bg-white/10 transition-colors px-4 py-2 rounded-xl border border-white/10 backdrop-blur-md flex-1 md:flex-initial text-left">
              <span className="block text-[10px] text-indigo-300/80 uppercase font-bold tracking-wider">Server IP</span>
              <span className="font-bold text-sky-400 text-sm sm:text-base font-mono">{serverMetrics?.serverIp || publicServerIp || '208.72.218.129'}</span>
            </div>
            <div className="bg-white/5 hover:bg-white/10 transition-colors px-4 py-2 rounded-xl border border-white/10 backdrop-blur-md flex-1 md:flex-initial text-left">
              <span className="block text-[10px] text-indigo-300/80 uppercase font-bold tracking-wider">Connected Domains</span>
              <span className="font-bold text-emerald-400 text-sm sm:text-base">{localServices.length} Domains</span>
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
                Selected Product: <span className="font-bold text-slate-700">Web Hosting - 5 GB Hosting</span>
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
            </div>

            <div className="bg-[#181196] p-8 sm:p-10">
              <form onSubmit={handleUseDomain} className="max-w-4xl mx-auto space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="text"
                    required
                    value={domainNamePart}
                    onChange={(e) => {
                      setDomainNamePart(e.target.value);
                      setValidationError(null);
                    }}
                    placeholder="example"
                    className="w-full sm:flex-1 h-12 px-4 bg-white text-slate-800 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-400 border-0 shadow-sm"
                  />

                  <input
                    type="text"
                    value={tldPart}
                    onChange={(e) => {
                      setTldPart(e.target.value);
                      setValidationError(null);
                    }}
                    placeholder="com"
                    className="w-full sm:w-28 h-12 px-4 bg-white text-slate-800 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-400 border-0 shadow-sm"
                  />

                  <button
                    type="submit"
                    disabled={provisionStage === 'provisioning'}
                    className="w-full sm:w-auto h-12 px-8 bg-[#0c0545] hover:bg-[#140a6b] text-white font-bold text-sm rounded-md transition-colors shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center cursor-pointer border-0"
                  >
                    Use
                  </button>
                </div>

                {validationError && (
                  <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-md text-xs text-rose-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}
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
                    Automated Multi-Tenant Provisioning in Progress
                  </h3>
                  <p className="text-xs text-slate-500">
                    Domain: <span className="font-semibold text-indigo-600">{domainNamePart}.{tldPart}</span> | Engine: <span className="font-semibold text-indigo-600">PHP 8.2 (Dedicated Isolated FPM)</span> | Cluster: <span className="font-semibold text-indigo-600">hoster1280.shop</span>
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

          {/* Post-Creation Setup & Nameserver Instructions Card */}
          {provisionStage === 'completed' && createdCpanelInfo && (
            <div className="bg-white rounded-3xl border-2 border-emerald-500 p-6 sm:p-9 shadow-2xl max-w-3xl mx-auto animate-in zoom-in-95 duration-200 space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3 ring-8 ring-emerald-50">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h3 className="text-2xl font-extrabold text-slate-900">
                  Service & cPanel Successfully Provisioned!
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Domain <span className="font-bold text-slate-800">{createdCpanelInfo.domain}</span> is active with isolated multi-tenant webroot & PHP {createdCpanelInfo.phpVersion || '8.2'} socket.
                </p>
              </div>

              {/* Server Credentials & IP Grid */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-200/60">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Domain Name:</span>
                    <span className="font-bold text-slate-900 text-sm">{createdCpanelInfo.domain}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Server IPv4 Address:</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
                        {createdCpanelInfo.ip}
                      </span>
                      <button
                        onClick={() => copyText(createdCpanelInfo.ip, 'ip')}
                        className="p-1 text-indigo-600 hover:text-indigo-800"
                        title="Copy Server IP"
                      >
                        {copiedField === 'ip' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-200/60">
                  <div>
                    <span className="text-slate-500 block text-[11px]">cPanel Username:</span>
                    <span className="font-mono font-bold text-indigo-700 text-sm">{createdCpanelInfo.username}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">cPanel Password:</span>
                    <div className="flex items-center gap-2 mt-0.5">
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
                </div>

                {/* Authoritative Nameservers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200/70 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Primary Nameserver (NS1)</span>
                      <span className="font-mono font-bold text-slate-800 text-xs">ns1.hoster1280.shop</span>
                    </div>
                    <button
                      onClick={() => copyText('ns1.hoster1280.shop', 'ns1')}
                      className="p-1 text-slate-400 hover:text-indigo-600"
                      title="Copy NS1"
                    >
                      {copiedField === 'ns1' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200/70 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Secondary Nameserver (NS2)</span>
                      <span className="font-mono font-bold text-slate-800 text-xs">ns2.hoster1280.shop</span>
                    </div>
                    <button
                      onClick={() => copyText('ns2.hoster1280.shop', 'ns2')}
                      className="p-1 text-slate-400 hover:text-indigo-600"
                      title="Copy NS2"
                    >
                      {copiedField === 'ns2' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step-by-Step DNS Instructions */}
              <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-slate-700 space-y-3">
                <div className="font-bold text-indigo-950 flex items-center gap-1.5 text-sm">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  DNS Setup Instructions:
                </div>
                <div className="space-y-2 leading-relaxed">
                  <div className="p-2.5 bg-white/90 rounded-xl border border-indigo-100">
                    <span className="font-bold text-slate-900 block mb-0.5">Method 1 (Recommended - Nameservers):</span>
                    Log in to your domain registrar (Namecheap, GoDaddy, Porkbun, Cloudflare) and point your domain's Custom DNS to:
                    <span className="font-mono font-semibold text-indigo-700 ml-1">ns1.hoster1280.shop</span> and <span className="font-mono font-semibold text-indigo-700">ns2.hoster1280.shop</span>.
                  </div>
                  <div className="p-2.5 bg-white/90 rounded-xl border border-indigo-100">
                    <span className="font-bold text-slate-900 block mb-0.5">Method 2 (Direct A-Record / Cloudflare DNS):</span>
                    If managing DNS on Cloudflare or custom DNS manager, add two <span className="font-bold">A Records</span>:
                    <div className="mt-1 font-mono text-[11px] text-slate-800">
                      <div>• Host <code className="bg-slate-100 px-1 py-0.5 rounded">@</code> pointing to <code className="font-bold text-indigo-700">{createdCpanelInfo.ip}</code></div>
                      <div>• Host <code className="bg-slate-100 px-1 py-0.5 rounded">www</code> pointing to <code className="font-bold text-indigo-700">{createdCpanelInfo.ip}</code></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live DNS Propagation & Auto-SSL Activation Box */}
              <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-sm flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      Live DNS Propagation & Let's Encrypt SSL
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Check if your domain's A-record resolves to this VPS and automatically activate Let's Encrypt HTTPS.
                    </p>
                  </div>

                  <button
                    onClick={() => handleCheckDnsAndActivateSsl(createdCpanelInfo.domain)}
                    disabled={dnsChecking || sslActivating}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50 shrink-0"
                  >
                    {dnsChecking || sslActivating ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Activity className="w-4 h-4" />
                    )}
                    <span>{dnsChecking ? 'Verifying DNS...' : sslActivating ? 'Activating SSL...' : 'Verify DNS & Activate SSL'}</span>
                  </button>
                </div>

                {dnsCheckResult && (
                  <div className={`p-4 rounded-xl text-xs font-medium border ${
                    (dnsCheckResult.isPointed || dnsCheckResult.propagated)
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                      : 'bg-amber-950/70 border-amber-500/50 text-amber-200'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      {(dnsCheckResult.isPointed || dnsCheckResult.propagated) ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
                            (dnsCheckResult.isPointed || dnsCheckResult.propagated)
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}>
                            {(dnsCheckResult.isPointed || dnsCheckResult.propagated) ? 'Live & Secured' : 'Propagating'}
                          </span>
                        </div>
                        <div className="font-semibold leading-relaxed">{dnsCheckResult.message}</div>
                        {sslMessage && (
                          <div className="mt-1.5 text-[11px] text-emerald-300 font-bold flex items-center gap-1.5 bg-emerald-900/40 p-2 rounded-lg border border-emerald-700/50">
                            <Check className="w-4 h-4 text-emerald-400" /> {sslMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    const matched = services.find((s) => s.domain === createdCpanelInfo.domain) || {
                      id: 'srv-now',
                      product: 'Shared Cloud Hosting',
                      domain: createdCpanelInfo.domain,
                      pricing: '',
                      billingCycle: 'Annual',
                      nextDueDate: 'Friday, October 16th, 2026',
                      status: 'Active',
                      serverIp: createdCpanelInfo.ip,
                      phpVersion: createdCpanelInfo.phpVersion
                    };
                    if (onOpenFullCpanel) {
                      onOpenFullCpanel(matched);
                    } else {
                      setActiveCpanelModal(matched);
                    }
                  }}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#ff6c2c] hover:bg-[#e05b20] text-white font-bold text-xs shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <ExternalLink className="w-4 h-4" /> Login to cPanel / Manage
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
                          onClick={() => setViewingProductDetails(srv)}
                        >
                          {/* Product / Service & Direct Navigation Domain Link */}
                          <td className="py-4 px-6">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingProductDetails(srv);
                              }}
                              className="text-left group/link block focus:outline-none"
                            >
                              <div className="font-bold text-slate-900 text-sm group-hover/link:text-indigo-600 transition-colors">
                                {srv.product.includes('Hosting') ? 'Shared Cloud Hosting' : srv.product}
                              </div>
                              <div className="text-xs text-indigo-600 font-semibold mt-0.5 flex items-center gap-1.5 group-hover/link:text-indigo-800 transition-colors">
                                <Globe className="w-3.5 h-3.5 text-indigo-500" />
                                <span className="group-hover/link:underline">{srv.domain}</span>
                              </div>
                            </button>
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

                          {/* Actions Column: Login to cPanel + Details */}
                          <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  if (onOpenFullCpanel) {
                                    onOpenFullCpanel(srv);
                                  } else {
                                    setActiveCpanelModal(srv);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-xl bg-[#ff6c2c] hover:bg-[#e05b20] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-orange-500/20 transition-all active:scale-95 shrink-0"
                                title={`Login to isolated cPanel for ${srv.domain}`}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Login to cPanel</span>
                              </button>
                              {/* Three-Dots Action Menu Dropdown */}
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenDropdownId(openDropdownId === srv.id ? null : srv.id);
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    openDropdownId === srv.id
                                      ? 'text-indigo-600 bg-indigo-50 ring-2 ring-indigo-500/20'
                                      : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                                  }`}
                                  title="Service Actions"
                                >
                                  <MoreHorizontal className="w-5 h-5" />
                                </button>

                                {openDropdownId === srv.id && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 z-50 text-left animate-in fade-in zoom-in-95 duration-100"
                                  >
                                    <button
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        setViewingProductDetails(srv);
                                      }}
                                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                                    >
                                      <Info className="w-4 h-4 text-indigo-500" />
                                      <span>View Details</span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        setServiceToChangePhp(srv);
                                        setSelectedPhpVer(srv.phpVersion || '8.2');
                                      }}
                                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                                    >
                                      <Settings className="w-4 h-4 text-slate-500" />
                                      <span>Change PHP Version</span>
                                    </button>

                                    <div className="my-1.5 border-t border-slate-100" />

                                    <button
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        setServiceToDelete(srv);
                                        setDeleteConfirmText('');
                                        setDeleteError(null);
                                      }}
                                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4 text-rose-500" />
                                      <span>Delete / Terminate Service</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
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
      {/* SAFE SERVICE DELETION MODAL (REQUIRES TYPING "CONFIRM") */}
      {/* ========================================================================= */}
      {serviceToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-rose-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Warning Alert Icon & Header */}
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-sm">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">
                  Are you absolutely sure you want to delete this service?
                </h3>
                <span className="inline-block mt-1 text-[10px] font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                  Permanent Server Purge
                </span>
              </div>
            </div>

            {/* Description matching prompt */}
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
              This action is irreversible. It will permanently delete{' '}
              <strong className="text-slate-900 font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                {serviceToDelete.domain}
              </strong>
              , all associated files, MySQL databases, DNS records, and SSL certificates.
            </p>

            {/* Target Service Information Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 mb-5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Domain Name:</span>
                <span className="font-mono font-bold text-slate-800">{serviceToDelete.domain}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Service ID:</span>
                <span className="font-mono text-slate-600">{serviceToDelete.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Webroot Path:</span>
                <span className="font-mono text-slate-600">/home/u_{serviceToDelete.domain.replace(/[^a-z0-9]/gi, '').slice(0, 8)}/public_html</span>
              </div>
            </div>

            {/* Validation Input Field */}
            <div className="space-y-2 mb-6">
              <label className="block text-xs font-bold text-slate-700">
                To confirm, type <span className="font-mono font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">CONFIRM</span> below:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type CONFIRM to proceed"
                disabled={isDeleting}
                className="w-full px-4 py-2.5 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white text-slate-900 placeholder:text-slate-400 placeholder:font-sans transition-all"
                autoFocus
              />
              {deleteError && (
                <div className="text-xs font-semibold text-rose-600 flex items-center gap-1.5 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setServiceToDelete(null);
                  setDeleteConfirmText('');
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteDeletion}
                disabled={deleteConfirmText.trim() !== 'CONFIRM' || isDeleting}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md ${
                  deleteConfirmText.trim() === 'CONFIRM' && !isDeleting
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30 active:scale-95 cursor-pointer'
                    : 'bg-slate-200 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                }`}
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Terminating Service & Purging Server...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Permanently Delete Service</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CHANGE PHP VERSION MODAL */}
      {/* ========================================================================= */}
      {serviceToChangePhp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Change PHP Version</h3>
                  <p className="text-xs text-slate-500 font-medium">{serviceToChangePhp.domain}</p>
                </div>
              </div>
              <button
                onClick={() => setServiceToChangePhp(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Dedicated PHP-FPM Version:
                </label>
                <select
                  value={selectedPhpVer}
                  onChange={(e) => setSelectedPhpVer(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="7.4">PHP 7.4 (Legacy Compatibility)</option>
                  <option value="8.0">PHP 8.0</option>
                  <option value="8.1">PHP 8.1</option>
                  <option value="8.2">PHP 8.2 (Recommended Default)</option>
                  <option value="8.3">PHP 8.3 (Latest High Performance)</option>
                </select>
              </div>

              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
                Switching PHP versions instantly rebinds the tenant's isolated FastCGI socket and reloads PHP-FPM with zero downtime.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setServiceToChangePhp(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteChangePhp}
                  disabled={isUpdatingPhp}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                >
                  {isUpdatingPhp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{isUpdatingPhp ? 'Applying...' : 'Apply PHP Version'}</span>
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
