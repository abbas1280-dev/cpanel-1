import React, { useState } from 'react';
import {
  Box,
  Server,
  User,
  Lock,
  Globe,
  Info,
  Layers,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Mail,
  KeyRound,
  Shield,
  Activity,
  Calendar,
  CreditCard,
  Settings,
  Cpu,
  HardDrive,
  Wifi,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  X
} from 'lucide-react';
import { ServiceItem, ServerMetrics } from '../types';

interface ProductDetailsViewProps {
  service: ServiceItem;
  onBack: () => void;
  onOpenCpanel: (service: ServiceItem) => void;
  serverMetrics?: ServerMetrics | null;
}

export const ProductDetailsView: React.FC<ProductDetailsViewProps> = ({
  service,
  onBack,
  onOpenCpanel,
  serverMetrics
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'billing' | 'domain' | 'config'>('billing');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Real physical domain usage on host disk
  const [domainUsage, setDomainUsage] = useState<{ bytes: number; mb: string } | null>(null);

  React.useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch(`/api/domains/usage?domain=${encodeURIComponent(service.domain)}`);
        if (res.ok) {
          const data = await res.json();
          setDomainUsage(data);
        }
      } catch (e) {
        console.error('Failed to fetch domain usage', e);
      }
    };
    fetchUsage();
  }, [service.domain]);

  // Modals
  const [showWebmailModal, setShowWebmailModal] = useState(false);
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [passUpdateSuccess, setPassUpdateSuccess] = useState(false);

  // Dynamic real credentials
  const username = `${service.domain.split('.')[0].slice(0, 7).replace(/[^a-zA-Z0-9]/g, '')}1`.toLowerCase();
  const [cpanelPassword, setCpanelPassword] = useState('Sec#Host2026!Key');
  const liveIp = serverMetrics?.serverIp || service.serverIp || '192.168.0.104';
  const serverHost = serverMetrics?.hostname ? `${serverMetrics.hostname.toLowerCase()}.local` : 'hoster1280.shop';
  const ns1 = service.nameservers?.[0] || 'ns1.hoster1280.shop';
  const ns2 = service.nameservers?.[1] || 'ns2.hoster1280.shop';

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handlePasswordChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasswordInput !== confirmPasswordInput) {
      alert('New password and confirm password do not match!');
      return;
    }
    setCpanelPassword(newPasswordInput);
    setPassUpdateSuccess(true);
    setTimeout(() => {
      setPassUpdateSuccess(false);
      setShowChangePassModal(false);
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setCurrentPasswordInput('');
    }, 1500);
  };

  const isActive = service.status === 'Active';
  const isCancelled = service.status === 'Cancelled';
  const isTerminated = service.status === 'Terminated';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Breadcrumb matching screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={onBack}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-xs text-slate-400 font-medium">
              Portal Home / Client Area / My Products & Services / <span className="text-slate-700 font-semibold">Product Details</span>
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Product Details
          </h1>
        </div>

        <button
          onClick={() => onOpenCpanel(service)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ff6c2c] hover:bg-[#e05b20] text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all active:scale-95"
        >
          <ExternalLink className="w-4 h-4" /> Open cPanel
        </button>
      </div>

      {/* Main Grid: Left Sidebar & Right Content matching screenshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Overview, Actions, Service Information (Matching screenshot) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-3 space-y-5">
          {/* Overview Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider px-1">
              Overview
            </h3>
            <div className="bg-[#eef2ff] border border-indigo-100 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 text-xs font-bold text-indigo-700 shadow-sm">
              <div className="w-4 h-4 flex items-center justify-center">
                <span className="grid grid-cols-2 gap-0.5">
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-sm"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-sm"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-sm"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-sm"></span>
                </span>
              </div>
              <span>Information</span>
            </div>
          </div>

          {/* Actions Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider px-1">
              Actions
            </h3>
            <div className="bg-white rounded-2xl border border-slate-200/80 p-2 space-y-1 shadow-sm">
              <button
                onClick={() => onOpenCpanel(service)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-colors text-left"
              >
                <User className="w-4 h-4 text-slate-400" />
                <span>Log in to cPanel</span>
              </button>
              <button
                onClick={() => setShowWebmailModal(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-colors text-left"
              >
                <Mail className="w-4 h-4 text-slate-400" />
                <span>Log in to Webmail</span>
              </button>
              <button
                onClick={() => setShowChangePassModal(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-colors text-left"
              >
                <Lock className="w-4 h-4 text-slate-400" />
                <span>Change Password</span>
              </button>
            </div>
          </div>

          {/* Service Information Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider px-1">
              Service Information
            </h3>
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 space-y-3 shadow-sm text-xs font-mono">
              {/* cPanel username */}
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-2.5 text-slate-700 font-semibold truncate">
                  <User className="w-4 h-4 text-slate-400 shrink-0 font-sans" />
                  <span className="truncate">{username}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(username, 'user')}
                  className="text-slate-400 hover:text-indigo-600 p-1"
                  title="Copy username"
                >
                  {copiedKey === 'user' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* cPanel password */}
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-2.5 text-slate-700 font-semibold truncate">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0 font-sans" />
                  <span className="truncate">
                    {showPassword ? cpanelPassword : '••••••••••••'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-indigo-600 p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(cpanelPassword, 'pass')}
                    className="text-slate-400 hover:text-indigo-600 p-1"
                    title="Copy password"
                  >
                    {copiedKey === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Domain Name */}
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-2.5 text-slate-700 font-semibold truncate">
                  <Globe className="w-4 h-4 text-slate-400 shrink-0 font-sans" />
                  <span className="truncate">{service.domain}</span>
                </div>
                <a
                  href={`https://${service.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-indigo-600 p-1"
                  title="Visit website"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Dedicated IP */}
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-2.5 text-slate-700 truncate">
                  <Info className="w-4 h-4 text-slate-400 shrink-0 font-sans" />
                  <span className="text-slate-600 truncate font-mono">['{liveIp}']</span>
                </div>
                <button
                  onClick={() => copyToClipboard(liveIp, 'ip')}
                  className="text-slate-400 hover:text-indigo-600 p-1"
                  title="Copy IP"
                >
                  {copiedKey === 'ip' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Server Hostname */}
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-2.5 text-slate-700 truncate">
                  <Server className="w-4 h-4 text-slate-400 shrink-0 font-sans" />
                  <span className="text-slate-600 truncate">['{serverHost}']</span>
                </div>
                <button
                  onClick={() => copyToClipboard(serverHost, 'host')}
                  className="text-slate-400 hover:text-indigo-600 p-1"
                  title="Copy Host"
                >
                  {copiedKey === 'host' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Nameserver 1 */}
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-2.5 text-slate-700 truncate">
                  <Globe className="w-4 h-4 text-slate-400 shrink-0 font-sans" />
                  <span className="text-slate-600 truncate">['{ns1}']</span>
                </div>
                <button
                  onClick={() => copyToClipboard(ns1, 'ns1')}
                  className="text-slate-400 hover:text-indigo-600 p-1"
                  title="Copy NS1"
                >
                  {copiedKey === 'ns1' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Nameserver 2 */}
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-2.5 text-slate-700 truncate">
                  <Globe className="w-4 h-4 text-slate-400 shrink-0 font-sans" />
                  <span className="text-slate-600 truncate">['{ns2}']</span>
                </div>
                <button
                  onClick={() => copyToClipboard(ns2, 'ns2')}
                  className="text-slate-400 hover:text-indigo-600 p-1"
                  title="Copy NS2"
                >
                  {copiedKey === 'ns2' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Big Service Badge, Usage Gauges, Alert, Bottom Tabs */}
        {/* ========================================================================= */}
        <div className="lg:col-span-9 space-y-6">
          {/* Top Row: Service Banner & Resource Gauges (Matching screenshot) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Card: Deep Navy Blue Service Badge */}
            <div className="md:col-span-6 bg-[#11074a] text-white rounded-2xl p-7 flex flex-col items-center justify-between text-center shadow-md relative overflow-hidden min-h-[260px]">
              <div className="pt-2">
                {/* 3D Cube / Server Icon matching screenshot */}
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-inner">
                  <Box className="w-9 h-9 text-white stroke-[1.6]" />
                </div>

                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white px-2 leading-snug">
                  Premium Hosting - Shared Cloud Hosting
                </h2>

                <div className="mt-2.5 flex items-center justify-center gap-1.5">
                  <span className="text-xs text-indigo-200/80 font-medium">Status:</span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : isCancelled
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        : 'bg-slate-500/30 text-slate-300'
                    }`}
                  >
                    {service.status}
                  </span>
                </div>
              </div>

              {/* Bottom Domain Ribbon */}
              <div className="w-full pt-4 border-t border-indigo-900/80">
                <span className="text-sm font-semibold tracking-wide text-indigo-100 flex items-center justify-center gap-1.5">
                  <Globe className="w-4 h-4 text-blue-400" />
                  {service.domain}
                </span>
              </div>
            </div>

            {/* Right Card: Usage Gauges Card (Disk, Bandwidth & CPU Usage) */}
            <div className="md:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col justify-between shadow-sm min-h-[260px]">
              <div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {/* 1. Disk Usage Gauge */}
                  <div>
                    <span className="text-xs font-bold text-slate-600 block mb-2">Disk Usage</span>
                    <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                      {/* SVG Ring Gauge */}
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-100"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-blue-600"
                          strokeDasharray={`${serverMetrics?.disk.percentUsed || 45}, 100`}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span className="absolute text-sm font-extrabold text-slate-800">
                        {serverMetrics ? `${Math.round(Number(serverMetrics.disk.percentUsed))}%` : '45%'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium block mt-2">
                      {domainUsage ? domainUsage.mb : '0.05 MB'} / Pool
                    </span>
                  </div>

                  {/* 2. Bandwidth Usage Gauge */}
                  <div>
                    <span className="text-xs font-bold text-slate-600 block mb-2">Bandwidth</span>
                    <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-100"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-indigo-500"
                          strokeDasharray="10, 100"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span className="absolute text-xs font-extrabold text-slate-800">Live</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium block mt-2">
                      Unmetered / Pool
                    </span>
                  </div>

                  {/* 3. CPU Usage Gauge */}
                  <div>
                    <span className="text-xs font-bold text-slate-600 block mb-2">CPU Usage</span>
                    <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-100"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-emerald-500"
                          strokeDasharray={`${serverMetrics?.cpu.usagePercent || 15}, 100`}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span className="absolute text-sm font-extrabold text-slate-800">
                        {serverMetrics ? `${Math.round(serverMetrics.cpu.usagePercent)}%` : '15%'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium block mt-2">
                      {serverMetrics?.cpu.cores || 12} Cores Pool
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer matching screenshot */}
              <div className="pt-3 border-t border-slate-100 text-center">
                <span className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1">
                  <RefreshCw className="w-3 h-3 text-emerald-500 animate-spin" />
                  Live Host: {serverMetrics?.hostname || 'DESKTOP-1HFM8RA'} ({serverMetrics?.serverIp || '192.168.0.104'})
                </span>
              </div>
            </div>
          </div>

          {/* Alert / Notice Banner matching screenshot */}
          <div
            className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-center text-center ${
              isActive
                ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-800'
                : isCancelled
                ? 'bg-amber-50/70 border-amber-300 text-amber-800'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            {isActive
              ? 'This hosting package is currently Active and running on HOSTER 1280 High-Performance Cloud Cluster.'
              : isCancelled
              ? 'This hosting package is currently Cancelled.'
              : 'This hosting package is currently Terminated.'}
          </div>

          {/* Bottom Tabbed Card (Billing Overview, Domain, Configurable Options) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {/* Tab Headers */}
            <div className="flex border-b border-slate-200/80 bg-slate-50/50 px-6 pt-3 gap-6">
              <button
                onClick={() => setActiveSubTab('billing')}
                className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors ${
                  activeSubTab === 'billing'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Billing Overview
              </button>

              <button
                onClick={() => setActiveSubTab('domain')}
                className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors ${
                  activeSubTab === 'domain'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Globe className="w-4 h-4" />
                Domain
              </button>

              <button
                onClick={() => setActiveSubTab('config')}
                className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors ${
                  activeSubTab === 'config'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Settings className="w-4 h-4" />
                Configurable Options
              </button>
            </div>

            {/* Tab 1: Billing Overview Content matching screenshot */}
            {activeSubTab === 'billing' && (
              <div className="p-6 sm:p-7 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div>
                    <span className="text-xs text-slate-400 font-medium block">Registration Date</span>
                    <span className="text-xs font-bold text-slate-800 block mt-1">
                      Saturday, January 10th, 2026
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 font-medium block">Billing Cycle</span>
                    <span className="text-xs font-bold text-slate-800 block mt-1">
                      {service.billingCycle || 'Monthly'}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 font-medium block">Next Due Date</span>
                    <span className="text-xs font-bold text-slate-800 block mt-1">
                      {service.nextDueDate}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 font-medium block">Cloud Cluster</span>
                    <span className="text-xs font-bold text-indigo-600 block mt-1">
                      Node-01 (Dhaka Datacenter)
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <span className="text-xs text-slate-400 font-medium block">Payment Method</span>
                  <span className="text-xs font-bold text-slate-800 block mt-1">
                    bKash Merchant (Checkout-url) / Automated Gateway
                  </span>
                </div>
              </div>
            )}

            {/* Tab 2: Domain Content */}
            {activeSubTab === 'domain' && (
              <div className="p-6 sm:p-7 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                    <span className="text-slate-400 block mb-1">Primary Domain</span>
                    <span className="font-bold text-slate-800 text-sm">{service.domain}</span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                    <span className="text-slate-400 block mb-1">DNS Resolution</span>
                    <span className="font-bold text-emerald-600 text-sm flex items-center gap-1">
                      <Check className="w-4 h-4" /> Propagated
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                    <span className="text-slate-400 block mb-1">SSL Certificate</span>
                    <span className="font-bold text-indigo-600 text-sm flex items-center gap-1">
                      <Shield className="w-4 h-4" /> Let's Encrypt TLS
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Configurable Options Content */}
            {activeSubTab === 'config' && (
              <div className="p-6 sm:p-7 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                    <span className="text-slate-600">Web Server Engine:</span>
                    <span className="font-bold text-slate-800">LiteSpeed Enterprise</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                    <span className="text-slate-600">Active PHP Version:</span>
                    <span className="font-bold text-slate-800">PHP 8.3 (ea-php83)</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                    <span className="text-slate-600">Database Engine:</span>
                    <span className="font-bold text-slate-800">MariaDB 10.11</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                    <span className="text-slate-600">Resource Pool:</span>
                    <span className="font-bold text-indigo-600">Shared 100 GB NVMe</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* WEBMAIL SIMULATOR MODAL */}
      {/* ========================================================================= */}
      {showWebmailModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Roundcube Webmail Client</h3>
                  <p className="text-xs text-slate-500 font-mono">webmail.{service.domain}</p>
                </div>
              </div>
              <button
                onClick={() => setShowWebmailModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 mb-5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Logged in as:</span>
                <span className="font-bold text-slate-800">admin@{service.domain}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Inbox:</span>
                <span className="font-bold text-emerald-600">0 unread / 3 total messages</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Mail Storage:</span>
                <span className="font-semibold text-slate-700">12.4 MB Used</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs hover:bg-slate-50 cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 block">HOSTER 1280 System Mailer</span>
                  <span className="text-slate-500 text-[11px]">Welcome to your new cPanel web hosting service!</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Today, 03:40</span>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowWebmailModal(false)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700"
              >
                Close Webmail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CHANGE PASSWORD MODAL */}
      {/* ========================================================================= */}
      {showChangePassModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Change cPanel Password</h3>
                  <p className="text-xs text-slate-500 font-mono">{service.domain}</p>
                </div>
              </div>
              <button
                onClick={() => setShowChangePassModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passUpdateSuccess ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Password Updated Successfully!</h4>
                <p className="text-xs text-slate-500">Your new cPanel password is now active.</p>
              </div>
            ) : (
              <form onSubmit={handlePasswordChangeSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">New cPanel Password</label>
                  <input
                    type="password"
                    required
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowChangePassModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/20"
                  >
                    Update Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
