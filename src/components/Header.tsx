import React, { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, User, Shield, LogOut, CheckCircle2 } from 'lucide-react';
import { UserProfile, ActiveTab } from '../types';

interface HeaderProps {
  user: UserProfile;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  setIsMobileOpen: (open: boolean) => void;
  onLogoutClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  setActiveTab,
  setIsMobileOpen,
  onLogoutClick
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getBreadcrumbs = () => {
    switch (activeTab) {
      case 'services':
        return { page: 'My Services', trail: 'Portal Home / Services' };
      case 'domains':
        return { page: 'My Domains', trail: 'Portal Home / Domains' };
      case 'profile':
        return { page: 'User Profile & Security', trail: 'Portal Home / Account Settings' };
      case 'cpanel':
        return { page: 'cPanel Control Panel', trail: 'Portal Home / Custom cPanel Dashboard' };
      case 'dashboard':
      default:
        return { page: 'My Dashboard', trail: 'Portal Home / Client Area' };
    }
  };

  const breadcrumb = getBreadcrumbs();

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200/80 shadow-sm flex items-center justify-between px-4 sm:px-8">
      {/* Left side: Hamburger & Page context */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 lg:hidden focus:outline-none"
          aria-label="Open sidebar"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight leading-none">
            {breadcrumb.page}
          </h1>
          <p className="text-xs text-slate-400 mt-1 hidden sm:block font-medium">
            {breadcrumb.trail}
          </p>
        </div>
      </div>

      {/* Right side: strictly Profile Icon only (Cart & Notifications excluded per requirement) */}
      <div className="flex items-center gap-3">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-full sm:rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            aria-haspopup="true"
            aria-expanded={isDropdownOpen}
            title="Profile Menu"
          >
            {/* Profile Avatar */}
            <div className="relative">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover ring-2 ring-indigo-600/20"
                />
              ) : (
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-indigo-600/20">
                  {user.name ? user.name.slice(0, 2).toUpperCase() : 'TH'}
                </div>
              )}
              {user.twoFactorEnabled && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center" title="2FA Enabled">
                  <CheckCircle2 className="w-2.5 h-2.5 text-white stroke-[3]" />
                </span>
              )}
            </div>

            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Profile Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                    Client Account
                  </span>
                  {user.twoFactorEnabled && (
                    <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      2FA Active
                    </span>
                  )}
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setActiveTab('profile');
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 font-medium transition-colors"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  Account Settings & Security
                </button>
                <button
                  onClick={() => {
                    setActiveTab('profile');
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 font-medium transition-colors"
                >
                  <Shield className="w-4 h-4 text-slate-400" />
                  Two-Factor Authentication
                </button>
              </div>

              <div className="pt-1.5 border-t border-slate-100">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onLogoutClick();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 font-medium transition-colors"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
