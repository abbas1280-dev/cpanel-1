import React, { useState } from 'react';
import { Globe, Plus, ShieldCheck, CheckCircle2, Search, Settings, AlertTriangle, ExternalLink } from 'lucide-react';
import { DomainItem } from '../types';

interface MyDomainsViewProps {
  domains: DomainItem[];
  onToggleAutoRenew: (id: string) => void;
  onAddDomain: (domain: DomainItem) => void;
}

export const MyDomainsView: React.FC<MyDomainsViewProps> = ({
  domains,
  onToggleAutoRenew,
  onAddDomain
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');

  const filteredDomains = domains.filter(d =>
    d.domainName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainName.trim()) return;

    const newDomain: DomainItem = {
      id: 'dom-' + Date.now().toString().slice(-4),
      domainName: newDomainName.trim().toLowerCase(),
      registrationDate: '18/09/2026',
      nextDueDate: '18/09/2027',
      autoRenew: true,
      status: 'Active'
    };

    onAddDomain(newDomain);
    setNewDomainName('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">My Domains</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage DNS records, renewals, and WHOIS privacy settings.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 active:scale-95"
        >
          <Plus className="w-4 h-4" /> Register New Domain
        </button>
      </div>

      {/* Search and stats bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search domain name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-slate-500 w-full sm:w-auto justify-end">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            Active: {domains.filter(d => d.status === 'Active').length}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
            Expiring: {domains.filter(d => d.status === 'Expiring Soon').length}
          </span>
        </div>
      </div>

      {/* Domains Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3.5 px-6">Domain</th>
                <th className="py-3.5 px-6">Registration Date</th>
                <th className="py-3.5 px-6">Next Due Date</th>
                <th className="py-3.5 px-6">Auto Renewal</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDomains.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                    <Globe className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No domains found</p>
                    <p className="text-xs text-slate-400 mt-0.5">There are no registered domains associated with your account.</p>
                  </td>
                </tr>
              ) :
                filteredDomains.map((dom) => (
                <tr key={dom.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="py-4 px-6 font-semibold text-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Globe className="w-4 h-4" />
                    </div>
                    <span>{dom.domainName}</span>
                  </td>
                  <td className="py-4 px-6 text-slate-500 text-xs font-medium">
                    {dom.registrationDate}
                  </td>
                  <td className="py-4 px-6 text-slate-700 text-xs font-medium">
                    {dom.nextDueDate}
                  </td>
                  <td className="py-4 px-6">
                    <button
                      onClick={() => onToggleAutoRenew(dom.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                        dom.autoRenew
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${dom.autoRenew ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                      {dom.autoRenew ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      dom.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                    }`}>
                      {dom.status === 'Active' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {dom.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => alert(`Opening DNS Zone Editor for ${dom.domainName}`)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Settings className="w-3.5 h-3.5" /> DNS
                      </button>
                      <a
                        href={`https://${dom.domainName}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
                        title="Visit site"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Domain Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Register or Transfer Domain</h3>
            <p className="text-xs text-slate-500 mb-4">Add a new domain name to your Sitechai client portfolio.</p>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Domain Name</label>
                <input
                  type="text"
                  required
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  placeholder="e.g. startupbrand.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-700">
                <span className="font-bold">Included for free:</span> WHOIS Privacy Protection, DNS Record Editor, Email forwarding.
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
                >
                  Complete Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
