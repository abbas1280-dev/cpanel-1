import React, { useState, useRef } from 'react';
import {
  User,
  Mail,
  Lock,
  Shield,
  Upload,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  LogOut,
  QrCode,
  Copy,
  Check,
  Eye,
  EyeOff,
  Building,
  Phone,
  MapPin
} from 'lucide-react';
import { UserProfile } from '../types';

interface ProfileViewProps {
  user: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onLogout: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onUpdateProfile,
  onLogout,
  showToast
}) => {
  // Account Details form state
  const [accountData, setAccountData] = useState({
    name: user.name,
    companyName: user.companyName,
    phone: user.phone,
    address: user.address,
    city: user.city,
    country: user.country
  });

  // Email form state
  const [emailInput, setEmailInput] = useState(user.email);
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // 2FA modal state
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  // File input ref for avatar
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Account Details Submit
  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(accountData);
    showToast('Account details updated successfully!');
  };

  // Handle Email Update
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes('@')) {
      showToast('Please provide a valid email address.', 'error');
      return;
    }
    onUpdateProfile({ email: emailInput });
    setIsEditingEmail(false);
    showToast('Email address updated successfully!');
  };

  // Handle Password Change
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordData.currentPassword) {
      showToast('Please enter your current password.', 'error');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      showToast('New password must be at least 6 characters long.', 'error');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast('New password and confirm password do not match!', 'error');
      return;
    }

    // Success
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    showToast('Password changed successfully!');
  };

  // Handle Avatar Upload
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image size exceeds 5MB limit.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onUpdateProfile({ avatarUrl: reader.result });
          showToast('Profile picture uploaded successfully!');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    onUpdateProfile({ avatarUrl: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
    showToast('Profile picture removed.');
  };

  // Handle 2FA Verification
  const handleEnable2FA = (e: React.FormEvent) => {
    e.preventDefault();
    if (twoFactorCode.length < 6) {
      showToast('Please enter a 6-digit authentication code.', 'error');
      return;
    }
    onUpdateProfile({ twoFactorEnabled: true });
    setShow2FAModal(false);
    setTwoFactorCode('');
    showToast('Two-Factor Authentication is now enabled!');
  };

  const handleDisable2FA = () => {
    if (confirm('Are you sure you want to disable Two-Factor Authentication?')) {
      onUpdateProfile({ twoFactorEnabled: false });
      showToast('Two-Factor Authentication disabled.');
    }
  };

  const copySecretKey = () => {
    navigator.clipboard.writeText('JBSWY3DPEHPK3PXP');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Page Title & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Account Profile & Security</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage your personal credentials, contact info, and login security.</p>
        </div>
        <button
          onClick={onLogout}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 text-xs font-bold transition-colors self-start sm:self-auto border border-rose-200"
        >
          <LogOut className="w-4 h-4" /> Log Out
        </button>
      </div>

      {/* 1. Profile Avatar & Basic Identity Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Camera className="w-5 h-5 text-indigo-600" />
          Profile Picture
        </h3>

        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <div className="relative group">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-28 h-28 rounded-full object-cover ring-4 ring-indigo-50 shadow-md"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-[#11074a] to-indigo-700 text-white flex items-center justify-center text-3xl font-bold ring-4 ring-indigo-50 shadow-md">
                {user.name ? user.name.slice(0, 2).toUpperCase() : 'TH'}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition-transform active:scale-90"
              title="Upload new photo"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <h4 className="text-lg font-bold text-slate-800">{user.name}</h4>
            <p className="text-xs text-slate-500">
              Allowed formats: PNG, JPG, GIF or WEBP. Max file size: 5MB.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition-colors"
              >
                <Upload className="w-3.5 h-3.5" /> Upload Photo
              </button>

              {user.avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600 text-xs font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Account Details Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-600" />
          User Account Details
        </h3>

        <form onSubmit={handleAccountSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={accountData.name}
                  onChange={(e) => setAccountData({ ...accountData, name: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Company / Organization</label>
              <div className="relative">
                <input
                  type="text"
                  value={accountData.companyName}
                  onChange={(e) => setAccountData({ ...accountData, companyName: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
                <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number</label>
              <div className="relative">
                <input
                  type="tel"
                  value={accountData.phone}
                  onChange={(e) => setAccountData({ ...accountData, phone: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Country</label>
              <div className="relative">
                <input
                  type="text"
                  value={accountData.country}
                  onChange={(e) => setAccountData({ ...accountData, country: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Street Address & City</label>
              <input
                type="text"
                value={accountData.address}
                onChange={(e) => setAccountData({ ...accountData, address: e.target.value })}
                placeholder="e.g. Mirpur-10, Dhaka 1206"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
            >
              Save Account Details
            </button>
          </div>
        </form>
      </div>

      {/* 3. Email Address Update Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Mail className="w-5 h-5 text-indigo-600" />
          Email Address
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          Your primary email address is used for invoices, domain renewal notices, and account security.
        </p>

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="max-w-md">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Primary Email</label>
            <div className="relative">
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
            >
              Update Email
            </button>
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Verified
            </span>
          </div>
        </form>
      </div>

      {/* 4. Password Change Section (with Confirm Password) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Lock className="w-5 h-5 text-indigo-600" />
          Change Password
        </h3>
        <p className="text-xs text-slate-500 mb-6">
          Ensure your account is using a long, random password to stay secure.
        </p>

        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPass ? 'text' : 'password'}
                required
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                placeholder="Enter current password"
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <button
                type="button"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showNewPass ? 'text' : 'password'}
                required
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                placeholder="Enter new password (min. 6 characters)"
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPass ? 'text' : 'password'}
                required
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="Confirm your new password"
                className={`w-full pl-9 pr-10 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 font-medium ${
                  passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword
                    ? 'border-rose-400 focus:ring-rose-500'
                    : 'border-slate-200 focus:ring-indigo-500'
                }`}
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
              <p className="text-[11px] text-rose-500 mt-1 font-semibold">
                Passwords do not match.
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
            >
              Update Password
            </button>
          </div>
        </form>
      </div>

      {/* 5. Two-Factor Authentication (2FA) Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              Two-Factor Authentication (2FA)
            </h3>
            <p className="text-xs text-slate-500 max-w-xl">
              Add an extra layer of security to your client portal account by requiring a code from your mobile authenticator app (Google Authenticator, Authy, etc.).
            </p>
          </div>

          <div>
            {user.twoFactorEnabled ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Enabled
                </span>
                <button
                  onClick={handleDisable2FA}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                >
                  Disable
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShow2FAModal(true)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2"
              >
                <Shield className="w-4 h-4" /> Enable 2FA
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 6. Logout Area */}
      <div className="bg-rose-50/50 rounded-2xl border border-rose-200/80 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-rose-900">Sign Out of All Sessions</h4>
          <p className="text-xs text-rose-700/80 mt-0.5">End your current session securely across your devices.</p>
        </div>
        <button
          onClick={onLogout}
          className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" /> Log Out
        </button>
      </div>

      {/* 2FA Setup Modal Dialog */}
      {show2FAModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Set Up 2-Factor Auth</h3>
                  <p className="text-xs text-slate-500">Scan QR code in Authenticator app</p>
                </div>
              </div>
            </div>

            {/* Simulated QR Code */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex flex-col items-center justify-center mb-4">
              <div className="w-40 h-40 bg-white p-2.5 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center">
                {/* SVG QR Code Simulation */}
                <svg className="w-full h-full text-slate-800" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14-2h4v2h-4v-2zm-4 0h2v4h-2v-4zm4 4h4v4h-4v-4zm-4 2h2v2h-2v-2zm-6-8h4v2H8v-2zm2 4h2v2h-2v-2z" />
                </svg>
              </div>

              <div className="mt-3 text-center">
                <span className="text-[11px] text-slate-400 block mb-1">Manual Secret Key:</span>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-700">
                  <span>JBSWY3DPEHPK3PXP</span>
                  <button
                    onClick={copySecretKey}
                    className="text-indigo-600 hover:text-indigo-800"
                    title="Copy Secret Key"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Verification Code Form */}
            <form onSubmit={handleEnable2FA} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Enter 6-Digit Code from App
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center tracking-[0.5em] text-lg font-bold font-mono py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShow2FAModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
                >
                  Verify & Activate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
