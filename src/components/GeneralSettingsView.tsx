import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, 
  Upload, 
  CheckCircle2, 
  Server, 
  RefreshCw, 
  AlertCircle, 
  Image as ImageIcon,
  ShieldCheck,
  Check,
  Terminal
} from 'lucide-react';
import { ServerMetrics } from '../types';

interface GeneralSettingsViewProps {
  serverMetrics: ServerMetrics | null;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export const GeneralSettingsView: React.FC<GeneralSettingsViewProps> = ({
  serverMetrics,
  showToast,
}) => {
  // Favicon State
  const [currentFavicon, setCurrentFavicon] = useState<string>('/favicon.ico');
  const [previewFavicon, setPreviewFavicon] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Nameservers State
  const [ns1, setNs1] = useState('ns1.hoster1280.shop');
  const [ns2, setNs2] = useState('ns2.hoster1280.shop');
  const [serverIp, setServerIp] = useState('208.72.218.129');
  const [isApplyingNs, setIsApplyingNs] = useState(false);
  const [nsResult, setNsResult] = useState<{
    success: boolean;
    message: string;
    output?: string;
  } | null>(null);

  // Fetch initial settings from backend
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.ns1) setNs1(data.ns1);
          if (data.ns2) setNs2(data.ns2);
          if (data.serverIp) setServerIp(data.serverIp);
          if (data.faviconUrl) {
            setCurrentFavicon(data.faviconUrl);
            updateFaviconTag(data.faviconUrl);
          }
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    };
    fetchSettings();
  }, []);

  // Update server IP when metrics load if not already customized
  useEffect(() => {
    const ip = serverMetrics?.publicIp || serverMetrics?.serverIp;
    if (ip && ip !== '127.0.0.1') {
      setServerIp(ip);
    }
  }, [serverMetrics]);

  const updateFaviconTag = (url: string) => {
    let link = document.getElementById('app-favicon') as HTMLLinkElement | null;
    if (!link) {
      link = document.querySelector("link[rel*='icon']");
    }
    if (link) {
      link.href = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    }
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('image') && !file.name.endsWith('.ico')) {
      showToast('Please select a valid image file (.ico, .png, .svg)', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Image size should be less than 2MB', 'error');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewFavicon(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle Favicon upload
  const handleUploadFavicon = async () => {
    if (!previewFavicon) {
      showToast('Please select a favicon image first', 'error');
      return;
    }

    setIsUploadingFavicon(true);
    try {
      const res = await fetch('/api/settings/upload-favicon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl: previewFavicon,
          fileName: selectedFile?.name || 'favicon.ico'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const newUrl = data.faviconUrl || '/favicon.ico';
        setCurrentFavicon(newUrl);
        updateFaviconTag(newUrl);
        setPreviewFavicon(null);
        setSelectedFile(null);
        showToast('Favicon updated and applied successfully!', 'success');
      } else {
        showToast(data.message || 'Failed to update favicon', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Network error while uploading favicon', 'error');
    } finally {
      setIsUploadingFavicon(false);
    }
  };

  // Handle Nameserver apply
  const handleApplyNameservers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ns1.trim() || !ns2.trim() || !serverIp.trim()) {
      showToast('Please provide NS1, NS2, and the server IP', 'error');
      return;
    }

    setIsApplyingNs(true);
    setNsResult(null);

    try {
      const res = await fetch('/api/settings/nameservers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ns1: ns1.trim(), ns2: ns2.trim(), serverIp: serverIp.trim() })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNsResult({
          success: true,
          message: data.message || 'Nameservers successfully installed and Bind9 reloaded!',
          output: data.output
        });
        showToast('Nameservers applied successfully to VPS DNS pool!', 'success');
      } else {
        setNsResult({
          success: false,
          message: data.message || 'Failed to apply nameservers on VPS',
          output: data.output
        });
        showToast(data.message || 'Error applying nameservers', 'error');
      }
    } catch (err: any) {
      setNsResult({
        success: false,
        message: 'Network connection failed while applying nameservers',
        output: err?.message
      });
      showToast('Network error while updating nameservers', 'error');
    } finally {
      setIsApplyingNs(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Globe className="w-7 h-7 text-indigo-600" />
            General Settings & Automation
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure system branding, browser favicon, and 1-Click automated Bind9 DNS nameserver records for <span className="font-semibold text-slate-700">HOSTER 1280</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            System Engine Ready
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Section 1: Favicon & Branding Manager (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 overflow-hidden relative">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Favicon & Portal Branding</h3>
                <p className="text-xs text-slate-500">Update the browser tab icon for all portal users</p>
              </div>
            </div>

            {/* Favicon Previews */}
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-150">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center p-2">
                    <img 
                      src={previewFavicon || currentFavicon} 
                      alt="Favicon Preview" 
                      className="w-8 h-8 object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }} 
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700">
                      {previewFavicon ? 'New Selection Preview' : 'Active Favicon'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {selectedFile ? selectedFile.name : 'Current browser tab icon'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors border border-indigo-200/60"
                >
                  Change Icon
                </button>
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".ico,.png,.svg,.jpg,.webp"
                className="hidden"
              />

              {/* Browser Preview Mockup */}
              <div className="rounded-2xl border border-slate-200 bg-slate-100/70 p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Browser Tab Live Simulation
                </div>
                <div className="bg-white rounded-xl p-2.5 shadow-sm border border-slate-200/60 flex items-center gap-2 max-w-xs">
                  <img 
                    src={previewFavicon || currentFavicon} 
                    alt="Tab Icon" 
                    className="w-4 h-4 object-contain"
                  />
                  <span className="text-xs font-medium text-slate-700 truncate">
                    HOSTER 1280 - Client Area & Portal
                  </span>
                </div>
              </div>

              {previewFavicon && (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isUploadingFavicon}
                    onClick={handleUploadFavicon}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
                  >
                    {isUploadingFavicon ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Saving Favicon...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload & Apply Favicon
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewFavicon(null);
                      setSelectedFile(null);
                    }}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="mt-5 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-[12px] text-indigo-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                Recommended format: <strong>.ico</strong>, <strong>.png</strong> or <strong>.svg</strong> (32x32 or 64x64 square pixels). Changes will update the browser tab dynamically.
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: 1-Click Nameservers (NS1 / NS2) Automation (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">1-Click Nameservers Automation</h3>
                  <p className="text-xs text-slate-500">Configure master DNS Bind9 zone records for your VPS</p>
                </div>
              </div>
              <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-purple-100 text-purple-800">
                Bind9 Port 53
              </span>
            </div>

            <form onSubmit={handleApplyNameservers} className="mt-5 space-y-4">
              {/* NS1 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Primary Nameserver (NS1)</span>
                  <span className="text-[11px] text-slate-400 font-normal">e.g. ns1.hoster1280.shop</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={ns1}
                    onChange={(e) => setNs1(e.target.value)}
                    placeholder="ns1.hoster1280.shop"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* NS2 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Secondary Nameserver (NS2)</span>
                  <span className="text-[11px] text-slate-400 font-normal">e.g. ns2.hoster1280.shop</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={ns2}
                    onChange={(e) => setNs2(e.target.value)}
                    placeholder="ns2.hoster1280.shop"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Server IP */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Server IPv4 Address</span>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Auto-detected
                  </span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Server className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={serverIp}
                    onChange={(e) => setServerIp(e.target.value)}
                    placeholder="208.72.218.129"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isApplyingNs}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#11074a] to-[#25106e] hover:from-[#190a61] hover:to-[#2e1485] text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-950/20 transition-all disabled:opacity-50"
                >
                  {isApplyingNs ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      Applying Bind9 Zone Records & Reloading DNS...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Install & Apply Nameservers to VPS
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Results Feedback Box */}
            {nsResult && (
              <div className={`mt-5 p-4 rounded-2xl border text-xs ${
                nsResult.success 
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50/80 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-start gap-2.5">
                  {nsResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-bold">{nsResult.message}</div>
                    {nsResult.output && (
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto whitespace-pre">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] mb-1">
                          <Terminal className="w-3 h-3" /> Console Execution Log:
                        </div>
                        {nsResult.output}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Explanatory Info Card */}
            <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs text-slate-600">
              <div className="font-bold text-slate-700 flex items-center gap-2">
                <span>DNS Automation Process</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-slate-500 list-disc list-inside">
                <li>Automated Bind9 named configuration rewrite on the server</li>
                <li>Updates NS and A records targeting IP <strong>{serverIp}</strong></li>
                <li>Executes <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">rndc reload</code> / <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">systemctl reload bind9</code></li>
                <li>Registers custom GLUE records in the host pool for all connected domains</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
