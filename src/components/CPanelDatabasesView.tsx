import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Database,
  Trash2,
  Key,
  CheckCircle2,
  RefreshCw,
  Search,
  Server,
  AlertTriangle,
  Wrench,
  Info,
  ArrowLeft,
  Eye,
  EyeOff,
  Edit2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { ServiceItem } from '../types';

interface CPanelDatabasesViewProps {
  currentService?: ServiceItem;
  allServices: ServiceItem[];
  onExit: () => void;
  initialTab?: string;
}

interface MariaDBDatabase {
  name: string;
  charset: string;
  collation: string;
  tablesCount: number;
  sizeBytes: number;
  sizeFormatted: string;
  assignedUsers: string[];
  status: string;
}

interface MariaDBUser {
  username: string;
  assignedDatabases: string[];
  status: string;
}

interface ServerStatus {
  online: boolean;
  version?: string;
  uptime?: string;
  activeConnections?: number;
  host?: string;
  port?: number;
  error?: string;
}

interface CheckRepairResult {
  Table: string;
  Op: string;
  Msg_type: string;
  Msg_text: string;
}

const SUPPORTED_PRIVILEGES = [
  'ALTER',
  'ALTER ROUTINE',
  'CREATE',
  'CREATE ROUTINE',
  'CREATE TEMPORARY TABLES',
  'CREATE VIEW',
  'DELETE',
  'DROP',
  'EVENT',
  'EXECUTE',
  'INDEX',
  'INSERT',
  'LOCK TABLES',
  'REFERENCES',
  'SELECT',
  'SHOW VIEW',
  'TRIGGER',
  'UPDATE'
] as const;

export const CPanelDatabasesView: React.FC<CPanelDatabasesViewProps> = ({
  currentService,
  allServices,
  onExit,
  initialTab = 'main'
}) => {
  // Active domain environment
  const [activeDomain, setActiveDomain] = useState<string>(
    currentService?.domain || (allServices.length > 0 ? allServices[0].domain : 'turkyhub.com')
  );

  const accountPrefix = useMemo(() => {
    const clean = activeDomain.split('.')[0].replace(/[^a-z0-9]/gi, '').slice(0, 7).toLowerCase();
    return (clean || 'user') + '1';
  }, [activeDomain]);

  // Main navigation view mode:
  // 'main' (Exact match to "Manage My Databases" in media_1789694105362.png)
  // 'privileges' (Manage User Privileges view reached via "Add User To Database")
  const [viewMode, setViewMode] = useState<'main' | 'privileges'>(
    initialTab === 'privileges' ? 'privileges' : 'main'
  );

  // Data states
  const [databases, setDatabases] = useState<MariaDBDatabase[]>([]);
  const [users, setUsers] = useState<MariaDBUser[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    online: true,
    version: 'MariaDB 11.8.6',
    host: '127.0.0.1',
    port: 3306
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & Pagination states for Current Databases
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Form states: Create DB
  const [newDbSuffix, setNewDbSuffix] = useState<string>('');

  // Modify Databases: Check & Repair Database selections
  const [checkDbSelect, setCheckDbSelect] = useState<string>('');
  const [repairDbSelect, setRepairDbSelect] = useState<string>('');
  const [checkRepairModal, setCheckRepairModal] = useState<{
    open: boolean;
    title: string;
    database: string;
    op: 'check' | 'repair';
    results: CheckRepairResult[];
  } | null>(null);

  // Rename Database Modal State
  const [renamingDb, setRenamingDb] = useState<{ oldDb: string; newSuffix: string } | null>(null);

  // Rename User Modal State
  const [renamingUser, setRenamingUser] = useState<{ oldUsername: string; newSuffix: string } | null>(null);

  // Form states: Create User
  const [newUserSuffix, setNewUserSuffix] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState<string>('');
  const [newUserConfirmPassword, setNewUserConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [copiedPass, setCopiedPass] = useState<boolean>(false);

  // Assign user to database state
  const [assignDb, setAssignDb] = useState<string>('');
  const [assignUser, setAssignUser] = useState<string>('');

  // Privilege Management state
  const [privTargetDb, setPrivTargetDb] = useState<string>('');
  const [privTargetUser, setPrivTargetUser] = useState<string>('');
  const [privAll, setPrivAll] = useState<boolean>(false);
  const [selectedPrivs, setSelectedPrivs] = useState<Record<string, boolean>>({});

  // Change Password Modal state
  const [changingPassUser, setChangingPassUser] = useState<string | null>(null);
  const [changeNewPass, setChangeNewPass] = useState<string>('');
  const [changeConfirmPass, setChangeConfirmPass] = useState<string>('');

  // Auto-clear toast
  useEffect(() => {
    if (statusMessage) {
      const t = setTimeout(() => setStatusMessage(null), 6000);
      return () => clearTimeout(t);
    }
  }, [statusMessage]);

  // Load live MariaDB data for active domain
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dbRes, userRes, statRes] = await Promise.all([
        fetch(`/api/cpanel/databases/list?domain=${encodeURIComponent(activeDomain)}`),
        fetch(`/api/cpanel/databases/users/list?domain=${encodeURIComponent(activeDomain)}`),
        fetch('/api/cpanel/databases/status')
      ]);

      const [dbData, userData, statData] = await Promise.all([
        dbRes.json(),
        userRes.json(),
        statRes.json()
      ]);

      if (dbData.success) {
        const dbs: MariaDBDatabase[] = dbData.databases || [];
        setDatabases(dbs);
        if (dbs.length > 0) {
          setCheckDbSelect(prev => (dbs.some(d => d.name === prev) ? prev : dbs[0].name));
          setRepairDbSelect(prev => (dbs.some(d => d.name === prev) ? prev : dbs[0].name));
          setAssignDb(prev => (dbs.some(d => d.name === prev) ? prev : dbs[0].name));
        }
      }
      if (userData.success) {
        const uList: MariaDBUser[] = userData.users || [];
        setUsers(uList);
        if (uList.length > 0) {
          setAssignUser(prev => (uList.some(u => u.username === prev) ? prev : uList[0].username));
        }
      }
      if (statData && typeof statData.online === 'boolean') {
        setServerStatus(statData);
      }
    } catch (e: any) {
      // Retain state
    } finally {
      setIsLoading(false);
    }
  }, [activeDomain]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll status every 15s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/cpanel/databases/status');
        const data = await res.json();
        if (data && typeof data.online === 'boolean') {
          setServerStatus(data);
        }
      } catch (e) {}
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Password Generator
  const generateStrongPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    let pass = '';
    for (let i = 0; i < 16; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const handleGeneratePassword = () => {
    const pass = generateStrongPassword();
    setNewUserPassword(pass);
    setNewUserConfirmPassword(pass);
    navigator.clipboard.writeText(pass);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 3000);
  };

  // Password Strength Calculator (Matches Screenshot: lime-green bar with text)
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, text: 'Very Weak (0/100)', color: 'bg-gray-300', width: '5%' };
    let score = 0;
    if (pass.length >= 8) score += 25;
    if (pass.length >= 12) score += 25;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 20;
    if (/\d/.test(pass)) score += 15;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pass)) score += 15;

    if (score >= 85) return { score, text: `Very Strong (${score}/100)`, color: 'bg-[#76e000]', width: '100%' };
    if (score >= 60) return { score, text: `Strong (${score}/100)`, color: 'bg-[#99cc00]', width: '75%' };
    if (score >= 40) return { score, text: `Moderate (${score}/100)`, color: 'bg-[#ffcc00]', width: '50%' };
    return { score, text: `Weak (${score}/100)`, color: 'bg-[#ff3300]', width: '25%' };
  };

  // =========================================================================
  // ACTIONS: DATABASE CRUD
  // =========================================================================
  const handleCreateDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDbSuffix.trim()) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/cpanel/databases/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          dbName: newDbSuffix.trim(),
          charset: 'utf8mb4',
          collation: 'utf8mb4_unicode_ci'
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `Added the database "${data.database}".`
        });
        setNewDbSuffix('');
        await loadData();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to create database.' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Network error while creating database.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDatabase = async (dbName: string) => {
    const confirmed = window.confirm(
      `Are you sure you wish to permanently remove the database "${dbName}"? All tables and data will be permanently destroyed.`
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/cpanel/databases/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: activeDomain, database: dbName })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: `Deleted the database "${dbName}".` });
        await loadData();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to delete database.' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Network error while deleting database.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenameDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingDb || !renamingDb.newSuffix.trim()) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/cpanel/databases/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          oldDatabase: renamingDb.oldDb,
          newDatabaseSuffix: renamingDb.newSuffix.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `Renamed database "${data.oldDatabase}" to "${data.newDatabase}".`
        });
        setRenamingDb(null);
        await loadData();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to rename database.' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Network error while renaming database.' });
    } finally {
      setActionLoading(false);
    }
  };

  // =========================================================================
  // ACTIONS: CHECK & REPAIR DATABASE
  // =========================================================================
  const handleCheckDatabase = async (dbName: string) => {
    if (!dbName) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/cpanel/databases/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: activeDomain, database: dbName })
      });
      const data = await res.json();
      if (data.success) {
        setCheckRepairModal({
          open: true,
          title: `Check Database: ${dbName}`,
          database: dbName,
          op: 'check',
          results: data.results || []
        });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Check failed.' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Network error while checking database.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRepairDatabase = async (dbName: string) => {
    if (!dbName) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/cpanel/databases/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: activeDomain, database: dbName })
      });
      const data = await res.json();
      if (data.success) {
        setCheckRepairModal({
          open: true,
          title: `Repair Database: ${dbName}`,
          database: dbName,
          op: 'repair',
          results: data.results || []
        });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Repair failed.' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Network error while repairing database.' });
    } finally {
      setActionLoading(false);
    }
  };

  // =========================================================================
  // ACTIONS: USER CRUD
  // =========================================================================
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserSuffix.trim() || !newUserPassword) return;

    if (newUserPassword !== newUserConfirmPassword) {
      setStatusMessage({ type: 'error', text: 'The passwords entered do not match.' });
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/cpanel/databases/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          username: newUserSuffix.trim(),
          password: newUserPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `Added user "${data.username}".`
        });
        setNewUserSuffix('');
        setNewUserPassword('');
        setNewUserConfirmPassword('');
        await loadData();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to create user.' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Network error while creating user.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (username: string) => {
    const confirmed = window.confirm(
      `Are you sure you wish to permanently remove the database user "${username}"?`
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/cpanel/databases/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: activeDomain, username })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: `Deleted user "${username}".` });
        await loadData();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to delete user.' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Network error while deleting user.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenameUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingUser || !renamingUser.newSuffix.trim()) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/cpanel/databases/users/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          oldUsername: renamingUser.oldUsername,
          newUsernameSuffix: renamingUser.newSuffix.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `Renamed user "${data.oldUsername}" to "${data.newUsername}".`
        });
        setRenamingUser(null);
        await loadData();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to rename user.' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Network error while renaming user.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changingPassUser || !changeNewPass) return;
    if (changeNewPass !== changeConfirmPass) {
      setStatusMessage({ type: 'error', text: 'The passwords entered do not match.' });
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/cpanel/databases/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          username: changingPassUser,
          newPassword: changeNewPass
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `Password updated for user "${changingPassUser}".`
        });
        setChangingPassUser(null);
        setChangeNewPass('');
        setChangeConfirmPass('');
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to change password.' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Network error while changing password.' });
    } finally {
      setActionLoading(false);
    }
  };

  // =========================================================================
  // ACTIONS: ASSIGN USER & MANAGE PRIVILEGES
  // =========================================================================
  const handleOpenPrivileges = async (user: string, db: string) => {
    if (!user || !db) return;
    setPrivTargetUser(user);
    setPrivTargetDb(db);
    setActionLoading(true);

    try {
      const res = await fetch(
        `/api/cpanel/databases/privileges?domain=${encodeURIComponent(activeDomain)}&database=${encodeURIComponent(
          db
        )}&username=${encodeURIComponent(user)}`
      );
      const data = await res.json();
      const existing: string[] = data.privileges || [];
      const isAll =
        existing.includes('ALL') ||
        (existing.length >= SUPPORTED_PRIVILEGES.length &&
          SUPPORTED_PRIVILEGES.every(p => existing.includes(p)));

      setPrivAll(isAll);
      const privMap: Record<string, boolean> = {};
      SUPPORTED_PRIVILEGES.forEach(p => {
        privMap[p] = isAll || existing.includes(p);
      });
      setSelectedPrivs(privMap);
      setViewMode('privileges');
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Error loading user privileges.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePrivilege = (priv: string) => {
    setSelectedPrivs(prev => {
      const updated = { ...prev, [priv]: !prev[priv] };
      const allSelected = SUPPORTED_PRIVILEGES.every(p => updated[p]);
      setPrivAll(allSelected);
      return updated;
    });
  };

  const handleToggleAllPrivileges = () => {
    const nextVal = !privAll;
    setPrivAll(nextVal);
    const updated: Record<string, boolean> = {};
    SUPPORTED_PRIVILEGES.forEach(p => {
      updated[p] = nextVal;
    });
    setSelectedPrivs(updated);
  };

  const handleSavePrivileges = async () => {
    setActionLoading(true);
    try {
      const chosenPrivs = privAll ? ['ALL'] : Object.keys(selectedPrivs).filter(p => selectedPrivs[p]);

      const res = await fetch('/api/cpanel/databases/privileges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          database: privTargetDb,
          username: privTargetUser,
          privileges: chosenPrivs
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `Success: Granted privileges to user "${privTargetUser}" on database "${privTargetDb}".`
        });
        setViewMode('main');
        await loadData();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to update privileges.' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Network error while saving privileges.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveUserFromDb = async (dbName: string, username: string) => {
    const confirmed = window.confirm(`Revoke all privileges and remove user "${username}" from database "${dbName}"?`);
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/cpanel/databases/users/remove-from-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          database: dbName,
          username
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: `Revoked access for user "${username}" from database "${dbName}".` });
        await loadData();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to remove user from database.' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Network error while removing user.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered & Paginated Databases
  const filteredDatabases = useMemo(() => {
    if (!searchQuery.trim()) return databases;
    const q = searchQuery.toLowerCase();
    return databases.filter(
      d => d.name.toLowerCase().includes(q) || d.assignedUsers.some(u => u.toLowerCase().includes(q))
    );
  }, [databases, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredDatabases.length / pageSize));
  const paginatedDatabases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDatabases.slice(start, start + pageSize);
  }, [filteredDatabases, currentPage, pageSize]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
    setCurrentPage(1);
  };

  // Half-split privileges for clean 2-column layout (matching Image 4)
  const leftColPrivs = SUPPORTED_PRIVILEGES.slice(0, 9);
  const rightColPrivs = SUPPORTED_PRIVILEGES.slice(9);

  // =========================================================================
  // VIEW: MANAGE USER PRIVILEGES (Exact cPanel Standard Privileges Screen)
  // =========================================================================
  if (viewMode === 'privileges') {
    return (
      <div className="min-h-screen bg-white text-[#333333] font-sans antialiased overflow-y-auto px-6 py-6 lg:px-10">
        <div className="max-w-4xl space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-normal text-[#222222]">Manage User Privileges</h1>
            <div className="text-sm text-[#4b5563] mt-3 space-y-1">
              <div>
                <strong className="text-[#222222]">User:</strong> <span className="font-mono">{privTargetUser}</span>
              </div>
              <div>
                <strong className="text-[#222222]">Database:</strong> <span className="font-mono">{privTargetDb}</span>
              </div>
            </div>
          </div>

          {/* Toast Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded text-sm flex items-center justify-between border ${
                statusMessage.type === 'success'
                  ? 'bg-[#dff0d8] border-[#d6e9c6] text-[#3c763d]'
                  : 'bg-[#f2dede] border-[#ebccd1] text-[#a94442]'
              }`}
            >
              <span>{statusMessage.text}</span>
              <button onClick={() => setStatusMessage(null)} className="text-xs font-bold px-1 cursor-pointer">
                ✕
              </button>
            </div>
          )}

          {/* Privileges Box */}
          <div className="bg-white border border-[#ced4da] rounded shadow-2xs overflow-hidden">
            {/* Master Toggle */}
            <div className="p-3.5 bg-white border-b border-[#ced4da] flex items-center">
              <label className="flex items-center gap-2.5 text-sm font-bold text-[#333333] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={privAll}
                  onChange={handleToggleAllPrivileges}
                  className="w-4 h-4 text-[#0070d2] border-[#ced4da] rounded focus:ring-0 cursor-pointer"
                />
                <span>ALL PRIVILEGES</span>
              </label>
            </div>

            {/* 2 Columns of Privileges */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#e5e7eb] text-sm">
              {/* Left Column (9 Privileges) */}
              <div className="divide-y divide-[#f1f3f5]">
                {leftColPrivs.map(priv => (
                  <label
                    key={priv}
                    className="p-3 flex items-center gap-2.5 hover:bg-[#f8f9fa] cursor-pointer select-none transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={!!selectedPrivs[priv]}
                      onChange={() => handleTogglePrivilege(priv)}
                      className="w-4 h-4 text-[#0070d2] border-[#ced4da] rounded focus:ring-0 cursor-pointer"
                    />
                    <span className="font-mono text-xs font-bold text-[#374151]">{priv}</span>
                  </label>
                ))}
              </div>

              {/* Right Column (9 Privileges) */}
              <div className="divide-y divide-[#f1f3f5]">
                {rightColPrivs.map(priv => (
                  <label
                    key={priv}
                    className="p-3 flex items-center gap-2.5 hover:bg-[#f8f9fa] cursor-pointer select-none transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={!!selectedPrivs[priv]}
                      onChange={() => handleTogglePrivilege(priv)}
                      className="w-4 h-4 text-[#0070d2] border-[#ced4da] rounded focus:ring-0 cursor-pointer"
                    />
                    <span className="font-mono text-xs font-bold text-[#374151]">{priv}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="p-4 bg-white border-t border-[#ced4da] flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSavePrivileges}
                disabled={actionLoading}
                className="px-5 py-2 bg-[#0070d2] hover:bg-[#005fb2] active:bg-[#004f98] text-white font-semibold text-sm rounded shadow-2xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>Make Changes</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenPrivileges(privTargetUser, privTargetDb)}
                disabled={actionLoading}
                className="px-4 py-2 bg-[#f8f9fa] hover:bg-[#e9ecef] border border-[#ced4da] text-[#495057] text-sm font-medium rounded shadow-2xs transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Go Back Link */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setViewMode('main')}
              className="text-[#0070d2] hover:underline text-sm font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>&lt; Go Back</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: MAIN "MANAGE MY DATABASES" (Exact match to media_1789694105362.png)
  // =========================================================================
  return (
    <div className="min-h-screen bg-white text-[#333333] font-sans antialiased overflow-y-auto px-6 py-6 lg:px-10">
      <div className="max-w-5xl mx-auto space-y-8 pb-16">
        {/* Top Notification Toast */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded text-sm flex items-center justify-between border shadow-2xs ${
              statusMessage.type === 'success'
                ? 'bg-[#dff0d8] border-[#d6e9c6] text-[#3c763d]'
                : 'bg-[#f2dede] border-[#ebccd1] text-[#a94442]'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#3c763d] shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[#a94442] shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-xs font-bold px-1 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Page Title, Subtitle, and Top Controls */}
        <div>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl lg:text-[28px] font-normal text-[#222222] tracking-tight">
              Manage My Databases
            </h1>

            {/* Optional Exit Button */}
            <button
              onClick={onExit}
              className="text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-2.5 py-1 hover:bg-gray-50 cursor-pointer"
            >
              Exit
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 mt-2">
            <p className="text-xs text-[#666666] leading-relaxed max-w-3xl">
              Manage large amounts of information over the web easily. Databases are necessary to run many web-based
              applications, such as bulletin boards, content management systems, and online shopping carts. For more
              information, read the <span className="text-[#0070d2] hover:underline cursor-pointer">documentation</span>.
            </p>

            {/* Jump to Database Users Link */}
            <a
              href="#database-users"
              className="text-xs text-[#0070d2] hover:underline whitespace-nowrap shrink-0 flex items-center gap-1"
            >
              <span>&darr; Jump to Database Users</span>
            </a>
          </div>
        </div>

        {/* =================================================================== */}
        {/* SECTION 1: CREATE NEW DATABASE */}
        {/* =================================================================== */}
        <div className="space-y-3 pt-2">
          <h2 className="text-lg font-bold text-[#222222]">Create New Database</h2>

          <form onSubmit={handleCreateDatabase} className="space-y-3">
            <div>
              <label className="block text-xs font-normal text-[#444444] mb-1">New Database:</label>
              <div className="flex items-stretch rounded border border-[#ced4da] overflow-hidden max-w-[380px] focus-within:ring-1 focus-within:ring-[#0070d2] focus-within:border-[#0070d2] bg-white">
                <span className="bg-[#f3f4f6] text-[#495057] font-mono text-xs px-3 py-1.5 border-r border-[#ced4da] select-none font-semibold flex items-center">
                  {accountPrefix}_
                </span>
                <input
                  type="text"
                  value={newDbSuffix}
                  onChange={e => setNewDbSuffix(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder=""
                  required
                  className="flex-1 px-2.5 py-1.5 text-xs font-mono text-[#212529] bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={actionLoading || !newDbSuffix.trim()}
                className="px-3.5 py-1.5 bg-[#0070d2] hover:bg-[#005fb2] active:bg-[#004f98] text-white rounded text-xs font-medium shadow-2xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>Create Database</span>
              </button>
            </div>
          </form>
        </div>

        {/* =================================================================== */}
        {/* SECTION 2: MODIFY DATABASES */}
        {/* =================================================================== */}
        <div className="space-y-4 pt-4">
          <h2 className="text-lg font-bold text-[#222222]">Modify Databases</h2>

          {/* Check Database Row */}
          <div className="space-y-1">
            <label className="block text-xs font-normal text-[#444444]">Check Database:</label>
            <div className="flex items-center gap-3">
              <select
                value={checkDbSelect}
                onChange={e => setCheckDbSelect(e.target.value)}
                className="w-[380px] max-w-full px-2.5 py-1.5 rounded border border-[#ced4da] text-xs bg-white font-mono text-[#212529] focus:outline-none focus:ring-1 focus:ring-[#0070d2]"
              >
                {databases.length === 0 && <option value="">No databases</option>}
                {databases.map(d => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handleCheckDatabase(checkDbSelect)}
                disabled={actionLoading || !checkDbSelect}
                className="px-3.5 py-1.5 rounded bg-[#0070d2] hover:bg-[#005fb2] active:bg-[#004f98] text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-40 whitespace-nowrap"
              >
                Check Database
              </button>
            </div>
          </div>

          {/* Repair Database Row */}
          <div className="space-y-1">
            <label className="block text-xs font-normal text-[#444444]">Repair Database:</label>
            <div className="flex items-center gap-3">
              <select
                value={repairDbSelect}
                onChange={e => setRepairDbSelect(e.target.value)}
                className="w-[380px] max-w-full px-2.5 py-1.5 rounded border border-[#ced4da] text-xs bg-white font-mono text-[#212529] focus:outline-none focus:ring-1 focus:ring-[#0070d2]"
              >
                {databases.length === 0 && <option value="">No databases</option>}
                {databases.map(d => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handleRepairDatabase(repairDbSelect)}
                disabled={actionLoading || !repairDbSelect}
                className="px-3.5 py-1.5 rounded bg-[#0070d2] hover:bg-[#005fb2] active:bg-[#004f98] text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-40 whitespace-nowrap"
              >
                Repair Database
              </button>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* SECTION 3: CURRENT DATABASES */}
        {/* =================================================================== */}
        <div id="current-databases" className="space-y-3 pt-4">
          <h2 className="text-lg font-bold text-[#222222]">Current Databases</h2>

          {/* Search Box with Go Button */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-[380px]">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search"
              className="flex-1 px-2.5 py-1.5 rounded border border-[#ced4da] text-xs bg-white text-[#212529] focus:outline-none focus:ring-1 focus:ring-[#0070d2]"
            />
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-[#0070d2] hover:bg-[#005fb2] text-white text-xs font-medium cursor-pointer"
            >
              Go
            </button>
          </form>

          {/* Databases Table */}
          <div className="border border-[#ced4da] rounded shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8f9fa] border-b border-[#ced4da] text-gray-700 font-bold">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-[#495057]">Database</th>
                  <th className="py-2.5 px-3 font-semibold text-[#495057]">Size</th>
                  <th className="py-2.5 px-3 font-semibold text-[#495057]">Privileged Users</th>
                  <th className="py-2.5 px-3 font-semibold text-[#495057]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e9ecef]">
                {paginatedDatabases.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-500 italic">
                      No databases found.
                    </td>
                  </tr>
                ) : (
                  paginatedDatabases.map(db => (
                    <tr key={db.name} className="hover:bg-[#f9fafb]">
                      {/* Database Name */}
                      <td className="py-2.5 px-3 font-mono font-medium text-[#222222]">{db.name}</td>

                      {/* Size */}
                      <td className="py-2.5 px-3 font-mono text-gray-600">
                        {db.sizeFormatted || '0.00 KB'}
                      </td>

                      {/* Privileged Users */}
                      <td className="py-2.5 px-3 text-xs">
                        {db.assignedUsers.length === 0 ? (
                          <span className="text-gray-400 italic">None</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            {db.assignedUsers.map(u => (
                              <span key={u} className="inline-flex items-center gap-1 font-mono text-gray-700">
                                <span>{u}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveUserFromDb(db.name, u)}
                                  title={`Remove ${u} from ${db.name}`}
                                  className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                >
                                  🗑
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Actions: Rename, Delete */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setRenamingDb({ oldDb: db.name, newSuffix: db.name.replace(`${accountPrefix}_`, '') })
                            }
                            className="text-[#0070d2] hover:underline flex items-center gap-1 text-xs cursor-pointer"
                          >
                            <span>✏</span>
                            <span>Rename</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteDatabase(db.name)}
                            className="text-[#0070d2] hover:underline flex items-center gap-1 text-xs cursor-pointer"
                          >
                            <span>🗑</span>
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer: Pagination Controls & Jump Link */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span>Page Size:</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-[#ced4da] rounded px-2 py-0.5 bg-white text-xs"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>

              <div className="flex items-center gap-1 ml-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(1)}
                  className="p-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
                  title="First Page"
                >
                  <ChevronsLeft className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="px-2 text-xs">
                  {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
                  title="Next Page"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="p-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
                  title="Last Page"
                >
                  <ChevronsRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Jump Link */}
            <a href="#database-users" className="text-[#0070d2] hover:underline flex items-center gap-1">
              <span>&uarr; Jump to Databases</span>
            </a>
          </div>
        </div>

        {/* =================================================================== */}
        {/* SECTION 4: DATABASE USERS / ADD NEW USER */}
        {/* =================================================================== */}
        <div id="database-users" className="space-y-4 pt-6 border-t border-gray-100">
          <h2 className="text-xl font-bold text-[#222222]">Database Users</h2>
          <h3 className="text-base font-bold text-[#222222]">Add New User</h3>

          <form onSubmit={handleCreateUser} className="space-y-3 max-w-[380px]">
            <div>
              <label className="block text-xs font-normal text-[#444444] mb-1">Username:</label>
              <div className="flex items-stretch rounded border border-[#ced4da] overflow-hidden focus-within:ring-1 focus-within:ring-[#0070d2] focus-within:border-[#0070d2] bg-white">
                <span className="bg-[#f3f4f6] text-[#495057] font-mono text-xs px-3 py-1.5 border-r border-[#ced4da] select-none font-semibold flex items-center">
                  {accountPrefix}_
                </span>
                <input
                  type="text"
                  value={newUserSuffix}
                  onChange={e => setNewUserSuffix(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder=""
                  required
                  className="flex-1 px-2.5 py-1.5 text-xs font-mono text-[#212529] bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-normal text-[#444444] mb-1">Password:</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newUserPassword}
                  onChange={e => setNewUserPassword(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 pr-8 rounded border border-[#ced4da] text-xs font-mono text-[#212529] bg-white focus:outline-none focus:ring-1 focus:ring-[#0070d2]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-normal text-[#444444] mb-1">Password (Again):</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newUserConfirmPassword}
                onChange={e => setNewUserConfirmPassword(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded border border-[#ced4da] text-xs font-mono text-[#212529] bg-white focus:outline-none focus:ring-1 focus:ring-[#0070d2]"
              />
            </div>

            {/* Strength Meter & Password Generator Tool */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1 text-xs text-[#444444]">
                <span>Strength</span>
                <Info className="w-3.5 h-3.5 text-gray-400" />
              </div>

              {/* Lime green strength progress bar */}
              <div className="h-6 w-full bg-gray-200 rounded overflow-hidden relative flex items-center justify-center text-xs font-bold">
                <div
                  className={`absolute left-0 top-0 bottom-0 transition-all ${
                    getPasswordStrength(newUserPassword).color
                  }`}
                  style={{ width: getPasswordStrength(newUserPassword).width }}
                />
                <span className="relative z-10 text-gray-900 font-bold text-[11px]">
                  {getPasswordStrength(newUserPassword).text}
                </span>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="px-3 py-1 text-xs font-normal bg-[#f8f9fa] hover:bg-[#e9ecef] border border-[#ced4da] text-[#495057] rounded shadow-2xs transition-colors cursor-pointer"
                >
                  Password Generator
                </button>
              </div>

              {copiedPass && (
                <div className="text-[11px] text-[#2e7d32] font-semibold">Generated password copied to clipboard!</div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={actionLoading || !newUserSuffix.trim() || !newUserPassword}
                className="px-3.5 py-1.5 bg-[#0070d2] hover:bg-[#005fb2] active:bg-[#004f98] text-white rounded text-xs font-medium shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>Create User</span>
              </button>
            </div>
          </form>
        </div>

        {/* =================================================================== */}
        {/* SECTION 5: ADD USER TO DATABASE */}
        {/* =================================================================== */}
        <div className="space-y-3 pt-4">
          <h2 className="text-lg font-bold text-[#222222]">Add User To Database</h2>

          <form
            onSubmit={e => {
              e.preventDefault();
              handleOpenPrivileges(assignUser, assignDb);
            }}
            className="space-y-3 max-w-[380px]"
          >
            <div>
              <label className="block text-xs font-normal text-[#444444] mb-1">User:</label>
              <select
                value={assignUser}
                onChange={e => setAssignUser(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-[#ced4da] text-xs bg-white font-mono text-[#212529] focus:outline-none focus:ring-1 focus:ring-[#0070d2]"
              >
                {users.length === 0 && <option value="">No users available</option>}
                {users.map(u => (
                  <option key={u.username} value={u.username}>
                    {u.username}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-normal text-[#444444] mb-1">Database:</label>
              <select
                value={assignDb}
                onChange={e => setAssignDb(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-[#ced4da] text-xs bg-white font-mono text-[#212529] focus:outline-none focus:ring-1 focus:ring-[#0070d2]"
              >
                {databases.length === 0 && <option value="">No databases available</option>}
                {databases.map(d => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <button
                type="submit"
                disabled={!assignUser || !assignDb || actionLoading}
                className="px-4 py-1.5 bg-[#0070d2] hover:bg-[#005fb2] active:bg-[#004f98] text-white rounded text-xs font-medium shadow-2xs cursor-pointer disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </form>
        </div>

        {/* =================================================================== */}
        {/* SECTION 6: CURRENT USERS */}
        {/* =================================================================== */}
        <div className="space-y-3 pt-4">
          <h2 className="text-lg font-bold text-[#222222]">Current Users</h2>

          <div className="border border-[#ced4da] rounded shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8f9fa] border-b border-[#ced4da] text-gray-700 font-bold">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-[#495057]">Users</th>
                  <th className="py-2.5 px-3 font-semibold text-[#495057]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e9ecef]">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-6 text-center text-gray-500 italic">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map(u => (
                    <tr key={u.username} className="hover:bg-[#f9fafb]">
                      <td className="py-2.5 px-3 font-mono font-medium text-[#222222]">{u.username}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => {
                              setChangingPassUser(u.username);
                              setChangeNewPass('');
                              setChangeConfirmPass('');
                            }}
                            className="text-[#0070d2] hover:underline flex items-center gap-1 text-xs cursor-pointer"
                          >
                            <span>🔑</span>
                            <span>Change Password</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setRenamingUser({
                                oldUsername: u.username,
                                newSuffix: u.username.replace(`${accountPrefix}_`, '')
                              })
                            }
                            className="text-[#0070d2] hover:underline flex items-center gap-1 text-xs cursor-pointer"
                          >
                            <span>✏</span>
                            <span>Rename</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.username)}
                            className="text-[#0070d2] hover:underline flex items-center gap-1 text-xs cursor-pointer"
                          >
                            <span>🗑</span>
                            <span>Delete</span>
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

        {/* MODAL: CHECK / REPAIR RESULTS DIALOG */}
        {checkRepairModal && checkRepairModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-[#ced4da] rounded max-w-2xl w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#dee2e6] pb-3">
                <h3 className="text-base font-bold text-[#1f2937] flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-[#0070d2]" />
                  <span>{checkRepairModal.title}</span>
                </h3>
                <button
                  onClick={() => setCheckRepairModal(null)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-x-auto max-h-80 border border-[#dee2e6] rounded">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#f8f9fa] font-sans font-bold border-b border-[#dee2e6] text-[#495057]">
                    <tr>
                      <th className="p-2.5">Table</th>
                      <th className="p-2.5">Op</th>
                      <th className="p-2.5">Msg_type</th>
                      <th className="p-2.5">Msg_text</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e9ecef]">
                    {checkRepairModal.results.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-gray-500 italic">
                          No tables present in this database.
                        </td>
                      </tr>
                    ) : (
                      checkRepairModal.results.map((r, i) => (
                        <tr key={i} className="hover:bg-[#f8f9fa]">
                          <td className="p-2.5 font-bold text-[#212529]">{r.Table}</td>
                          <td className="p-2.5 text-gray-600">{r.Op}</td>
                          <td className="p-2.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                r.Msg_type === 'status' && r.Msg_text.toLowerCase() === 'ok'
                                  ? 'bg-[#dff0d8] text-[#3c763d]'
                                  : 'bg-[#fff3cd] text-[#856404]'
                              }`}
                            >
                              {r.Msg_type}
                            </span>
                          </td>
                          <td className="p-2.5 font-bold text-[#333333]">{r.Msg_text}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setCheckRepairModal(null)}
                  className="px-4 py-1.5 bg-[#0070d2] hover:bg-[#005fb2] text-white rounded text-xs font-medium cursor-pointer shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: RENAME DATABASE DIALOG */}
        {renamingDb && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-[#ced4da] rounded max-w-md w-full p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-[#1f2937]">Rename Database</h3>
              <p className="text-xs text-gray-500">
                Renaming database <strong className="font-mono text-[#212529]">{renamingDb.oldDb}</strong> will migrate
                all tables and privileges.
              </p>

              <form onSubmit={handleRenameDatabase} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#333333] mb-1">New Name:</label>
                  <div className="flex items-stretch rounded border border-[#ced4da] overflow-hidden focus-within:ring-1 focus-within:ring-[#0070d2] focus-within:border-[#0070d2] bg-white">
                    <span className="bg-[#f3f4f6] text-[#495057] font-mono text-xs px-3 py-1.5 border-r border-[#ced4da] select-none font-semibold flex items-center">
                      {accountPrefix}_
                    </span>
                    <input
                      type="text"
                      value={renamingDb.newSuffix}
                      onChange={e =>
                        setRenamingDb({
                          ...renamingDb,
                          newSuffix: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                        })
                      }
                      required
                      className="flex-1 px-2.5 py-1.5 text-xs font-mono text-[#212529] bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRenamingDb(null)}
                    className="px-3.5 py-1.5 border border-[#ced4da] rounded text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer shadow-2xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !renamingDb.newSuffix.trim()}
                    className="px-4 py-1.5 bg-[#0070d2] hover:bg-[#005fb2] text-white rounded text-xs font-medium shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? 'Renaming...' : 'Rename'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RENAME USER DIALOG */}
        {renamingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-[#ced4da] rounded max-w-md w-full p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-[#1f2937]">Rename User</h3>
              <p className="text-xs text-gray-500">
                Renaming user <strong className="font-mono text-[#212529]">{renamingUser.oldUsername}</strong> will
                update all existing database grants.
              </p>

              <form onSubmit={handleRenameUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#333333] mb-1">New Username:</label>
                  <div className="flex items-stretch rounded border border-[#ced4da] overflow-hidden focus-within:ring-1 focus-within:ring-[#0070d2] focus-within:border-[#0070d2] bg-white">
                    <span className="bg-[#f3f4f6] text-[#495057] font-mono text-xs px-3 py-1.5 border-r border-[#ced4da] select-none font-semibold flex items-center">
                      {accountPrefix}_
                    </span>
                    <input
                      type="text"
                      value={renamingUser.newSuffix}
                      onChange={e =>
                        setRenamingUser({
                          ...renamingUser,
                          newSuffix: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                        })
                      }
                      required
                      className="flex-1 px-2.5 py-1.5 text-xs font-mono text-[#212529] bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRenamingUser(null)}
                    className="px-3.5 py-1.5 border border-[#ced4da] rounded text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer shadow-2xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !renamingUser.newSuffix.trim()}
                    className="px-4 py-1.5 bg-[#0070d2] hover:bg-[#005fb2] text-white rounded text-xs font-medium shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? 'Renaming...' : 'Rename'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CHANGE PASSWORD DIALOG */}
        {changingPassUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-[#ced4da] rounded max-w-md w-full p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-[#1f2937]">Set User Password</h3>
              <p className="text-xs text-gray-500">
                Update password for user <strong className="font-mono text-[#212529]">{changingPassUser}</strong>.
              </p>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#333333] mb-1">New Password:</label>
                  <input
                    type="password"
                    value={changeNewPass}
                    onChange={e => setChangeNewPass(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-[#ced4da] font-mono text-[#212529] bg-white focus:outline-none focus:ring-1 focus:ring-[#0070d2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#333333] mb-1">Confirm Password:</label>
                  <input
                    type="password"
                    value={changeConfirmPass}
                    onChange={e => setChangeConfirmPass(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-[#ced4da] font-mono text-[#212529] bg-white focus:outline-none focus:ring-1 focus:ring-[#0070d2]"
                  />
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const pass = generateStrongPassword();
                      setChangeNewPass(pass);
                      setChangeConfirmPass(pass);
                      navigator.clipboard.writeText(pass);
                      setStatusMessage({ type: 'success', text: 'Generated strong password copied to clipboard!' });
                    }}
                    className="text-xs text-[#0070d2] hover:underline font-normal cursor-pointer"
                  >
                    Password Generator
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setChangingPassUser(null)}
                      className="px-3.5 py-1.5 border border-[#ced4da] rounded text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer shadow-2xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading || !changeNewPass}
                      className="px-4 py-1.5 bg-[#0070d2] hover:bg-[#005fb2] text-white rounded text-xs font-medium shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading ? 'Updating...' : 'Change Password'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
