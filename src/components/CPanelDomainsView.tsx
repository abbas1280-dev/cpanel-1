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
  ExternalLink as LinkIcon,
  Activity,
  Copy,
  Terminal,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
  Edit3
} from 'lucide-react';
import {
  ServiceItem,
  ServerMetrics,
  CPanelDomainItem,
  DomainType,
  DomainSubTab,
  RedirectItem,
  DnsRecordItem,
  DdnsTokenItem,
  PingDiagnosticResult
} from '../types';

interface CPanelDomainsViewProps {
  currentService?: ServiceItem;
  allServices: ServiceItem[];
  serverMetrics?: ServerMetrics | null;
  initialTab?: DomainSubTab;
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
  initialTab = 'domains',
  onExit,
  onOpenFileManager
}) => {
  // Selected Domain Environment
  const [activeMainDomain, setActiveMainDomain] = useState<string>(
    currentService?.domain || (allServices.length > 0 ? allServices[0].domain : 'turkyhub.com')
  );

  const domainUsername = activeMainDomain.split('.')[0].slice(0, 7).toLowerCase() + '1';

  // Active SubTab: 'domains' | 'subdomains' | 'addon' | 'aliases' | 'redirects' | 'zone_editor' | 'ddns'
  const [activeTab, setActiveTab] = useState<DomainSubTab>(initialTab || 'domains');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Domains Data from live server
  const [domains, setDomains] = useState<CPanelDomainItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Success Notification Banner
  const [successBanner, setSuccessBanner] = useState<{
    domain: string;
    docRoot: string;
    type: string;
  } | null>(null);

  // Search & Filters for Domains Tab
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'primary' | 'subdomain' | 'addon' | 'alias'>('all');
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>('');

  // Subdomains Form State
  const [subdomainPrefix, setSubdomainPrefix] = useState<string>('');
  const [subdomainParent, setSubdomainParent] = useState<string>(activeMainDomain);
  const [subdomainCustomDoc, setSubdomainCustomDoc] = useState<string>('');
  const [subdomainHttps, setSubdomainHttps] = useState<boolean>(true);

  // Addon Domains Form State
  const [addonDomainName, setAddonDomainName] = useState<string>('');
  const [addonSubdomainUser, setAddonSubdomainUser] = useState<string>('');
  const [addonCustomDoc, setAddonCustomDoc] = useState<string>('');
  const [addonHttps, setAddonHttps] = useState<boolean>(true);

  // Aliases Form State
  const [aliasDomainName, setAliasDomainName] = useState<string>('');
  const [aliasTargetDomain, setAliasTargetDomain] = useState<string>(activeMainDomain);

  // Redirects Form & Data State
  const [redirects, setRedirects] = useState<RedirectItem[]>([]);
  const [loadingRedirects, setLoadingRedirects] = useState<boolean>(false);
  const [redDomain, setRedDomain] = useState<string>(activeMainDomain);
  const [redDirectory, setRedDirectory] = useState<string>('');
  const [redTargetUrl, setRedTargetUrl] = useState<string>('https://');
  const [redType, setRedType] = useState<'permanent' | 'temporary'>('permanent');

  // DNS Zone Editor Form & Data State
  const [zoneDomain, setZoneDomain] = useState<string>(activeMainDomain);
  const [zoneRecords, setZoneRecords] = useState<DnsRecordItem[]>([]);
  const [zoneServerIp, setZoneServerIp] = useState<string>('208.72.218.129');
  const [loadingZone, setLoadingZone] = useState<boolean>(false);
  const [zoneTypeFilter, setZoneTypeFilter] = useState<string>('ALL');
  const [zoneSearchQuery, setZoneSearchQuery] = useState<string>('');
  const [showAddRecord, setShowAddRecord] = useState<boolean>(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordFormName, setRecordFormName] = useState<string>('');
  const [recordFormType, setRecordFormType] = useState<string>('A');
  const [recordFormTtl, setRecordFormTtl] = useState<number>(14400);
  const [recordFormRecord, setRecordFormRecord] = useState<string>('');
  const [recordFormPriority, setRecordFormPriority] = useState<number>(10);

  // DDNS Form & Data State
  const [ddnsTokens, setDdnsTokens] = useState<DdnsTokenItem[]>([]);
  const [loadingDdns, setLoadingDdns] = useState<boolean>(false);
  const [ddnsSubdomainPrefix, setDdnsSubdomainPrefix] = useState<string>('');
  const [newlyCreatedDdns, setNewlyCreatedDdns] = useState<DdnsTokenItem | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // Diagnostics & Ping Modal State
  const [diagnosticDomain, setDiagnosticDomain] = useState<string | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState<boolean>(false);
  const [diagnosticResult, setDiagnosticResult] = useState<PingDiagnosticResult | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  // General Submit Loading
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Manage Modal State (Existing)
  const [managingDomain, setManagingDomain] = useState<CPanelDomainItem | null>(null);
  const [manageTab, setManageTab] = useState<'general' | 'dns' | 'vhost' | 'ssl' | 'delete'>('general');
  const [manageRedirectInput, setManageRedirectInput] = useState<string>('');
  const [isSavingManage, setIsSavingManage] = useState<boolean>(false);
  const [dnsModalRecords, setDnsModalRecords] = useState<any[]>([]);
  const [loadingDnsModal, setLoadingDnsModal] = useState<boolean>(false);
  const [vhostConfigs, setVhostConfigs] = useState<{ apache: string; nginx: string } | null>(null);
  const [loadingVhost, setLoadingVhost] = useState<boolean>(false);
  const [purgeDocRootFiles, setPurgeDocRootFiles] = useState<boolean>(false);
  const [isDeletingDomain, setIsDeletingDomain] = useState<boolean>(false);

  // 1. Fetch Domains
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

  // 2. Fetch Redirects
  const fetchRedirects = async () => {
    setLoadingRedirects(true);
    try {
      const res = await fetch(`/api/cpanel/domains/redirects?domain=${encodeURIComponent(activeMainDomain)}`);
      if (res.ok) {
        const data = await res.json();
        setRedirects(data.redirects || []);
      }
    } catch (e) {
      console.error('Failed to load redirects', e);
    } finally {
      setLoadingRedirects(false);
    }
  };

  // 3. Fetch DNS Zone
  const fetchDnsZone = async (domainToFetch?: string) => {
    const target = domainToFetch || zoneDomain || activeMainDomain;
    setLoadingZone(true);
    try {
      const res = await fetch(`/api/cpanel/dns/zone?domain=${encodeURIComponent(target)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setZoneRecords(data.records || []);
          if (data.serverIp) setZoneServerIp(data.serverIp);
        }
      }
    } catch (e) {
      console.error('Failed to fetch DNS zone', e);
    } finally {
      setLoadingZone(false);
    }
  };

  // 4. Fetch DDNS Tokens
  const fetchDdnsTokens = async () => {
    setLoadingDdns(true);
    try {
      const res = await fetch(`/api/cpanel/ddns/tokens?domain=${encodeURIComponent(activeMainDomain)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDdnsTokens(data.tokens || []);
        }
      }
    } catch (e) {
      console.error('Failed to fetch DDNS tokens', e);
    } finally {
      setLoadingDdns(false);
    }
  };

  useEffect(() => {
    fetchDomains();
    setSelectedDomains(new Set());
    setSubdomainParent(activeMainDomain);
    setRedDomain(activeMainDomain);
    setZoneDomain(activeMainDomain);
    setAliasTargetDomain(activeMainDomain);
  }, [activeMainDomain]);

  useEffect(() => {
    if (activeTab === 'redirects') {
      fetchRedirects();
    } else if (activeTab === 'zone_editor') {
      fetchDnsZone();
    } else if (activeTab === 'ddns') {
      fetchDdnsTokens();
    }
  }, [activeTab, activeMainDomain]);

  // Auto-fill suggested document root when Subdomain prefix changes (Outside public_html - Rule #9)
  useEffect(() => {
    if (subdomainPrefix.trim()) {
      const clean = subdomainPrefix.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      setSubdomainCustomDoc(`subdomains/${clean}`);
    } else {
      setSubdomainCustomDoc('');
    }
  }, [subdomainPrefix, subdomainParent]);

  // Auto-fill suggested document root & user when Addon Domain changes
  useEffect(() => {
    if (addonDomainName.trim()) {
      const clean = addonDomainName.trim().toLowerCase().replace(/[^a-z0-9.-]/g, '');
      const shortUser = clean.split('.')[0].slice(0, 8);
      setAddonSubdomainUser(shortUser);
      setAddonCustomDoc(`domains/${clean}`);
    } else {
      setAddonSubdomainUser('');
      setAddonCustomDoc('');
    }
  }, [addonDomainName]);

  // DNS Inspection for Manage Modal
  useEffect(() => {
    if (managingDomain && manageTab === 'dns') {
      setLoadingDnsModal(true);
      fetch(`/api/cpanel/domains/dns?domain=${encodeURIComponent(activeMainDomain)}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            setDnsModalRecords(d.records || []);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingDnsModal(false));
    }
  }, [managingDomain, manageTab, activeMainDomain]);

  // VHost Inspection for Manage Modal
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

  // Run Diagnostics / Ping Test
  const handleRunDiagnostics = async (domainName: string) => {
    setDiagnosticDomain(domainName);
    setDiagnosticLoading(true);
    setDiagnosticError(null);
    setDiagnosticResult(null);

    try {
      const res = await fetch('/api/cpanel/diagnostics/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainDomain: activeMainDomain,
          domain: domainName
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDiagnosticResult(data.result);
      } else {
        setDiagnosticError(data.error || 'Failed to run diagnostic ping check.');
      }
    } catch (e: any) {
      setDiagnosticError(e.message || 'Network error running diagnostics.');
    } finally {
      setDiagnosticLoading(false);
    }
  };

  // Create Subdomain
  const handleCreateSubdomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subdomainPrefix.trim()) {
      alert('Please enter a subdomain prefix (e.g. blog, store, app).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const docRoot = subdomainCustomDoc.trim().startsWith('/')
      ? subdomainCustomDoc.trim()
      : `/${subdomainCustomDoc.trim()}`;

    try {
      const res = await fetch('/api/cpanel/domains/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainDomain: activeMainDomain,
          prefix: subdomainPrefix.trim().toLowerCase(),
          parentDomain: subdomainParent,
          documentRoot: docRoot,
          type: 'subdomain',
          forceHttps: subdomainHttps
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessBanner({
          domain: data.domain.domain,
          docRoot: data.domain.documentRoot,
          type: 'Subdomain'
        });
        setSubdomainPrefix('');
        setSubdomainCustomDoc('');
        await fetchDomains();
        setActiveTab('domains');
      } else {
        setErrorMsg(data.error || 'Failed to create subdomain.');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Network error connecting to local server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Addon Domain
  const handleCreateAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addonDomainName.trim()) {
      alert('Please enter a domain name (e.g. mynewclient.com).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const docRoot = addonCustomDoc.trim().startsWith('/')
      ? addonCustomDoc.trim()
      : `/${addonCustomDoc.trim()}`;

    try {
      const res = await fetch('/api/cpanel/domains/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainDomain: activeMainDomain,
          domain: addonDomainName.trim().toLowerCase(),
          subdomainUsername: addonSubdomainUser.trim(),
          documentRoot: docRoot,
          type: 'addon',
          forceHttps: addonHttps
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessBanner({
          domain: data.domain.domain,
          docRoot: data.domain.documentRoot,
          type: 'Addon Domain'
        });
        setAddonDomainName('');
        setAddonSubdomainUser('');
        setAddonCustomDoc('');
        await fetchDomains();
        setActiveTab('domains');
      } else {
        setErrorMsg(data.error || 'Failed to create addon domain.');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Network error connecting to local server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Alias (Parked Domain)
  const handleCreateAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aliasDomainName.trim()) {
      alert('Please enter an alias domain name (e.g. domainalias.com).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/cpanel/domains/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainDomain: activeMainDomain,
          domain: aliasDomainName.trim().toLowerCase(),
          parentDomain: aliasTargetDomain,
          documentRoot: '/public_html',
          type: 'alias',
          forceHttps: true
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessBanner({
          domain: data.domain.domain,
          docRoot: data.domain.documentRoot,
          type: 'Domain Alias'
        });
        setAliasDomainName('');
        await fetchDomains();
        setActiveTab('aliases');
      } else {
        setErrorMsg(data.error || 'Failed to create domain alias.');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Network error connecting to local server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Redirect (301/302)
  const handleCreateRedirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redTargetUrl.trim() || (!redTargetUrl.startsWith('http://') && !redTargetUrl.startsWith('https://'))) {
      alert('Target redirect URL must start with http:// or https://');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/cpanel/domains/redirect/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainDomain: activeMainDomain,
          domain: redDomain,
          directory: redDirectory.trim() || '/',
          redirectUrl: redTargetUrl.trim(),
          type: redType,
          matchType: 'all'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRedDirectory('');
        setRedTargetUrl('https://');
        await fetchRedirects();
        alert('Redirection rule added and Nginx reloaded successfully!');
      } else {
        alert(data.error || 'Failed to create redirect.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error while adding redirect.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Redirect
  const handleDeleteRedirect = async (id: string) => {
    if (!confirm('Are you sure you want to remove this redirect rule?')) return;
    try {
      const res = await fetch('/api/cpanel/domains/redirect/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainDomain: activeMainDomain,
          id
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchRedirects();
      } else {
        alert(data.error || 'Failed to remove redirect.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error removing redirect.');
    }
  };

  // Save / Add DNS Record in Zone Editor
  const handleSaveDnsRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordFormName.trim() || !recordFormRecord.trim()) {
      alert('Name and Record value are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = editingRecordId ? '/api/cpanel/dns/record/update' : '/api/cpanel/dns/record/create';
      const payload: any = {
        mainDomain: zoneDomain,
        record: {
          id: editingRecordId || undefined,
          name: recordFormName.trim(),
          type: recordFormType,
          ttl: Number(recordFormTtl) || 14400,
          record: recordFormRecord.trim(),
          priority: recordFormType === 'MX' ? Number(recordFormPriority) || 10 : undefined
        }
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowAddRecord(false);
        setEditingRecordId(null);
        setRecordFormName('');
        setRecordFormRecord('');
        await fetchDnsZone(zoneDomain);
        alert(`DNS ${editingRecordId ? 'updated' : 'added'} and Bind9 zone reloaded successfully!`);
      } else {
        alert(data.error || 'Failed to save DNS record.');
      }
    } catch (e) {
      console.error(e);
      alert('Error saving DNS record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete DNS Record
  const handleDeleteDnsRecord = async (recordId: string) => {
    if (!confirm('Are you sure you want to delete this DNS record?')) return;
    try {
      const res = await fetch('/api/cpanel/dns/record/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainDomain: zoneDomain,
          recordId
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchDnsZone(zoneDomain);
      } else {
        alert(data.error || 'Failed to delete DNS record.');
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting DNS record.');
    }
  };

  // Generate Dynamic DNS Token
  const handleGenerateDdnsToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ddnsSubdomainPrefix.trim()) {
      alert('Please enter a subdomain prefix for Dynamic DNS (e.g. home, vpn, router).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/cpanel/ddns/tokens/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainDomain: activeMainDomain,
          subdomain: ddnsSubdomainPrefix.trim().toLowerCase()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewlyCreatedDdns(data.item);
        setDdnsSubdomainPrefix('');
        await fetchDdnsTokens();
      } else {
        alert(data.error || 'Failed to generate DDNS token.');
      }
    } catch (e) {
      console.error(e);
      alert('Error generating DDNS token.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete DDNS Token
  const handleDeleteDdnsToken = async (id: string) => {
    if (!confirm('Revoke this Dynamic DNS token? Existing scripts will no longer be able to update DNS.')) return;
    try {
      const res = await fetch('/api/cpanel/ddns/tokens/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainDomain: activeMainDomain,
          id
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchDdnsTokens();
      } else {
        alert(data.error || 'Failed to revoke token.');
      }
    } catch (e) {
      console.error(e);
      alert('Error revoking token.');
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

  // Filtered Domains
  const filteredDomains = useMemo(() => {
    return domains.filter(d => {
      const matchSearch =
        d.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.documentRoot.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (filterType === 'primary') return d.isMain || d.type === 'primary';
      if (filterType === 'subdomain') return d.type === 'subdomain';
      if (filterType === 'addon') return d.type === 'addon';
      if (filterType === 'alias') return d.type === 'alias';
      return true;
    });
  }, [domains, searchQuery, filterType]);

  const subdomainItems = useMemo(() => domains.filter(d => !d.isMain && d.type === 'subdomain'), [domains]);
  const addonItems = useMemo(() => domains.filter(d => d.type === 'addon'), [domains]);
  const aliasItems = useMemo(() => domains.filter(d => d.type === 'alias'), [domains]);

  // Statistics
  const stats = useMemo(() => {
    let primary = 0, sub = 0, addon = 0, alias = 0;
    for (const d of domains) {
      if (d.isMain || d.type === 'primary') primary++;
      else if (d.type === 'addon') addon++;
      else if (d.type === 'alias') alias++;
      else sub++;
    }
    return { total: domains.length, primary, sub, addon, alias };
  }, [domains]);

  // Filtered Zone Records
  const filteredZoneRecords = useMemo(() => {
    return zoneRecords.filter(r => {
      const matchType = zoneTypeFilter === 'ALL' || r.type === zoneTypeFilter;
      const matchSearch =
        r.name.toLowerCase().includes(zoneSearchQuery.toLowerCase()) ||
        r.record.toLowerCase().includes(zoneSearchQuery.toLowerCase());
      return matchType && matchSearch;
    });
  }, [zoneRecords, zoneTypeFilter, zoneSearchQuery]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

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
              <div className="w-7 h-7 rounded-lg bg-[#ff6c2c] text-white flex items-center justify-center font-black text-xs shadow-xs">
                cP
              </div>
              <div>
                <span className="font-extrabold text-sm tracking-tight font-mono text-slate-900 block leading-tight">
                  Domains Suite
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Nginx + Bind9 DNS Engine</span>
              </div>
            </div>
          </div>

          {/* Center: Account Switcher */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Globe className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-semibold text-slate-500">Active Domain:</span>
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

          {/* Right: Diagnostic status badge */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunDiagnostics(activeMainDomain)}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition-colors flex items-center gap-1.5"
              title="Run Live DNS & Server Diagnostics"
            >
              <Activity className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
              <span className="hidden sm:inline">Diagnostic Ping</span>
            </button>
          </div>
        </div>

        {/* SubTab Navigation Bar */}
        <div className="border-t border-slate-200 bg-slate-50/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
            <button
              onClick={() => setActiveTab('domains')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'domains'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Domains</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-slate-100 rounded-full font-mono">{domains.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('subdomains')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'subdomains'
                  ? 'bg-white text-emerald-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5 text-emerald-600" />
              <span>Subdomains</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded-full font-mono">
                {subdomainItems.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('addon')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'addon'
                  ? 'bg-white text-sky-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-sky-600" />
              <span>Addon Domains</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-sky-50 text-sky-700 rounded-full font-mono">
                {addonItems.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('aliases')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'aliases'
                  ? 'bg-white text-purple-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5 text-purple-600" />
              <span>Aliases</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-purple-50 text-purple-700 rounded-full font-mono">
                {aliasItems.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('redirects')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'redirects'
                  ? 'bg-white text-amber-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-amber-600" />
              <span>Redirects</span>
            </button>

            <button
              onClick={() => setActiveTab('zone_editor')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'zone_editor'
                  ? 'bg-white text-blue-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Code className="w-3.5 h-3.5 text-blue-600" />
              <span>Zone Editor (Bind9)</span>
            </button>

            <button
              onClick={() => setActiveTab('ddns')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'ddns'
                  ? 'bg-white text-rose-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-rose-600" />
              <span>Dynamic DNS</span>
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

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-4 py-3 flex items-start justify-between text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-600 hover:text-rose-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: DOMAINS (LIST & OVERVIEW) */}
        {/* ========================================================================= */}
        {activeTab === 'domains' && (
          <div className="space-y-4">
            {/* Header & Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
                <div className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Aliases</div>
                <div className="text-xl font-extrabold text-purple-700 mt-1">{stats.alias} Parked</div>
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
                    Subs
                  </button>
                  <button
                    onClick={() => setFilterType('addon')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${filterType === 'addon' ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-500 hover:text-sky-700'}`}
                  >
                    Addons
                  </button>
                  <button
                    onClick={() => setFilterType('alias')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${filterType === 'alias' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-500 hover:text-purple-700'}`}
                  >
                    Aliases
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('subdomains')}
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Subdomain</span>
                </button>
                <button
                  onClick={() => setActiveTab('addon')}
                  className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Addon</span>
                </button>
              </div>
            </div>

            {/* Domains Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Domain</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Document Root</th>
                      <th className="py-3 px-4">Redirects</th>
                      <th className="py-3 px-4">Force HTTPS</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                          Reading domains registry from server storage...
                        </td>
                      </tr>
                    ) : filteredDomains.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No domains match your search or filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredDomains.map(d => (
                        <tr key={d.domain} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <a
                                href={`http://${d.domain}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-bold text-slate-900 hover:text-indigo-600 flex items-center gap-1 group"
                              >
                                <span>{d.domain}</span>
                                <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-indigo-600" />
                              </a>
                              {d.isMain && (
                                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                  Main
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {d.isMain || d.type === 'primary' ? (
                              <span className="text-indigo-600 font-bold">Primary</span>
                            ) : d.type === 'addon' ? (
                              <span className="text-sky-600 font-bold">Addon Domain</span>
                            ) : d.type === 'alias' ? (
                              <span className="text-purple-600 font-bold">Alias (Parked)</span>
                            ) : (
                              <span className="text-emerald-600 font-bold">Subdomain</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px]">
                            <button
                              onClick={() => onOpenFileManager?.(activeMainDomain, d.documentRoot)}
                              className="text-slate-600 hover:text-indigo-600 flex items-center gap-1 group"
                              title="Open in File Manager"
                            >
                              <Folder className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
                              <span className="underline decoration-slate-300 underline-offset-2">
                                {formatDocRootDisplay(domainUsername, d.documentRoot)}
                              </span>
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            {d.redirectsTo ? (
                              <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                → {d.redirectsTo}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">None</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => handleToggleHttps(d.domain, d.forceHttps)}
                              className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                d.forceHttps ? 'bg-indigo-600' : 'bg-slate-300'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  d.forceHttps ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Diagnostic Ping Button */}
                              <button
                                onClick={() => handleRunDiagnostics(d.domain)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-indigo-50 text-indigo-600 hover:border-indigo-200 transition-colors"
                                title="Run Ping & DNS Diagnostic Test"
                              >
                                <Activity className="w-3.5 h-3.5" />
                              </button>

                              {/* Manage Button */}
                              <button
                                onClick={() => {
                                  setManagingDomain(d);
                                  setManageTab('general');
                                  setManageRedirectInput(d.redirectsTo || '');
                                }}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold transition-colors text-[11px] flex items-center gap-1"
                              >
                                <Wrench className="w-3.5 h-3.5 text-slate-500" />
                                <span>Manage</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SUBDOMAINS */}
        {/* ========================================================================= */}
        {activeTab === 'subdomains' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FolderTree className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create a Subdomain</h3>
                  <p className="text-xs text-slate-500">
                    Subdomains are isolated sections of your website with their own dedicated webroots located outside <code className="text-emerald-700 font-mono">public_html</code>.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateSubdomain} className="mt-5 space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Subdomain Prefix</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={subdomainPrefix}
                        onChange={e => setSubdomainPrefix(e.target.value)}
                        placeholder="e.g. blog, store, api"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Domain</label>
                    <select
                      value={subdomainParent}
                      onChange={e => setSubdomainParent(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer bg-white"
                    >
                      {allServices.map(s => (
                        <option key={s.id} value={s.domain}>
                          .{s.domain}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Document Root (Outside public_html)</label>
                    <span className="text-[10px] text-emerald-600 font-semibold">Strict Multi-Tenant Isolation</span>
                  </div>
                  <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
                    <span className="text-xs text-slate-400 font-mono">/home/{domainUsername}/</span>
                    <input
                      type="text"
                      required
                      value={subdomainCustomDoc}
                      onChange={e => setSubdomainCustomDoc(e.target.value)}
                      className="flex-1 bg-transparent text-xs font-mono font-bold text-slate-800 focus:outline-none pl-1"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="subHttps"
                    checked={subdomainHttps}
                    onChange={e => setSubdomainHttps(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="subHttps" className="text-xs text-slate-700 font-medium cursor-pointer">
                    Automatically generate SSL certificate & Force HTTPS
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isSubmitting ? 'Provisioning Subdomain...' : 'Create Subdomain'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Existing Subdomains List */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Active Subdomains ({subdomainItems.length})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Subdomain</th>
                      <th className="py-3 px-4">Document Root</th>
                      <th className="py-3 px-4">Redirection</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {subdomainItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          No subdomains created yet. Use the form above to add your first subdomain.
                        </td>
                      </tr>
                    ) : (
                      subdomainItems.map(d => (
                        <tr key={d.domain} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4">
                            <a
                              href={`http://${d.domain}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-bold text-slate-900 hover:text-emerald-600 flex items-center gap-1"
                            >
                              <span>{d.domain}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </a>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px]">
                            <button
                              onClick={() => onOpenFileManager?.(activeMainDomain, d.documentRoot)}
                              className="text-slate-600 hover:text-emerald-600 flex items-center gap-1"
                            >
                              <Folder className="w-3.5 h-3.5 text-amber-500" />
                              <span className="underline decoration-slate-300">
                                {formatDocRootDisplay(domainUsername, d.documentRoot)}
                              </span>
                            </button>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-500">
                            {d.redirectsTo || 'not redirected'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleRunDiagnostics(d.domain)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-emerald-50 text-emerald-600 transition-colors"
                                title="Run Diagnostic Ping"
                              >
                                <Activity className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setManagingDomain(d);
                                  setManageTab('delete');
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-rose-600 transition-colors"
                                title="Delete Subdomain"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ADDON DOMAINS */}
        {/* ========================================================================= */}
        {activeTab === 'addon' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create an Addon Domain</h3>
                  <p className="text-xs text-slate-500">
                    An addon domain is an entirely independent website with its own domain name, separate document root, and isolated PHP process pool.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateAddon} className="mt-5 space-y-4 max-w-2xl">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">New Domain Name</label>
                  <input
                    type="text"
                    required
                    value={addonDomainName}
                    onChange={e => setAddonDomainName(e.target.value)}
                    placeholder="e.g. clientproject.com, mynewapp.net"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Subdomain / FTP Username</label>
                    <input
                      type="text"
                      value={addonSubdomainUser}
                      onChange={e => setAddonSubdomainUser(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-sky-500 focus:outline-none bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Document Root</label>
                    <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
                      <span className="text-xs text-slate-400 font-mono">/home/{domainUsername}/</span>
                      <input
                        type="text"
                        required
                        value={addonCustomDoc}
                        onChange={e => setAddonCustomDoc(e.target.value)}
                        className="flex-1 bg-transparent text-xs font-mono font-bold text-slate-800 focus:outline-none pl-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="addonHttps"
                    checked={addonHttps}
                    onChange={e => setAddonHttps(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 border-slate-300 focus:ring-sky-500 cursor-pointer"
                  />
                  <label htmlFor="addonHttps" className="text-xs text-slate-700 font-medium cursor-pointer">
                    Automatically generate SSL certificate & Force HTTPS
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isSubmitting ? 'Provisioning Addon Domain...' : 'Create Addon Domain'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Existing Addon Domains List */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Active Addon Domains ({addonItems.length})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Domain</th>
                      <th className="py-3 px-4">Document Root</th>
                      <th className="py-3 px-4">Redirects</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {addonItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          No addon domains created yet. Add your first external domain above.
                        </td>
                      </tr>
                    ) : (
                      addonItems.map(d => (
                        <tr key={d.domain} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <a
                              href={`http://${d.domain}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-sky-600 flex items-center gap-1"
                            >
                              <span>{d.domain}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </a>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px]">
                            <button
                              onClick={() => onOpenFileManager?.(activeMainDomain, d.documentRoot)}
                              className="text-slate-600 hover:text-sky-600 flex items-center gap-1"
                            >
                              <Folder className="w-3.5 h-3.5 text-amber-500" />
                              <span className="underline decoration-slate-300">
                                {formatDocRootDisplay(domainUsername, d.documentRoot)}
                              </span>
                            </button>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-500">
                            {d.redirectsTo || 'none'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleRunDiagnostics(d.domain)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-sky-50 text-sky-600 transition-colors"
                                title="Run Diagnostic Ping"
                              >
                                <Activity className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setManagingDomain(d);
                                  setManageTab('delete');
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-rose-600 transition-colors"
                                title="Delete Addon Domain"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: ALIASES (PARKED DOMAINS) */}
        {/* ========================================================================= */}
        {activeTab === 'aliases' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create a New Alias (Parked Domain)</h3>
                  <p className="text-xs text-slate-500">
                    Domain aliases make your website available from another domain name (e.g. parking <code className="text-purple-700 font-mono">mycompany.net</code> on <code className="text-purple-700 font-mono">{activeMainDomain}</code>).
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateAlias} className="mt-5 space-y-4 max-w-2xl">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Domain Alias</label>
                  <input
                    type="text"
                    required
                    value={aliasDomainName}
                    onChange={e => setAliasDomainName(e.target.value)}
                    placeholder="e.g. companyalias.com, brand.org"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Webroot Domain</label>
                  <select
                    value={aliasTargetDomain}
                    onChange={e => setAliasTargetDomain(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-1 focus:ring-purple-500 focus:outline-none cursor-pointer bg-white"
                  >
                    {allServices.map(s => (
                      <option key={s.id} value={s.domain}>
                        {s.domain} (Points to /home/{s.domain.split('.')[0]}/public_html)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isSubmitting ? 'Creating Alias...' : 'Add Domain Alias'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Existing Aliases List */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Active Domain Aliases ({aliasItems.length})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Domain Alias</th>
                      <th className="py-3 px-4">Target Webroot</th>
                      <th className="py-3 px-4">Nginx Server Block</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {aliasItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          No domain aliases configured.
                        </td>
                      </tr>
                    ) : (
                      aliasItems.map(d => (
                        <tr key={d.domain} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-bold text-slate-900">{d.domain}</td>
                          <td className="py-3 px-4 font-mono text-[11px] text-purple-700">
                            Points to {d.parentDomain || activeMainDomain} (/public_html)
                          </td>
                          <td className="py-3 px-4 text-[11px] text-emerald-600 font-bold">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
                            Live Alias Active
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleRunDiagnostics(d.domain)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-purple-50 text-purple-600 transition-colors"
                                title="Run Diagnostic Ping"
                              >
                                <Activity className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setManagingDomain(d);
                                  setManageTab('delete');
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-rose-600 transition-colors"
                                title="Remove Alias"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: REDIRECTS (301 / 302 ENGINE) */}
        {/* ========================================================================= */}
        {activeTab === 'redirects' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add 301 / 302 Domain Redirect</h3>
                  <p className="text-xs text-slate-500">
                    Instantly rewrite incoming traffic and forward visitors from a specific path or entire domain to an external URL. Rules are dynamically compiled into Nginx.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateRedirect} className="mt-5 space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Type</label>
                    <select
                      value={redType}
                      onChange={e => setRedType(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer bg-white"
                    >
                      <option value="permanent">Permanent (301)</option>
                      <option value="temporary">Temporary (302)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Source Domain</label>
                    <select
                      value={redDomain}
                      onChange={e => setRedDomain(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer bg-white"
                    >
                      {domains.map(d => (
                        <option key={d.domain} value={d.domain}>
                          {d.domain}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Source Directory / Path (Optional)</label>
                  <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
                    <span className="text-xs text-slate-400 font-mono">https://{redDomain}/</span>
                    <input
                      type="text"
                      value={redDirectory}
                      onChange={e => setRedDirectory(e.target.value)}
                      placeholder="e.g. promo, old-shop, or leave blank for root"
                      className="flex-1 bg-transparent text-xs font-mono font-bold text-slate-800 focus:outline-none pl-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Redirects to (Destination URL)</label>
                  <input
                    type="url"
                    required
                    value={redTargetUrl}
                    onChange={e => setRedTargetUrl(e.target.value)}
                    placeholder="https://destination-website.com/new-page"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isSubmitting ? 'Saving Nginx Rule...' : 'Add Redirect Rule'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Existing Redirects List */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Active Redirect Rules ({redirects.length})
                </h4>
                <button
                  onClick={fetchRedirects}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600"
                  title="Refresh Redirects"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Domain / Path</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Destination Target</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {loadingRedirects ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-600" />
                          Loading active redirects from server...
                        </td>
                      </tr>
                    ) : redirects.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No redirect rules found.
                        </td>
                      </tr>
                    ) : (
                      redirects.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {r.domain}{r.directory !== '/' ? r.directory : ''}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.type === 'permanent'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {r.type === 'permanent' ? '301 Permanent' : '302 Temporary'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-indigo-600 underline">
                            <a href={r.redirectUrl} target="_blank" rel="noreferrer">
                              {r.redirectUrl}
                            </a>
                          </td>
                          <td className="py-3 px-4 text-emerald-600 font-bold text-[11px]">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
                            Live in Nginx
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDeleteRedirect(r.id)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-rose-600 transition-colors"
                              title="Delete Redirect"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: ADVANCED DNS ZONE EDITOR (BIND9) */}
        {/* ========================================================================= */}
        {activeTab === 'zone_editor' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Advanced DNS Zone Editor (Bind9)</h3>
                  <p className="text-xs text-slate-500">
                    Authoritative DNS Zone file management. Changes automatically increment serial (YYYYMMDDNN) and reload Bind9.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-500">Zone Domain:</span>
                  <select
                    value={zoneDomain}
                    onChange={e => {
                      setZoneDomain(e.target.value);
                      fetchDnsZone(e.target.value);
                    }}
                    className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {domains.map(d => (
                      <option key={d.domain} value={d.domain}>
                        {d.domain}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => {
                    setEditingRecordId(null);
                    setRecordFormName(`${zoneDomain}.`);
                    setRecordFormType('A');
                    setRecordFormTtl(14400);
                    setRecordFormRecord(zoneServerIp);
                    setShowAddRecord(true);
                  }}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Record</span>
                </button>
              </div>
            </div>

            {/* Add / Edit Record Form Modal */}
            {showAddRecord && (
              <div className="bg-slate-50 border border-blue-200 rounded-xl p-5 shadow-xs animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {editingRecordId ? 'Edit DNS Record' : 'Add New DNS Record'}
                  </h4>
                  <button onClick={() => setShowAddRecord(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveDnsRecord} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Name (FQDN or prefix)</label>
                    <input
                      type="text"
                      required
                      value={recordFormName}
                      onChange={e => setRecordFormName(e.target.value)}
                      placeholder="e.g. sub.yourdomain.com."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Type</label>
                    <select
                      value={recordFormType}
                      onChange={e => setRecordFormType(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white cursor-pointer"
                    >
                      <option value="A">A</option>
                      <option value="AAAA">AAAA</option>
                      <option value="CNAME">CNAME</option>
                      <option value="MX">MX</option>
                      <option value="TXT">TXT</option>
                      <option value="SRV">SRV</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">TTL (seconds)</label>
                    <input
                      type="number"
                      required
                      value={recordFormTtl}
                      onChange={e => setRecordFormTtl(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                    />
                  </div>

                  {recordFormType === 'MX' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Priority</label>
                      <input
                        type="number"
                        value={recordFormPriority}
                        onChange={e => setRecordFormPriority(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                      />
                    </div>
                  )}

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Record Value (IPv4, Hostname, or Text)
                    </label>
                    <input
                      type="text"
                      required
                      value={recordFormRecord}
                      onChange={e => setRecordFormRecord(e.target.value)}
                      placeholder={recordFormType === 'A' ? '208.72.218.129' : 'target host or string'}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div className="sm:col-span-1 flex items-end">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSubmitting ? 'Saving...' : 'Save Record'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Filter & Search DNS */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={zoneSearchQuery}
                    onChange={e => setZoneSearchQuery(e.target.value)}
                    placeholder="Search DNS records by name or value..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                </div>
              </div>

              {/* Type Pills */}
              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-[11px] font-bold">
                {['ALL', 'A', 'AAAA', 'CNAME', 'MX', 'TXT'].map(t => (
                  <button
                    key={t}
                    onClick={() => setZoneTypeFilter(t)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      zoneTypeFilter === t ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* DNS Records Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Name</th>
                      <th className="py-3 px-4">TTL</th>
                      <th className="py-3 px-4">Record / Value</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {loadingZone ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                          Reading Bind9 zone file (/etc/bind/zones/)...
                        </td>
                      </tr>
                    ) : filteredZoneRecords.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                          No DNS records match your filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredZoneRecords.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-4 font-bold text-blue-600">{r.type}</td>
                          <td className="py-2.5 px-4 text-slate-900 font-semibold">{r.name}</td>
                          <td className="py-2.5 px-4 text-slate-500">{r.ttl}</td>
                          <td className="py-2.5 px-4 text-slate-800 font-medium break-all">
                            {r.priority ? `[${r.priority}] ` : ''}{r.record}
                          </td>
                          <td className="py-2.5 px-4 text-right font-sans">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingRecordId(r.id);
                                  setRecordFormName(r.name);
                                  setRecordFormType(r.type);
                                  setRecordFormTtl(r.ttl);
                                  setRecordFormRecord(r.record);
                                  setRecordFormPriority(r.priority || 10);
                                  setShowAddRecord(true);
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-blue-600"
                                title="Edit Record"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDnsRecord(r.id)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: DYNAMIC DNS (DDNS ENGINE) */}
        {/* ========================================================================= */}
        {activeTab === 'ddns' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Dynamic DNS (DDNS) Engine</h3>
                  <p className="text-xs text-slate-500">
                    Assign a secure token to any subdomain on your account to dynamically update its IP address from home routers, VPNs, or home servers using standard <code className="text-rose-700 font-mono">curl</code>.
                  </p>
                </div>
              </div>

              <form onSubmit={handleGenerateDdnsToken} className="mt-5 space-y-4 max-w-2xl">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dynamic Subdomain</label>
                  <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
                    <input
                      type="text"
                      required
                      value={ddnsSubdomainPrefix}
                      onChange={e => setDdnsSubdomainPrefix(e.target.value)}
                      placeholder="e.g. home, vpn, router"
                      className="flex-1 bg-transparent text-xs font-mono font-bold text-slate-800 focus:outline-none"
                    />
                    <span className="text-xs text-slate-500 font-mono font-semibold">.{activeMainDomain}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    <span>{isSubmitting ? 'Generating Token...' : 'Create DDNS Key & Endpoint'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Newly Created DDNS Banner */}
            {newlyCreatedDdns && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-rose-600" />
                    DDNS Endpoint Created for {newlyCreatedDdns.fullDomain}
                  </span>
                  <button onClick={() => setNewlyCreatedDdns(null)} className="text-rose-400 hover:text-rose-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[11px] text-rose-800 font-mono bg-white p-3 rounded-lg border border-rose-200 space-y-1">
                  <div><strong>Token:</strong> {newlyCreatedDdns.token}</div>
                  <div>
                    <strong>One-Liner Update Command:</strong>
                    <div className="mt-1 flex items-center justify-between bg-slate-900 text-slate-100 p-2 rounded text-[10px]">
                      <span>curl "https://hoster1280.shop/api/ddns/update?domain={newlyCreatedDdns.fullDomain}&token={newlyCreatedDdns.token}"</span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `curl "https://hoster1280.shop/api/ddns/update?domain=${newlyCreatedDdns.fullDomain}&token=${newlyCreatedDdns.token}"`,
                            'new_cmd'
                          )
                        }
                        className="ml-2 p-1 text-slate-400 hover:text-white"
                      >
                        {copiedTokenId === 'new_cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Active DDNS Tokens List */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Active Dynamic DNS Tokens ({ddnsTokens.length})
                </h4>
                <button onClick={fetchDdnsTokens} className="p-1 text-slate-400 hover:text-slate-600">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Domain</th>
                      <th className="py-3 px-4">Current IP</th>
                      <th className="py-3 px-4">Last Updated</th>
                      <th className="py-3 px-4">Update Command</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {loadingDdns ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-rose-600" />
                          Loading DDNS tokens...
                        </td>
                      </tr>
                    ) : ddnsTokens.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                          No Dynamic DNS tokens generated. Use the form above to create one.
                        </td>
                      </tr>
                    ) : (
                      ddnsTokens.map(t => {
                        const updateCmd = `curl "https://hoster1280.shop/api/ddns/update?domain=${t.fullDomain}&token=${t.token}"`;
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-4 font-bold text-slate-900">{t.fullDomain}</td>
                            <td className="py-3 px-4 text-emerald-600 font-bold">{t.currentIp || '208.72.218.129'}</td>
                            <td className="py-3 px-4 text-slate-500 text-[10px] font-sans">
                              {new Date(t.lastUpdated).toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded max-w-xs text-[10px] truncate">
                                <span className="truncate">{updateCmd}</span>
                                <button
                                  onClick={() => copyToClipboard(updateCmd, t.id)}
                                  className="p-1 hover:text-slate-900 text-slate-500 shrink-0"
                                  title="Copy curl command"
                                >
                                  {copiedTokenId === t.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-sans">
                              <button
                                onClick={() => handleDeleteDdnsToken(t.id)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-rose-600 transition-colors"
                                title="Revoke DDNS Token"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL 1: REAL-TIME DIAGNOSTIC PING & DNS PROBE */}
      {/* ========================================================================= */}
      {diagnosticDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
                <div>
                  <h3 className="font-bold text-sm">Server & DNS Diagnostics</h3>
                  <p className="text-[10px] text-slate-400 font-mono">Live probe for {diagnosticDomain}</p>
                </div>
              </div>
              <button
                onClick={() => setDiagnosticDomain(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              {diagnosticLoading ? (
                <div className="py-12 text-center text-slate-500 space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
                  <p className="text-xs font-semibold">Probing DNS propagation, ping latency & Nginx status...</p>
                </div>
              ) : diagnosticError ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Diagnostic Probe Failed</span>
                  </div>
                  <p>{diagnosticError}</p>
                </div>
              ) : diagnosticResult ? (
                <div className="space-y-3 text-xs">
                  {/* DNS Status Item */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">DNS Resolution</span>
                      <div className="font-mono font-bold text-slate-900">
                        {diagnosticResult.resolved ? diagnosticResult.ip : 'NXDOMAIN / Unresolved'}
                      </div>
                    </div>
                    <div>
                      {diagnosticResult.resolved ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Resolved ({diagnosticResult.dnsLookupTimeMs}ms)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[11px] font-bold">
                          <XCircle className="w-3.5 h-3.5" />
                          Unresolved
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ping Latency Item */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Ping Latency</span>
                      <div className="font-mono font-bold text-slate-900">
                        {diagnosticResult.pingLatencyMs !== null ? `${diagnosticResult.pingLatencyMs} ms` : 'N/A'}
                      </div>
                    </div>
                    <div>
                      {diagnosticResult.pingSuccess ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Ping OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          ICMP Filtered
                        </span>
                      )}
                    </div>
                  </div>

                  {/* HTTP Status Item */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">HTTP Web Response</span>
                      <div className="font-mono font-bold text-slate-900">
                        {diagnosticResult.httpStatusCode ? `HTTP ${diagnosticResult.httpStatusCode}` : 'No HTTP response'}
                      </div>
                    </div>
                    <div>
                      {diagnosticResult.httpOk ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Web Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-bold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Status {diagnosticResult.httpStatusCode || 'Error'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Nginx Config Validation */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Nginx Configuration</span>
                      <div className="font-mono font-bold text-slate-900">
                        /etc/nginx/sites-available/{diagnosticDomain}.conf
                      </div>
                    </div>
                    <div>
                      {diagnosticResult.nginxConfigValid ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          nginx -t Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[11px] font-bold">
                          <XCircle className="w-3.5 h-3.5" />
                          Config Error
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Document Root Check */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Webroot Filesystem</span>
                      <div className="font-mono text-[11px] text-slate-700 truncate max-w-xs">
                        {diagnosticResult.documentRootPath}
                      </div>
                    </div>
                    <div>
                      {diagnosticResult.documentRootExists ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Directory OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[11px] font-bold">
                          <XCircle className="w-3.5 h-3.5" />
                          Missing
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono">
                {diagnosticResult?.checkedAt ? `Checked: ${new Date(diagnosticResult.checkedAt).toLocaleTimeString()}` : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => diagnosticDomain && handleRunDiagnostics(diagnosticDomain)}
                  disabled={diagnosticLoading}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${diagnosticLoading ? 'animate-spin' : ''}`} />
                  <span>Re-test Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDiagnosticDomain(null)}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EXISTING MANAGE DOMAIN MODAL */}
      {/* ========================================================================= */}
      {managingDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Manage Domain: {managingDomain.domain}</h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  {managingDomain.isMain ? 'Primary Account Domain' : `${managingDomain.type} Domain`}
                </p>
              </div>
              <button onClick={() => setManagingDomain(null)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Manage Tabs */}
            <div className="border-b border-slate-200 bg-slate-50 px-6 flex gap-2">
              {(['general', 'dns', 'vhost', 'ssl', 'delete'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setManageTab(tab)}
                  className={`py-2.5 px-3 text-xs font-bold capitalize border-b-2 transition-colors ${
                    manageTab === tab
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab === 'vhost' ? 'VirtualHosts' : tab === 'ssl' ? 'SSL/HTTPS' : tab}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              {manageTab === 'general' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Document Root</span>
                      <span className="font-mono text-slate-800 font-semibold">{managingDomain.documentRoot}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Hosting Type</span>
                      <span className="capitalize font-semibold text-slate-800">{managingDomain.type}</span>
                    </div>
                  </div>

                  <form onSubmit={handleSaveManageRedirect} className="space-y-2">
                    <label className="block font-bold text-slate-700">Domain Redirection (Target URL)</label>
                    <input
                      type="text"
                      value={manageRedirectInput}
                      onChange={e => setManageRedirectInput(e.target.value)}
                      placeholder="e.g. https://targetdomain.com or leave blank to disable"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={isSavingManage}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold"
                      >
                        {isSavingManage ? 'Saving...' : 'Save Redirection'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {manageTab === 'dns' && (
                <div className="space-y-3">
                  <span className="font-bold text-slate-800 block">DNS Records for {managingDomain.domain}</span>
                  {loadingDnsModal ? (
                    <div className="py-6 text-center text-slate-400">Loading DNS records...</div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-[11px] font-mono">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-bold">
                          <tr>
                            <th className="py-2 px-3">Type</th>
                            <th className="py-2 px-3">Name</th>
                            <th className="py-2 px-3">Record</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dnsModalRecords.map(r => (
                            <tr key={r.id}>
                              <td className="py-1.5 px-3 font-bold text-indigo-600">{r.type}</td>
                              <td className="py-1.5 px-3 text-slate-800">{r.name}</td>
                              <td className="py-1.5 px-3 text-slate-600 truncate max-w-xs">{r.value || r.record}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {manageTab === 'vhost' && (
                <div className="space-y-3">
                  <span className="font-bold text-slate-800 block">Compiled Nginx Server Block</span>
                  {loadingVhost ? (
                    <div className="py-6 text-center text-slate-400">Loading Nginx vhost config...</div>
                  ) : (
                    <pre className="p-3 bg-slate-900 text-slate-100 font-mono text-[10px] rounded-xl overflow-x-auto max-h-56">
                      {vhostConfigs?.nginx || 'No Nginx config found.'}
                    </pre>
                  )}
                </div>
              )}

              {manageTab === 'ssl' && (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                    <div className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>SSL Active & Protected</span>
                    </div>
                    <p className="text-[11px] mt-1 text-emerald-700">
                      AutoSSL certificate generated on host server storage under /ssl/certs/{managingDomain.domain}.crt.
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-700">Force HTTPS Redirection</span>
                    <button
                      type="button"
                      onClick={() => handleToggleHttps(managingDomain.domain, managingDomain.forceHttps)}
                      className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        managingDomain.forceHttps ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          managingDomain.forceHttps ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {manageTab === 'delete' && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-3">
                  <div className="font-bold text-sm flex items-center gap-2 text-rose-700">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Permanent Domain Removal</span>
                  </div>
                  <p className="text-xs text-rose-700 leading-relaxed">
                    Are you sure you want to permanently remove <strong>{managingDomain.domain}</strong>? This will revoke Nginx vhosts, DNS records, and Bind9 zones.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="modalPurgeCheck"
                      checked={purgeDocRootFiles}
                      onChange={e => setPurgeDocRootFiles(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 border-rose-300 cursor-pointer"
                    />
                    <label htmlFor="modalPurgeCheck" className="text-xs text-rose-800 font-medium cursor-pointer">
                      Also purge files in <code className="font-mono font-bold">{managingDomain.documentRoot}</code>
                    </label>
                  </div>
                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setManagingDomain(null)}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingDomain}
                      onClick={handleExecuteDeleteDomain}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isDeletingDomain ? 'Deleting...' : 'Confirm Delete'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
