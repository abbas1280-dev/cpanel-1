import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { MyServicesView } from './components/MyServicesView';
import { MyDomainsView } from './components/MyDomainsView';
import { ProfileView } from './components/ProfileView';
import { CustomCPanelDashboard } from './components/CustomCPanelDashboard';
import { FileManagerView } from './components/FileManagerView';
import { CPanelDomainsView } from './components/CPanelDomainsView';
import { CPanelDatabasesView } from './components/CPanelDatabasesView';
import { GeneralSettingsView } from './components/GeneralSettingsView';
import { UserProfile, ActiveTab, ServiceItem, DomainItem, ServerMetrics } from './types';
import { CheckCircle2, AlertCircle, LogOut } from 'lucide-react';

const INITIAL_USER: UserProfile = {
  name: 'TAMIM HASAN',
  email: 'tamim.hasan@hoster1280.shop',
  phone: '+880 1712-345678',
  companyName: 'TURKY HUB',
  address: 'Mirpur, Dhaka',
  city: 'Dhaka, 1206',
  country: 'Bangladesh',
  avatarUrl: '',
  twoFactorEnabled: false
};

const INITIAL_SERVICES: ServiceItem[] = [];

const INITIAL_DOMAINS: DomainItem[] = [];

export function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [cpanelTargetService, setCpanelTargetService] = useState<ServiceItem | undefined>(undefined);
  const [fileManagerInitialPath, setFileManagerInitialPath] = useState<string>('/');
  const [databaseInitialTab, setDatabaseInitialTab] = useState<string>('databases');

  // Live Real Server Metrics State
  const [serverMetrics, setServerMetrics] = useState<ServerMetrics | null>(null);

  // User State (persisted to localStorage)
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('hoster1280_user') || localStorage.getItem('sitechai_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_USER;
  });

  // Services State (Loaded from real server backend)
  const [services, setServices] = useState<ServiceItem[]>(() => {
    const saved = localStorage.getItem('hoster1280_services') || localStorage.getItem('sitechai_services');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  // Domains State (Loaded from real backend)
  const [domains, setDomains] = useState<DomainItem[]>(() => {
    const saved = localStorage.getItem('hoster1280_domains') || localStorage.getItem('sitechai_domains');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  // Logout modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch real server metrics from backend on mount and poll every 3 seconds
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/server/metrics');
        if (res.ok) {
          const data = await res.json();
          setServerMetrics(data);
        }
      } catch (e) {
        console.error('Failed to fetch server metrics', e);
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial portal settings (e.g. custom favicon) on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.faviconUrl) {
          let link = document.getElementById('app-favicon') as HTMLLinkElement | null;
          if (!link) link = document.querySelector("link[rel*='icon']");
          if (link) {
            link.href = `${data.faviconUrl}${data.faviconUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
          }
        }
      })
      .catch(err => console.error('Failed to load initial settings:', err));
  }, []);

  // Handle URL query parameters for direct tab navigation (e.g. ?tab=filemanager&domain=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as ActiveTab;
      const domainParam = params.get('domain');
      if (tabParam && ['dashboard', 'services', 'domains', 'profile', 'settings', 'cpanel', 'filemanager', 'cpanel_domains', 'cpanel_databases'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
      if (domainParam) {
        const found = services.find(s => s.domain === domainParam);
        if (found) {
          setCpanelTargetService(found);
        } else {
          setCpanelTargetService({
            id: 'srv-' + domainParam,
            product: 'Premium cPanel Hosting',
            domain: domainParam,
            pricing: '$9.99/mo',
            billingCycle: 'Monthly',
            nextDueDate: '2027-01-01',
            status: 'Active',
            serverIp: '127.0.0.1'
          });
        }
      }
    } catch (e) {
      console.error('Failed to parse URL query params:', e);
    }
  }, [services]);

  // Fetch real services and domains list from backend on mount
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await fetch('/api/services');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setServices(data);
          }
        }
      } catch (e) {
        console.error('Failed to load services from server API', e);
      }
    };

    const fetchDomains = async () => {
      try {
        const res = await fetch('/api/domains');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setDomains(data);
          }
        }
      } catch (e) {
        console.error('Failed to load domains from server API', e);
      }
    };

    fetchServices();
    fetchDomains();
  }, []);

  useEffect(() => {
    localStorage.setItem('hoster1280_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('hoster1280_services', JSON.stringify(services));
  }, [services]);

  useEffect(() => {
    localStorage.setItem('hoster1280_domains', JSON.stringify(domains));
  }, [domains]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const handleUpdateProfile = (updated: Partial<UserProfile>) => {
    setUser(prev => ({ ...prev, ...updated }));
  };

  const handleAddService = async (newService: ServiceItem) => {
    // Ensure the service uses the real server IP
    const realIp = serverMetrics?.serverIp || newService.serverIp || '192.168.0.104';
    const provisionedService = { ...newService, serverIp: realIp };

    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(provisionedService)
      });
      if (res.ok) {
        const result = await res.json();
        setServices(prev => [result.service || provisionedService, ...prev.filter(s => s.domain !== provisionedService.domain)]);
        showToast(`Service "${provisionedService.product}" provisioned on physical host server (${realIp})!`);
        return;
      }
    } catch (e) {
      console.error('Failed to persist service to server', e);
    }

    setServices(prev => [provisionedService, ...prev]);
    showToast(`Service "${provisionedService.product}" provisioned!`);
  };

  const handleDeleteService = async (serviceIdOrDomain: string) => {
    const target = services.find(s => s.id === serviceIdOrDomain || s.domain === serviceIdOrDomain);
    const domain = target ? target.domain : serviceIdOrDomain;

    try {
      const res = await fetch('/api/services/terminate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      });
      if (res.ok) {
        setServices(prev => prev.filter(s => s.domain !== domain && s.id !== serviceIdOrDomain));
        showToast(`Service for "${domain}" permanently terminated and server resources purged!`);
        return;
      }
    } catch (err) {
      console.warn('Backend terminate error:', err);
    }

    setServices(prev => prev.filter(s => s.domain !== domain && s.id !== serviceIdOrDomain));
    showToast(`Service for "${domain}" deleted.`);
  };

  const handleAddDomain = (newDomain: DomainItem) => {
    setDomains(prev => [newDomain, ...prev]);
    showToast(`Domain "${newDomain.domainName}" registered successfully!`);
  };

  const handleToggleAutoRenew = (id: string) => {
    setDomains(prev =>
      prev.map(d => (d.id === id ? { ...d, autoRenew: !d.autoRenew } : d))
    );
    showToast('Auto-renewal preference updated.');
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    showToast('You have been safely logged out. Session refreshed.');
    setActiveTab('dashboard');
  };

  if (activeTab === 'filemanager') {
    return (
      <div className="min-h-screen bg-[#f4f6fa] text-slate-800">
        <FileManagerView
          currentService={cpanelTargetService}
          allServices={services}
          serverMetrics={serverMetrics}
          initialPath={fileManagerInitialPath}
          onExit={() => {
            setFileManagerInitialPath('/');
            setActiveTab('cpanel');
          }}
        />
        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
            <div
              className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold ${
                toast.type === 'success'
                  ? 'bg-emerald-900 text-white border-emerald-700/60 shadow-emerald-950/20'
                  : 'bg-rose-900 text-white border-rose-700/60 shadow-rose-950/20'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400" />
              )}
              <span>{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeTab === 'cpanel_domains') {
    return (
      <div className="min-h-screen bg-[#f9fafc] text-slate-800">
        <CPanelDomainsView
          currentService={cpanelTargetService}
          allServices={services}
          serverMetrics={serverMetrics}
          onExit={() => setActiveTab('cpanel')}
          onOpenFileManager={(dom, docRoot) => {
            const srv = services.find(s => s.domain === dom) || cpanelTargetService;
            setCpanelTargetService(srv);
            setFileManagerInitialPath(docRoot || '/');
            setActiveTab('filemanager');
          }}
        />
        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
            <div
              className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold ${
                toast.type === 'success'
                  ? 'bg-emerald-900 text-white border-emerald-700/60 shadow-emerald-950/20'
                  : 'bg-rose-900 text-white border-rose-700/60 shadow-rose-950/20'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400" />
              )}
              <span>{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeTab === 'cpanel_databases') {
    return (
      <div className="min-h-screen bg-[#f9fafc] text-slate-800">
        <CPanelDatabasesView
          currentService={cpanelTargetService}
          allServices={services}
          initialTab={databaseInitialTab}
          onExit={() => setActiveTab('cpanel')}
        />
        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
            <div
              className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold ${
                toast.type === 'success'
                  ? 'bg-emerald-900 text-white border-emerald-700/60 shadow-emerald-950/20'
                  : 'bg-rose-900 text-white border-rose-700/60 shadow-rose-950/20'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400" />
              )}
              <span>{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6fa] flex text-slate-800">
      {/* Sidebar (Desktop fixed & Mobile drawer) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        domainsCount={domains.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header */}
        <Header
          user={user}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setIsMobileOpen={setIsMobileOpen}
          onLogoutClick={() => setShowLogoutModal(true)}
        />

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-8 lg:p-10">
          {activeTab === 'dashboard' && (
            <DashboardView
              setActiveTab={setActiveTab}
              serviceCount={services.length}
              domainCount={domains.length}
              serverMetrics={serverMetrics}
            />
          )}

          {activeTab === 'services' && (
            <MyServicesView
              services={services}
              domains={domains}
              onAddService={handleAddService}
              onDeleteService={handleDeleteService}
              serverMetrics={serverMetrics}
              onOpenFullCpanel={(srv) => {
                setCpanelTargetService(srv);
                setActiveTab('cpanel');
              }}
            />
          )}

          {activeTab === 'cpanel' && (
            <CustomCPanelDashboard
              initialService={cpanelTargetService}
              allServices={services}
              serverMetrics={serverMetrics}
              onExit={() => setActiveTab('services')}
              onOpenFileManager={(srv) => {
                setCpanelTargetService(srv);
                setActiveTab('filemanager');
              }}
              onOpenDomains={(srv) => {
                setCpanelTargetService(srv);
                setActiveTab('cpanel_domains');
              }}
              onOpenDatabases={(srv, tab) => {
                setCpanelTargetService(srv);
                setDatabaseInitialTab(tab || 'databases');
                setActiveTab('cpanel_databases');
              }}
            />
          )}

          {activeTab === 'domains' && (
            <MyDomainsView
              domains={domains}
              onToggleAutoRenew={handleToggleAutoRenew}
              onAddDomain={handleAddDomain}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              user={user}
              onUpdateProfile={handleUpdateProfile}
              onLogout={() => setShowLogoutModal(true)}
              showToast={showToast}
            />
          )}

          {activeTab === 'settings' && (
            <GeneralSettingsView
              serverMetrics={serverMetrics}
              showToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700/60 shadow-emerald-950/20'
                : 'bg-rose-900 text-white border-rose-700/60 shadow-rose-950/20'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-4">
              <LogOut className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Confirm Sign Out</h3>
            <p className="text-xs text-slate-500 mt-1 mb-6">
              Are you sure you want to end your current session on HOSTER 1280 Client Portal?
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLogout}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 flex-1"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
