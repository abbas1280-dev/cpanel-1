import React, { useState, useEffect, useMemo, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Folder,
  FolderPlus,
  FilePlus,
  Copy,
  Move,
  Clipboard,
  Upload,
  Download,
  Trash2,
  RotateCcw,
  Edit,
  Code,
  Key,
  Eye,
  EyeOff,
  Archive,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  CheckSquare,
  Square,
  Search,
  Settings,
  Home,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileCode,
  Globe,
  Mail,
  Share2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Lock,
  Terminal,
  Layers,
  FileArchive,
  Link as LinkIcon,
  HelpCircle,
  Scissors,
  ShieldCheck
} from 'lucide-react';
import { ServiceItem, ServerMetrics } from '../types';

interface FileManagerViewProps {
  currentService?: ServiceItem;
  allServices: ServiceItem[];
  serverMetrics?: ServerMetrics | null;
  onExit: () => void;
  initialPath?: string;
}

interface FileItem {
  name: string;
  path: string;
  isDir: boolean;
  sizeBytes: number;
  size: string;
  lastModified: string;
  type: string;
  permissions: string;
  isSymlink: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
}

export const FileManagerView: React.FC<FileManagerViewProps> = ({
  currentService,
  allServices,
  serverMetrics,
  onExit,
  initialPath
}) => {
  // Active Domain for file management
  const [activeDomain, setActiveDomain] = useState<string>(
    currentService?.domain || (allServices.length > 0 ? allServices[0].domain : 'turkyhub.com')
  );

  const domainUsername = activeDomain.split('.')[0].slice(0, 7).toLowerCase() + '1';

  // Navigation State
  const [currentPath, setCurrentPath] = useState<string>(initialPath || '/');
  const [pathInput, setPathInput] = useState<string>(initialPath || '/');
  const [history, setHistory] = useState<string[]>([initialPath || '/']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  useEffect(() => {
    if (initialPath) {
      setCurrentPath(initialPath);
      setPathInput(initialPath);
      setHistory([initialPath]);
      setHistoryIndex(0);
    }
  }, [initialPath]);

  // Files & Tree State
  const [items, setItems] = useState<FileItem[]>([]);
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [expandedTreeNodes, setExpandedTreeNodes] = useState<Set<string>>(new Set(['/', '/public_html']));
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search & Filter
  const [searchFilter, setSearchFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Settings (Hidden files hidden by default like real cPanel, toggleable in Settings or top bar)
  const [showHiddenFiles, setShowHiddenFiles] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('cpanel_show_hidden_files');
      return saved !== null ? saved === 'true' : false;
    } catch {
      return false;
    }
  });
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  const handleToggleHiddenFiles = (show: boolean) => {
    setShowHiddenFiles(show);
    try {
      localStorage.setItem('cpanel_show_hidden_files', String(show));
    } catch {}
  };

  // Modals
  const [activeModal, setActiveModal] = useState<
    | 'new_file'
    | 'new_folder'
    | 'edit'
    | 'permissions'
    | 'rename'
    | 'delete'
    | 'compress'
    | 'extract'
    | 'upload'
    | 'view'
    | 'copy'
    | 'move'
    | 'restore_confirm'
    | null
  >(null);

  // Modal form states
  const [modalInputName, setModalInputName] = useState<string>('');
  const [modalInputContent, setModalInputContent] = useState<string>('');
  const [modalSelectedPerms, setModalSelectedPerms] = useState<string>('0644');
  const [modalSkipTrash, setModalSkipTrash] = useState<boolean>(false);
  const [modalUploadFile, setModalUploadFile] = useState<File | null>(null);
  const [modalArchiveName, setModalArchiveName] = useState<string>('');
  const [modalArchiveFormat, setModalArchiveFormat] = useState<'zip' | 'tar.gz' | 'tar'>('zip');
  const [modalExtractDest, setModalExtractDest] = useState<string>('/');
  const [modalCopyMoveDest, setModalCopyMoveDest] = useState<string>('/');
  const [viewingFileMeta, setViewingFileMeta] = useState<{ filename: string; size: string; modified: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Clipboard State (for Cut / Copy / Paste)
  const [clipboard, setClipboard] = useState<{
    action: 'copy' | 'move';
    sourceDir: string;
    items: string[];
  } | null>(null);

  // Editor language detection & override
  const [editorLanguage, setEditorLanguage] = useState<string>('plaintext');

  const detectLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
      case 'php':
      case 'phtml':
        return 'php';
      case 'html':
      case 'htm':
        return 'html';
      case 'css':
      case 'scss':
      case 'less':
        return 'css';
      case 'js':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'json':
        return 'json';
      case 'sql':
        return 'sql';
      case 'xml':
      case 'svg':
        return 'xml';
      case 'sh':
      case 'bash':
        return 'shell';
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'md':
      case 'markdown':
        return 'markdown';
      case 'py':
        return 'python';
      case 'htaccess':
      case 'env':
      case 'ini':
      case 'conf':
        return 'ini';
      default:
        return 'plaintext';
    }
  };

  // Right-Click Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    item: FileItem | null;
  }>({ visible: false, x: 0, y: 0, item: null });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Dismiss context menu on click or Escape
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };

    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu.visible]);

  // 1. Fetch directory items with live cache busting
  const fetchDirectory = async (pathTarget: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/filemanager/list?domain=${encodeURIComponent(activeDomain)}&path=${encodeURIComponent(pathTarget)}&_t=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setSelectedItems(new Set());
        setLastSelectedIndex(null);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to list directory contents.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error fetching directory.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Fetch folder tree with live cache busting
  const fetchTree = async () => {
    try {
      const res = await fetch(
        `/api/filemanager/tree?domain=${encodeURIComponent(activeDomain)}&_t=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        setTreeData(data);
      }
    } catch (e) {
      console.error('Failed to fetch tree hierarchy', e);
    }
  };

  // Dedicated live reload handler with user feedback
  const handleReload = async () => {
    showToast('Refreshing live directory from server...');
    await Promise.all([fetchDirectory(currentPath), fetchTree()]);
    showToast('Directory reloaded from live filesystem.');
  };

  // Breadcrumbs generator
  const breadcrumbs = useMemo(() => {
    const clean = currentPath.replace(/^\/+/, '');
    if (!clean) return [{ name: 'Home', path: '/' }];
    const parts = clean.split('/').filter(Boolean);
    const crumbs: { name: string; path: string }[] = [{ name: 'Home', path: '/' }];
    let accum = '';
    for (const part of parts) {
      accum += `/${part}`;
      crumbs.push({ name: part, path: accum });
    }
    return crumbs;
  }, [currentPath]);

  useEffect(() => {
    fetchDirectory(currentPath);
    fetchTree();
  }, [activeDomain, currentPath]);

  // Navigate to specific folder
  const navigateTo = (targetPath: string) => {
    let clean = targetPath.trim();
    if (!clean.startsWith('/')) clean = '/' + clean;
    if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1);

    if (clean !== currentPath) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(clean);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setCurrentPath(clean);
      setPathInput(clean);
    }
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      const prevPath = history[newIdx];
      setCurrentPath(prevPath);
      setPathInput(prevPath);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      const nextPath = history[newIdx];
      setCurrentPath(nextPath);
      setPathInput(nextPath);
    }
  };

  const handleUpOneLevel = () => {
    if (currentPath === '/' || currentPath === '') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const parent = parts.length === 0 ? '/' : `/${parts.join('/')}`;
    navigateTo(parent);
  };

  // Selection handlers with Shift and Ctrl support
  const handleItemClick = (name: string, index: number, e: React.MouseEvent) => {
    setContextMenu(prev => ({ ...prev, visible: false }));

    if (e.shiftKey && lastSelectedIndex !== null) {
      // Range selection
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const range = new Set(selectedItems);
      for (let i = start; i <= end; i++) {
        if (filteredItems[i]) range.add(filteredItems[i].name);
      }
      setSelectedItems(range);
    } else if (e.ctrlKey || e.metaKey) {
      // Individual toggle
      const next = new Set(selectedItems);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      setSelectedItems(next);
      setLastSelectedIndex(index);
    } else {
      // Single selection
      setSelectedItems(new Set([name]));
      setLastSelectedIndex(index);
    }
  };

  // Right-Click Context Menu Trigger
  const handleContextMenu = (e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    e.stopPropagation();

    // If item is not in selected set, select only it
    if (!selectedItems.has(item.name)) {
      setSelectedItems(new Set([item.name]));
      const idx = filteredItems.findIndex(i => i.name === item.name);
      setLastSelectedIndex(idx !== -1 ? idx : null);
    }

    const menuWidth = 220;
    const menuHeight = 360;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    setContextMenu({
      visible: true,
      x: Math.max(10, x),
      y: Math.max(10, y),
      item
    });
  };

  // Right-Click Context Menu for Table Background / Empty Space
  const handleEmptySpaceContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 220;
    const menuHeight = 280;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    setContextMenu({
      visible: true,
      x: Math.max(10, x),
      y: Math.max(10, y),
      item: null
    });
  };

  // Copy/Cut to Clipboard
  const handleCopyClipboard = (itemsToCopy?: string[], isCut: boolean = false) => {
    const list = itemsToCopy && itemsToCopy.length > 0 
      ? itemsToCopy 
      : Array.from(selectedItems);
    if (list.length === 0) return;
    setClipboard({
      action: isCut ? 'move' : 'copy',
      sourceDir: currentPath,
      items: list
    });
    showToast(`${isCut ? 'Cut' : 'Copied'} ${list.length} item(s). Navigate to destination and click Paste.`);
  };

  // Paste from Clipboard
  const handlePasteClipboard = async () => {
    if (!clipboard || clipboard.items.length === 0) return;
    const isSameDir = clipboard.sourceDir === currentPath;
    if (isSameDir && clipboard.action === 'move') {
      showToast('Source and destination directories are the same.', 'error');
      return;
    }

    showToast(`${clipboard.action === 'move' ? 'Moving' : 'Copying'} ${clipboard.items.length} item(s)...`);
    try {
      const endpoint = clipboard.action === 'move' ? '/api/filemanager/move' : '/api/filemanager/copy';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          sourcePath: clipboard.sourceDir,
          destPath: currentPath,
          items: clipboard.items
        })
      });
      if (res.ok) {
        showToast(`${clipboard.items.length} item(s) ${clipboard.action === 'move' ? 'moved' : 'copied'} successfully.`);
        if (clipboard.action === 'move') {
          setClipboard(null);
        }
        await Promise.all([fetchDirectory(currentPath), fetchTree()]);
      } else {
        const err = await res.json();
        showToast(err.error || `Failed to ${clipboard.action} items.`, 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error executing paste.', 'error');
    }
  };

  const handleItemDoubleClick = (item: FileItem) => {
    if (item.isDir) {
      const target = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
      navigateTo(target);
    } else {
      handleOpenEditor(item.name, false);
    }
  };

  const handleSelectAll = () => {
    setSelectedItems(new Set(filteredItems.map(i => i.name)));
  };

  const handleUnselectAll = () => {
    setSelectedItems(new Set());
    setLastSelectedIndex(null);
  };

  // Tree node toggle
  const toggleTreeNode = (nodePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedTreeNodes);
    if (next.has(nodePath)) next.delete(nodePath);
    else next.add(nodePath);
    setExpandedTreeNodes(next);
  };

  // Toolbar Action Handlers
  const singleSelected = selectedItems.size === 1 ? Array.from(selectedItems)[0] : null;
  const selectedItemObj = singleSelected ? items.find(i => i.name === singleSelected) : null;

  // Create File Submit
  const handleCreateFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalInputName.trim()) return;

    try {
      const res = await fetch('/api/filemanager/create-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          path: currentPath,
          filename: modalInputName.trim(),
          content: ''
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`File "${modalInputName}" created successfully.`);
        setActiveModal(null);
        setModalInputName('');
        fetchDirectory(currentPath);
        fetchTree();
      } else {
        showToast(data.error || 'Failed to create file.', 'error');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Create Folder Submit
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalInputName.trim()) return;

    try {
      const res = await fetch('/api/filemanager/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          path: currentPath,
          folderName: modalInputName.trim(),
          foldername: modalInputName.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Folder "${modalInputName.trim()}" created successfully.`);
        setActiveModal(null);
        setModalInputName('');
        await fetchDirectory(currentPath);
        fetchTree();
      } else {
        showToast(data.error || 'Failed to create folder.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error creating folder.', 'error');
    }
  };

  // Open Editor
  const handleOpenEditor = async (filename: string, isViewOnly: boolean = false) => {
    try {
      const res = await fetch('/api/filemanager/read-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          path: currentPath,
          filename
        })
      });
      const data = await res.json();
      if (res.ok) {
        setModalInputName(filename);
        setModalInputContent(data.content || '');
        setEditorLanguage(detectLanguage(filename));
        setViewingFileMeta({
          filename,
          size: data.size || '0 bytes',
          modified: data.modified || ''
        });
        setActiveModal(isViewOnly ? 'view' : 'edit');
      } else {
        showToast(data.error || 'Cannot read file.', 'error');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Save Editor (Ctrl+S or Save Changes / Save & Close)
  const handleSaveEditor = async (closeAfterSave: boolean = false) => {
    try {
      const res = await fetch('/api/filemanager/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          path: currentPath,
          filename: modalInputName,
          content: modalInputContent
        })
      });
      if (res.ok) {
        showToast(`File "${modalInputName}" saved successfully.`);
        fetchDirectory(currentPath);
        if (closeAfterSave) {
          setActiveModal(null);
        }
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save file.', 'error');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Keyboard shortcut: Ctrl+S / Cmd+S to Auto-Save when Code Editor is open
  useEffect(() => {
    if (activeModal !== 'edit') return;
    const handleEditorKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        handleSaveEditor(false);
      }
    };
    window.addEventListener('keydown', handleEditorKeydown, true);
    return () => window.removeEventListener('keydown', handleEditorKeydown, true);
  }, [activeModal, modalInputName, modalInputContent, activeDomain, currentPath]);

  // Rename Submit
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleSelected || !modalInputName.trim()) return;

    try {
      const res = await fetch('/api/filemanager/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          path: currentPath,
          oldName: singleSelected,
          newName: modalInputName.trim()
        })
      });
      if (res.ok) {
        showToast(`Renamed to "${modalInputName}".`);
        setActiveModal(null);
        fetchDirectory(currentPath);
        fetchTree();
      } else {
        const err = await res.json();
        showToast(err.error || 'Rename failed.', 'error');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Delete Submit (Real-time and batch with accurate error handling)
  const handleDeleteSubmit = async () => {
    const toDelete = Array.from(selectedItems);
    if (toDelete.length === 0) return;

    try {
      const res = await fetch('/api/filemanager/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          path: currentPath,
          items: toDelete,
          skipTrash: modalSkipTrash || currentPath.startsWith('/.trash')
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Optimistically remove deleted items from UI immediately
        setItems(prev => prev.filter(i => !toDelete.includes(i.name)));
        setSelectedItems(new Set());
        setActiveModal(null);
        showToast(`Successfully deleted ${toDelete.length} item(s).`);
        await fetchDirectory(currentPath);
        fetchTree();
      } else {
        showToast(data.error || 'Deletion failed on server.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Deletion failed.', 'error');
    }
  };

  // Open Permissions
  const handleOpenPermissions = (item: FileItem) => {
    setModalInputName(item.name);
    setModalSelectedPerms(item.permissions || '0644');
    parseOctalToCheckboxes(item.permissions || '0644');
    setActiveModal('permissions');
  };

  // Permissions 3x3 Checkbox state
  const [permCheckboxes, setPermCheckboxes] = useState({
    uR: true, uW: true, uX: false,
    gR: true, gW: false, gX: false,
    wR: true, wW: false, wX: false
  });

  const parseOctalToCheckboxes = (octal: string) => {
    const clean = octal.replace(/^0+/, '').padStart(3, '0').slice(-3);
    const u = parseInt(clean[0] || '6', 8);
    const g = parseInt(clean[1] || '4', 8);
    const w = parseInt(clean[2] || '4', 8);

    setPermCheckboxes({
      uR: (u & 4) !== 0, uW: (u & 2) !== 0, uX: (u & 1) !== 0,
      gR: (g & 4) !== 0, gW: (g & 2) !== 0, gX: (g & 1) !== 0,
      wR: (w & 4) !== 0, wW: (w & 2) !== 0, wX: (w & 1) !== 0
    });
  };

  const getOctalFromCheckboxes = (cb = permCheckboxes) => {
    const u = (cb.uR ? 4 : 0) + (cb.uW ? 2 : 0) + (cb.uX ? 1 : 0);
    const g = (cb.gR ? 4 : 0) + (cb.gW ? 2 : 0) + (cb.gX ? 1 : 0);
    const w = (cb.wR ? 4 : 0) + (cb.wW ? 2 : 0) + (cb.wX ? 1 : 0);
    return `0${u}${g}${w}`;
  };

  const handleSavePermissions = async () => {
    try {
      const res = await fetch('/api/filemanager/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          path: currentPath,
          filename: modalInputName,
          permissions: modalSelectedPerms
        })
      });
      if (res.ok) {
        showToast(`Permissions updated to ${modalSelectedPerms}.`);
        setActiveModal(null);
        fetchDirectory(currentPath);
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Copy Files Submit
  const handleCopySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const toCopy = Array.from(selectedItems);
    if (toCopy.length === 0) return;
    try {
      const res = await fetch('/api/filemanager/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          sourcePath: currentPath,
          items: toCopy,
          destinationPath: modalCopyMoveDest
        })
      });
      if (res.ok) {
        showToast(`Copied ${toCopy.length} item(s) to "${modalCopyMoveDest}".`);
        setActiveModal(null);
        fetchDirectory(currentPath);
        fetchTree();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to copy items.', 'error');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Move Files Submit
  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const toMove = Array.from(selectedItems);
    if (toMove.length === 0) return;
    try {
      const res = await fetch('/api/filemanager/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          sourcePath: currentPath,
          items: toMove,
          destinationPath: modalCopyMoveDest
        })
      });
      if (res.ok) {
        showToast(`Moved ${toMove.length} item(s) to "${modalCopyMoveDest}".`);
        setActiveModal(null);
        fetchDirectory(currentPath);
        fetchTree();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to move items.', 'error');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Restore Default Public_html Structure Submit (Requirement #3, 5, 6, 7)
  const handleRestorePublicHtmlDefaults = async () => {
    try {
      const res = await fetch('/api/filemanager/restore-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: activeDomain, path: currentPath })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Default public_html structure restored successfully.');
        setActiveModal(null);
        await fetchDirectory(currentPath);
        fetchTree();
      } else {
        showToast(data.error || 'Failed to restore default structure.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error restoring defaults.', 'error');
    }
  };

  // Restore from Trash Submit (Requirement #8)
  const handleRestoreFromTrash = async () => {
    const toRestore = Array.from(selectedItems);
    if (toRestore.length === 0) {
      showToast('Please select item(s) in Trash to restore.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/filemanager/restore-trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: activeDomain, items: toRestore })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Restored ${toRestore.length} item(s) to public_html.`);
        setSelectedItems(new Set());
        await fetchDirectory(currentPath);
        fetchTree();
      } else {
        showToast(data.error || 'Failed to restore items from Trash.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error restoring from Trash.', 'error');
    }
  };

  // Empty Trash (Requirement #2, 8)
  const handleEmptyTrash = async () => {
    if (!window.confirm('Are you sure you want to permanently delete all items in Trash? This cannot be undone.')) {
      return;
    }
    try {
      const res = await fetch('/api/filemanager/empty-trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: activeDomain })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Trash emptied successfully.');
        setSelectedItems(new Set());
        await fetchDirectory(currentPath);
        fetchTree();
      } else {
        showToast(data.error || 'Failed to empty Trash.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error emptying Trash.', 'error');
    }
  };

  // Multi-item / Folder Download Archive Helper (Requirement #2, 12)
  const handleDownloadArchive = async (itemNames: string[]) => {
    if (itemNames.length === 0) return;
    try {
      showToast('Preparing download archive...');
      const archiveName = `download_${Date.now()}.zip`;
      const res = await fetch('/api/filemanager/compress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          path: currentPath,
          items: itemNames,
          archiveName,
          format: 'zip'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        handleDownload(data.archiveName);
        setTimeout(() => fetchDirectory(currentPath), 1500);
      } else {
        showToast(data.error || 'Failed to prepare download archive.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Download preparation failed.', 'error');
    }
  };

  // Unlimited Fast Streaming Upload Submit (Requirement #6)
  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalUploadFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();
    const targetUrl = `/api/filemanager/upload-stream?domain=${encodeURIComponent(activeDomain)}&path=${encodeURIComponent(currentPath)}&filename=${encodeURIComponent(modalUploadFile.name)}`;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(pct);
      }
    };

    xhr.onload = () => {
      setIsUploading(false);
      setUploadProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        showToast(`"${modalUploadFile.name}" uploaded successfully!`);
        setActiveModal(null);
        setModalUploadFile(null);
        fetchDirectory(currentPath);
      } else {
        showToast('Upload failed on server.', 'error');
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      setUploadProgress(null);
      showToast('Network error during file upload.', 'error');
    };

    xhr.open('POST', targetUrl, true);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.send(modalUploadFile);
  };

  // Download File
  const handleDownload = (filename: string) => {
    window.open(
      `/api/filemanager/download?domain=${encodeURIComponent(activeDomain)}&path=${encodeURIComponent(currentPath)}&file=${encodeURIComponent(filename)}`,
      '_blank'
    );
  };

  // Compress Submit with multiple format choices (Requirement #5)
  const handleCompressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const toZip = Array.from(selectedItems);
    if (toZip.length === 0 || !modalArchiveName.trim()) return;

    try {
      const res = await fetch('/api/filemanager/compress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          path: currentPath,
          items: toZip,
          archiveName: modalArchiveName.trim(),
          format: modalArchiveFormat
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Archive "${data.archiveName}" created.`);
        setActiveModal(null);
        setModalArchiveName('');
        fetchDirectory(currentPath);
      } else {
        showToast(data.error || 'Failed to compress items.', 'error');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Extract Submit
  const handleExtractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleSelected) return;
    try {
      const res = await fetch('/api/filemanager/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          path: currentPath,
          archiveName: singleSelected,
          destination: modalExtractDest
        })
      });
      if (res.ok) {
        showToast(`Extracted to "${modalExtractDest}".`);
        setActiveModal(null);
        fetchDirectory(currentPath);
        fetchTree();
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Filter items based on search and hidden files
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (!showHiddenFiles && item.name.startsWith('.')) return false;
      if (searchQuery.trim()) {
        return item.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [items, showHiddenFiles, searchQuery]);

  // Tree recursive renderer
  const renderTree = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedTreeNodes.has(node.path);
    const hasChildren = node.children && node.children.length > 0;
    const isCurrent = currentPath === node.path;

    return (
      <div key={node.path} className="select-none text-[11px] font-sans">
        <div
          onClick={() => navigateTo(node.path)}
          onContextMenu={(e) => {
            handleContextMenu(e, {
              name: node.name,
              path: node.path,
              isDir: true,
              sizeBytes: 0,
              size: '4 KB',
              lastModified: '',
              type: 'httpd/unix-directory',
              permissions: '0755',
              isSymlink: false
            });
          }}
          className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors ${
            isCurrent ? 'bg-[#cce2f7] text-[#004b99] font-bold' : 'hover:bg-slate-100 text-slate-700'
          }`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
        >
          {hasChildren ? (
            <button
              onClick={e => toggleTreeNode(node.path, e)}
              className="w-3.5 h-3.5 flex items-center justify-center text-slate-500 hover:text-slate-800 font-mono font-bold"
            >
              {isExpanded ? '−' : '+'}
            </button>
          ) : (
            <span className="w-3.5 inline-block" />
          )}

          {/* Folder Icon */}
          {node.name === 'public_html' || node.name === 'www' ? (
            <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          ) : node.name === 'mail' ? (
            <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          ) : node.name === 'public_ftp' ? (
            <Share2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          )}

          <span className="truncate">{node.name}</span>
        </div>

        {isExpanded && hasChildren && (
          <div>
            {node.children.map(child => renderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderItemIcon = (item: FileItem) => {
    if (item.isDir) {
      if (item.name === 'public_html') return <Globe className="w-4 h-4 text-blue-500" />;
      if (item.name === 'mail') return <Mail className="w-4 h-4 text-blue-600" />;
      if (item.name === 'public_ftp') return <Share2 className="w-4 h-4 text-emerald-600" />;
      return <Folder className="w-4 h-4 text-amber-500" />;
    }

    const ext = item.name.split('.').pop()?.toLowerCase();
    if (ext === 'html' || ext === 'htm') return <FileCode className="w-4 h-4 text-orange-500" />;
    if (ext === 'php') return <FileCode className="w-4 h-4 text-indigo-500" />;
    if (ext === 'css') return <FileCode className="w-4 h-4 text-sky-500" />;
    if (ext === 'js' || ext === 'json') return <FileCode className="w-4 h-4 text-amber-500" />;
    if (ext === 'zip' || ext === 'tar' || ext === 'gz' || ext === 'rar') return <FileArchive className="w-4 h-4 text-rose-500" />;
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="min-h-screen bg-[#f7f9fa] text-slate-800 flex flex-col font-sans select-none">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER (CLICKING LOGO RETURNS TO CPANEL DASHBOARD - REQUIREMENT #2) */}
      {/* ========================================================================= */}
      <header className="bg-[#1f2837] text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-700 shadow-sm">
        {/* Left: cPanel Logo + File Manager Title + Dynamic Breadcrumbs */}
        <div className="flex items-center gap-3">
          <div
            onClick={onExit}
            className="flex items-center gap-2.5 cursor-pointer group"
            title="Click to return to cPanel Main Dashboard"
          >
            <div className="w-7 h-7 rounded bg-[#ff6c2c] text-white flex items-center justify-center font-black text-xs shadow-sm group-hover:scale-105 transition-transform">
              cP
            </div>
            <span className="text-base font-bold tracking-tight group-hover:text-orange-400 transition-colors hidden sm:inline">
              File Manager
            </span>
          </div>

          <div className="h-5 w-px bg-slate-700 hidden md:block" />

          {/* Dynamic Clickable Breadcrumbs right alongside logo */}
          <div className="flex items-center gap-1 font-mono text-xs overflow-x-auto max-w-[220px] lg:max-w-md">
            <span className="text-slate-400 font-sans font-medium text-[11px] hidden xl:inline">/home/{domainUsername}</span>
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.path}>
                  <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                  {isLast ? (
                    <span className="font-bold text-orange-400 truncate max-w-[120px]">
                      {crumb.name}
                    </span>
                  ) : (
                    <button
                      onClick={() => navigateTo(crumb.path)}
                      className="text-slate-300 hover:text-white hover:underline truncate max-w-[90px]"
                      title={`Go to ${crumb.path}`}
                    >
                      {crumb.name}
                    </button>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Center: Search Tool */}
        <div className="flex items-center gap-2 max-w-xl flex-1 justify-center px-4">
          <span className="text-xs text-slate-300 font-medium hidden md:inline">Search</span>
          <select
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="bg-white text-slate-800 text-xs px-2 py-1 rounded border border-slate-300 focus:outline-none hidden sm:block"
          >
            <option value="all">All Your Files</option>
            <option value="public_html">only public_html</option>
            <option value="current">Current Directory</option>
          </select>
          <span className="text-xs text-slate-300 font-medium hidden md:inline">for</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (searchFilter === 'public_html' && !currentPath.startsWith('/public_html')) {
                  navigateTo('/public_html');
                } else if (searchFilter === 'all' && currentPath !== '/') {
                  navigateTo('/');
                }
              }
            }}
            placeholder=""
            className="w-36 sm:w-52 bg-white text-slate-800 px-2 py-1 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          />
          <button
            onClick={() => {
              if (searchFilter === 'public_html' && !currentPath.startsWith('/public_html')) {
                navigateTo('/public_html');
              } else if (searchFilter === 'all' && currentPath !== '/') {
                navigateTo('/');
              }
            }}
            className="bg-[#0070d2] hover:bg-[#005fb2] text-white px-3 py-1 rounded text-xs font-semibold shadow-sm transition-colors"
          >
            Go
          </button>
        </div>

        {/* Right: Domain Selector, Settings & Exit button */}
        <div className="flex items-center gap-2">
          <select
            value={activeDomain}
            onChange={e => {
              setActiveDomain(e.target.value);
              setCurrentPath('/');
            }}
            className="bg-slate-800 text-slate-200 border border-slate-600 rounded text-xs px-2 py-1 focus:outline-none font-semibold cursor-pointer"
          >
            {allServices.map(s => (
              <option key={s.id} value={s.domain}>
                {s.domain}
              </option>
            ))}
          </select>

          {/* Quick Toggle for Hidden Dotfiles (.htaccess, etc) */}
          <button
            onClick={() => handleToggleHiddenFiles(!showHiddenFiles)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
              showHiddenFiles
                ? 'bg-blue-600/30 text-blue-300 border-blue-500/50 hover:bg-blue-600/40'
                : 'bg-white/10 text-slate-300 border-white/10 hover:bg-white/20'
            }`}
            title={showHiddenFiles ? 'Hidden files (.htaccess) are visible. Click to hide.' : 'Hidden files (.htaccess) are hidden. Click to show.'}
          >
            {showHiddenFiles ? <Eye className="w-3.5 h-3.5 text-blue-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden md:inline">{showHiddenFiles ? 'Dotfiles: Shown' : 'Dotfiles: Hidden'}</span>
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded text-xs font-medium transition-colors border border-white/10"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          <button
            onClick={onExit}
            className="flex items-center gap-1 bg-[#ff6c2c] hover:bg-[#e05b20] text-white px-2.5 py-1 rounded text-xs font-bold transition-colors shadow-sm ml-1"
            title="Return to cPanel Dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">cPanel</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. ACTION TOOLBAR */}
      {/* ========================================================================= */}
      <div className="bg-[#eceef1] border-b border-slate-300 px-3 py-1.5 flex items-center gap-1 overflow-x-auto text-slate-700 text-xs shadow-inner">
        {/* + File */}
        <button
          onClick={() => {
            setModalInputName('');
            setModalInputContent('');
            setActiveModal('new_file');
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-slate-200 text-slate-800 font-medium transition-colors"
        >
          <FilePlus className="w-3.5 h-3.5 text-blue-600" />
          <span>File</span>
        </button>

        {/* + Folder */}
        <button
          onClick={() => {
            setModalInputName('');
            setActiveModal('new_folder');
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-slate-200 text-slate-800 font-medium transition-colors"
        >
          <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
          <span>Folder</span>
        </button>

        {/* Vertical divider */}
        <div className="w-px h-5 bg-slate-300 mx-1" />

        {/* Copy */}
        <button
          disabled={selectedItems.size === 0}
          onClick={() => {
            setModalCopyMoveDest(currentPath);
            setActiveModal('copy');
          }}
          className={`flex items-center gap-1 px-2 py-1.5 rounded font-medium ${
            selectedItems.size > 0 ? 'hover:bg-slate-200 text-slate-800' : 'text-slate-400 cursor-not-allowed'
          }`}
          title="Copy selected items to a destination path"
        >
          <Copy className="w-3.5 h-3.5 text-slate-600" />
          <span>Copy</span>
        </button>

        {/* Move */}
        <button
          disabled={selectedItems.size === 0}
          onClick={() => {
            setModalCopyMoveDest(currentPath);
            setActiveModal('move');
          }}
          className={`flex items-center gap-1 px-2 py-1.5 rounded font-medium ${
            selectedItems.size > 0 ? 'hover:bg-slate-200 text-slate-800' : 'text-slate-400 cursor-not-allowed'
          }`}
          title="Move selected items to a destination path"
        >
          <Move className="w-3.5 h-3.5 text-slate-600" />
          <span>Move</span>
        </button>

        {/* Paste from Clipboard */}
        <button
          disabled={!clipboard || clipboard.items.length === 0}
          onClick={handlePasteClipboard}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded font-medium transition-colors ${
            clipboard && clipboard.items.length > 0
              ? 'hover:bg-emerald-100 text-emerald-800 font-bold bg-emerald-50 border border-emerald-300 shadow-2xs'
              : 'text-slate-400 cursor-not-allowed'
          }`}
          title={clipboard ? `Paste ${clipboard.items.length} item(s) from clipboard into current folder` : 'Clipboard is empty'}
        >
          <Clipboard className="w-3.5 h-3.5 text-emerald-600" />
          <span>Paste{clipboard && clipboard.items.length > 0 ? ` (${clipboard.items.length})` : ''}</span>
        </button>

        {/* Upload */}
        <button
          onClick={() => {
            setModalUploadFile(null);
            setUploadProgress(null);
            setActiveModal('upload');
          }}
          className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-slate-200 text-slate-800 font-medium"
        >
          <Upload className="w-3.5 h-3.5 text-emerald-600" />
          <span>Upload</span>
        </button>

        {/* Download */}
        <button
          disabled={selectedItems.size === 0}
          onClick={() => {
            if (selectedItems.size === 1 && selectedItemObj && !selectedItemObj.isDir) {
              handleDownload(singleSelected!);
            } else if (selectedItems.size > 0) {
              handleDownloadArchive(Array.from(selectedItems));
            }
          }}
          className={`flex items-center gap-1 px-2 py-1.5 rounded font-medium ${
            selectedItems.size > 0 ? 'hover:bg-slate-200 text-slate-800 font-bold' : 'text-slate-400 cursor-not-allowed'
          }`}
          title={selectedItems.size > 1 || (selectedItemObj && selectedItemObj.isDir) ? 'Download selected as .zip archive' : 'Download selected file'}
        >
          <Download className="w-3.5 h-3.5 text-indigo-600" />
          <span>Download</span>
        </button>

        {/* Delete */}
        <button
          disabled={selectedItems.size === 0}
          onClick={() => {
            setModalSkipTrash(false);
            setActiveModal('delete');
          }}
          className={`flex items-center gap-1 px-2 py-1.5 rounded font-medium ${
            selectedItems.size > 0 ? 'hover:bg-rose-100 text-rose-700 font-bold' : 'text-slate-400 cursor-not-allowed'
          }`}
        >
          <X className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>

        {/* Restore from Trash (Visible ONLY inside Trash) */}
        {currentPath.startsWith('/.trash') && (
          <button
            disabled={selectedItems.size === 0}
            onClick={handleRestoreFromTrash}
            className={`flex items-center gap-1 px-2 py-1.5 rounded font-medium ${
              selectedItems.size > 0 ? 'hover:bg-emerald-100 text-emerald-800 font-bold' : 'text-slate-400 cursor-not-allowed'
            }`}
            title="Restore selected items from Trash back to public_html"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
            <span>Restore from Trash</span>
          </button>
        )}

        {/* Vertical divider */}
        <div className="w-px h-5 bg-slate-300 mx-1" />

        {/* Rename */}
        <button
          disabled={!singleSelected}
          onClick={() => {
            if (singleSelected) {
              setModalInputName(singleSelected);
              setActiveModal('rename');
            }
          }}
          className={`flex items-center gap-1 px-2 py-1.5 rounded font-medium ${
            singleSelected ? 'hover:bg-slate-200 text-slate-800' : 'text-slate-400 cursor-not-allowed'
          }`}
        >
          <Edit className="w-3.5 h-3.5 text-sky-600" />
          <span>Rename</span>
        </button>

        {/* Edit */}
        <button
          disabled={!selectedItemObj || selectedItemObj.isDir}
          onClick={() => singleSelected && handleOpenEditor(singleSelected, false)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded font-medium ${
            selectedItemObj && !selectedItemObj.isDir ? 'hover:bg-slate-200 text-slate-800' : 'text-slate-400 cursor-not-allowed'
          }`}
        >
          <Code className="w-3.5 h-3.5 text-blue-600" />
          <span>Edit</span>
        </button>

        {/* HTML Editor */}
        <button
          disabled={!selectedItemObj || selectedItemObj.isDir}
          onClick={() => singleSelected && handleOpenEditor(singleSelected, false)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded font-medium ${
            selectedItemObj && !selectedItemObj.isDir ? 'hover:bg-slate-200 text-slate-800' : 'text-slate-400 cursor-not-allowed'
          }`}
        >
          <Edit className="w-3.5 h-3.5 text-amber-600" />
          <span>HTML Editor</span>
        </button>

        {/* Permissions */}
        <button
          disabled={!selectedItemObj}
          onClick={() => selectedItemObj && handleOpenPermissions(selectedItemObj)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded font-medium ${
            selectedItemObj ? 'hover:bg-slate-200 text-slate-800' : 'text-slate-400 cursor-not-allowed'
          }`}
        >
          <Key className="w-3.5 h-3.5 text-emerald-600" />
          <span>Permissions</span>
        </button>

        {/* View */}
        <button
          disabled={!selectedItemObj || selectedItemObj.isDir}
          onClick={() => singleSelected && handleOpenEditor(singleSelected, true)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded font-medium ${
            selectedItemObj && !selectedItemObj.isDir ? 'hover:bg-slate-200 text-slate-800' : 'text-slate-400 cursor-not-allowed'
          }`}
        >
          <Eye className="w-3.5 h-3.5 text-teal-600" />
          <span>View</span>
        </button>

        {/* Extract */}
        <button
          disabled={
            !selectedItemObj ||
            selectedItemObj.isDir ||
            !(
              selectedItemObj.name.endsWith('.zip') ||
              selectedItemObj.name.endsWith('.tar') ||
              selectedItemObj.name.endsWith('.gz') ||
              selectedItemObj.name.endsWith('.rar')
            )
          }
          onClick={() => {
            setModalExtractDest(currentPath);
            setActiveModal('extract');
          }}
          className={`flex items-center gap-1 px-2 py-1.5 rounded font-medium ${
            selectedItemObj &&
            !selectedItemObj.isDir &&
            (selectedItemObj.name.endsWith('.zip') ||
              selectedItemObj.name.endsWith('.tar') ||
              selectedItemObj.name.endsWith('.gz') ||
              selectedItemObj.name.endsWith('.rar'))
              ? 'hover:bg-slate-200 text-slate-800 font-bold'
              : 'text-slate-400 cursor-not-allowed'
          }`}
        >
          <Archive className="w-3.5 h-3.5 text-purple-600" />
          <span>Extract</span>
        </button>

        {/* Compress */}
        <button
          disabled={selectedItems.size === 0}
          onClick={() => {
            const first = Array.from(selectedItems)[0];
            setModalArchiveName(first ? `${first}.zip` : 'archive.zip');
            setModalArchiveFormat('zip');
            setActiveModal('compress');
          }}
          className={`flex items-center gap-1 px-2 py-1.5 rounded font-medium ${
            selectedItems.size > 0 ? 'hover:bg-slate-200 text-slate-800 font-bold' : 'text-slate-400 cursor-not-allowed'
          }`}
        >
          <Archive className="w-3.5 h-3.5 text-orange-600" />
          <span>Compress</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. NAVIGATION RIBBON & BREADCRUMBS */}
      {/* ========================================================================= */}
      <div className="bg-[#f2f4f7] border-b border-slate-300 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left: Navigation Buttons & Quick Links */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Home button */}
          <button
            onClick={() => navigateTo('/')}
            className={`p-1.5 rounded hover:bg-slate-200 text-slate-700 flex items-center gap-1 ${
              currentPath === '/' ? 'bg-slate-200 text-blue-700 font-bold' : ''
            }`}
            title="Home Directory (/)"
          >
            <Home className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline font-semibold">Home</span>
          </button>

          {/* public_html shortcut button */}
          <button
            onClick={() => navigateTo('/public_html')}
            className={`p-1.5 rounded hover:bg-slate-200 text-slate-700 flex items-center gap-1 ${
              currentPath === '/public_html' || currentPath.startsWith('/public_html/') ? 'bg-blue-50 text-blue-700 font-bold' : ''
            }`}
            title="Jump to public_html (Web Document Root)"
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline font-semibold">public_html</span>
          </button>

          <div className="w-px h-4 bg-slate-300 mx-0.5" />

          {/* Up One Level */}
          <button
            onClick={handleUpOneLevel}
            disabled={currentPath === '/' || currentPath === ''}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 disabled:text-slate-300 disabled:hover:bg-transparent"
            title="Up One Level"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          {/* Back */}
          <button
            onClick={handleBack}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 disabled:text-slate-300 disabled:hover:bg-transparent"
            title="Back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          {/* Forward */}
          <button
            onClick={handleForward}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 disabled:text-slate-300 disabled:hover:bg-transparent"
            title="Forward"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-slate-300 mx-0.5" />

          {/* Interactive Clickable Breadcrumb Bar */}
          <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded border border-slate-300 font-mono text-xs overflow-x-auto max-w-md shadow-2xs">
            <span className="text-slate-400 font-sans font-medium text-[11px]">/home/{domainUsername}</span>
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.path}>
                  <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                  {isLast ? (
                    <span className="font-bold text-blue-700 truncate max-w-[120px]">
                      {crumb.name}
                    </span>
                  ) : (
                    <button
                      onClick={() => navigateTo(crumb.path)}
                      className="text-slate-600 hover:text-blue-600 hover:underline truncate max-w-[100px]"
                      title={`Go to ${crumb.path}`}
                    >
                      {crumb.name}
                    </button>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Path Input Box with Go button */}
          <div className="hidden lg:flex items-center gap-1 ml-1">
            <input
              type="text"
              value={pathInput}
              onChange={e => setPathInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') navigateTo(pathInput);
              }}
              placeholder="e.g. /public_html"
              className="w-36 xl:w-48 bg-white px-2 py-1 rounded border border-slate-300 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => navigateTo(pathInput)}
              className="bg-[#0070d2] hover:bg-[#005fb2] text-white px-2.5 py-1 rounded text-xs font-semibold shadow-sm transition-colors"
            >
              Go
            </button>
          </div>
        </div>

        {/* Right Selection & Actions (With Single Reload Button - Requirement #4 & #5) */}
        <div className="flex items-center gap-2">
          {/* Select All */}
          <button
            onClick={handleSelectAll}
            className="px-2 py-1 rounded hover:bg-slate-200 text-slate-700 font-medium flex items-center gap-1"
          >
            <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
            <span>Select All</span>
          </button>

          {/* Unselect All */}
          <button
            onClick={handleUnselectAll}
            className="px-2 py-1 rounded hover:bg-slate-200 text-slate-700 font-medium flex items-center gap-1"
          >
            <Square className="w-3.5 h-3.5 text-slate-400" />
            <span>Unselect All</span>
          </button>

          {/* Dedicated Live Reload Button */}
          <button
            onClick={handleReload}
            disabled={isLoading}
            className="px-2.5 py-1 rounded bg-white hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1.5 border border-slate-300 shadow-2xs transition-colors"
            title="Reload current directory and filesystem tree from server"
          >
            <RotateCw className={`w-3.5 h-3.5 text-blue-600 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>

          {/* Restore Default (Always visible on ribbon) */}
          <button
            onClick={() => setActiveModal('restore_confirm')}
            className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold flex items-center gap-1 border border-emerald-300 shadow-2xs transition-colors cursor-pointer"
            title="Recreate missing default hosting directories (public_html, ssl, logs, mail, tmp, etc.) and .htaccess"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
            <span>Restore Default</span>
          </button>

          {/* View Trash or Empty Trash */}
          {currentPath.startsWith('/.trash') ? (
            <button
              onClick={handleEmptyTrash}
              className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold flex items-center gap-1 border border-rose-300"
              title="Permanently empty all items in Trash"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Empty Trash</span>
            </button>
          ) : (
            <button
              onClick={() => navigateTo('/.trash')}
              className="px-2 py-1 rounded hover:bg-slate-200 text-slate-700 font-medium flex items-center gap-1"
              title="View Trash"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-600" />
              <span>View Trash</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MAIN DUAL-PANE VIEW: LEFT DIRECTORY TREE + RIGHT FILE TABLE */}
      {/* ========================================================================= */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar: Collapsible Directory Tree & cPanel Navigation */}
        <aside className="w-64 sm:w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto">
          {/* Top of Left Sidebar: cPanel Dashboard Return Button */}
          <div className="p-2.5 bg-[#f8fafc] border-b border-slate-200">
            <button
              onClick={onExit}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white hover:bg-orange-50 text-slate-800 hover:text-orange-600 border border-slate-200 hover:border-orange-300 font-bold text-xs shadow-xs transition-all group cursor-pointer"
              title="Click to return to cPanel Jupiter Dashboard"
            >
              <div className="w-7 h-7 rounded-lg bg-[#ff6c2c] text-white flex items-center justify-center font-black text-xs shadow-xs group-hover:scale-105 transition-transform shrink-0">
                cP
              </div>
              <div className="text-left flex-1 min-w-0">
                <span className="block text-xs font-bold leading-tight text-slate-800 group-hover:text-orange-600">cPanel</span>
                <span className="block text-[10px] text-slate-400 font-normal leading-tight group-hover:text-orange-500">
                  Main Dashboard
                </span>
              </div>
              <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-orange-500 group-hover:-translate-x-0.5 transition-transform shrink-0" />
            </button>
          </div>

          <div className="bg-[#f0f4f8] text-[#004b99] px-3 py-2 font-bold text-xs border-b border-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-blue-600" />
              <span>Directories</span>
            </span>
            <button
              onClick={fetchTree}
              className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors"
              title="Refresh Directory Tree"
            >
              <RotateCw className="w-3 h-3" />
            </button>
          </div>

          <div className="p-2 flex-1">
            {treeData ? (
              renderTree(treeData)
            ) : (
              <div className="p-4 text-center text-slate-400 text-xs">
                Loading directories...
              </div>
            )}
          </div>
        </aside>

        {/* Right Main Panel: File & Directory Explorer Table */}
        <main
          className="flex-1 bg-white flex flex-col overflow-hidden"
          onClick={() => setContextMenu(prev => ({ ...prev, visible: false }))}
        >
          {errorMsg && (
            <div className="m-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex-1 overflow-auto" onContextMenu={handleEmptySpaceContextMenu}>
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead className="bg-[#f0f4f8] text-[#004b99] sticky top-0 z-10 border-b border-slate-200 select-none">
                <tr>
                  <th className="py-2.5 px-3 font-semibold w-8 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={filteredItems.length > 0 && selectedItems.size === filteredItems.length}
                      onChange={e => {
                        if (e.target.checked) handleSelectAll();
                        else handleUnselectAll();
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3 font-semibold w-10"></th>
                  <th className="py-2.5 px-3 font-semibold">Name</th>
                  <th className="py-2.5 px-3 font-semibold text-right w-24">Size</th>
                  <th className="py-2.5 px-3 font-semibold w-48">Last Modified</th>
                  <th className="py-2.5 px-3 font-semibold w-40">Type</th>
                  <th className="py-2.5 px-3 font-semibold text-center w-24">Permissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 px-4 text-center font-medium text-xs">
                      {isLoading ? (
                        <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                          <RotateCw className="w-6 h-6 animate-spin text-blue-600" />
                          <span>Loading files from server...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 px-4 text-center max-w-md mx-auto">
                          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
                            <Folder className="w-7 h-7 text-slate-400" />
                          </div>
                          <h4 className="text-sm font-bold text-slate-800">This directory is empty</h4>
                          <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
                            {currentPath === '/' || currentPath === ''
                              ? 'No files or folders found in domain root. If you deleted all files, click "Restore Default Structure" below to recreate the standard cPanel folders (public_html, ssl, mail, logs, tmp, etc.) with default .htaccess.'
                              : 'No files or folders found here. You can upload new files, create files/folders, or restore the default structure.'}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setActiveModal('restore_confirm')}
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore Default Structure</span>
                            </button>
                            <button
                              onClick={() => {
                                setModalUploadFile(null);
                                setUploadProgress(null);
                                setActiveModal('upload');
                              }}
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Upload Files</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => {
                    const isSelected = selectedItems.has(item.name);

                    return (
                      <tr
                        key={item.name}
                        onClick={e => handleItemClick(item.name, index, e)}
                        onDoubleClick={() => handleItemDoubleClick(item)}
                        onContextMenu={e => handleContextMenu(e, item)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#d8eafc] text-[#003875] font-medium'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {/* Checkbox column */}
                        <td className="py-2 px-3 text-center shrink-0 w-8" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => {
                              const next = new Set(selectedItems);
                              if (e.target.checked) next.add(item.name);
                              else next.delete(item.name);
                              setSelectedItems(next);
                              setLastSelectedIndex(index);
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>

                        {/* Icon column */}
                        <td className="py-2 px-3 text-center shrink-0">
                          {renderItemIcon(item)}
                        </td>

                        {/* Name column */}
                        <td className="py-2 px-3 font-medium">
                          <span className="flex items-center gap-2">
                            <span className={item.isDir ? 'font-bold' : ''}>{item.name}</span>
                            {item.isSymlink && (
                              <span className="text-[10px] text-slate-400 font-mono">(symbolic link)</span>
                            )}
                          </span>
                        </td>

                        {/* Size column */}
                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                          {item.size}
                        </td>

                        {/* Last Modified */}
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                          {item.lastModified}
                        </td>

                        {/* Type column */}
                        <td className="py-2 px-3 text-slate-500 font-mono text-[11px] truncate max-w-[160px]">
                          {item.type}
                        </td>

                        {/* Permissions column */}
                        <td
                          onClick={e => {
                            e.stopPropagation();
                            handleOpenPermissions(item);
                          }}
                          className="py-2 px-3 text-center font-mono text-xs font-semibold text-blue-700 hover:underline"
                          title="Click to edit permissions"
                        >
                          {item.permissions}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Status Bar */}
          <div className="bg-[#f0f4f8] border-t border-slate-200 px-4 py-1.5 flex items-center justify-between text-xs text-slate-600 font-mono">
            <div>
              <span>Current Path: <strong>/home/{domainUsername}{currentPath}</strong></span>
              <span className="mx-2">•</span>
              <span>{filteredItems.length} items total</span>
              {selectedItems.size > 0 && (
                <>
                  <span className="mx-2">•</span>
                  <span className="font-bold text-blue-700">{selectedItems.size} selected</span>
                </>
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              Hold <strong>Ctrl</strong> to select multiple • <strong>Right-Click</strong> for actions
            </div>
          </div>
        </main>
      </div>

      {/* ========================================================================= */}
      {/* 5. RIGHT-CLICK CONTEXT MENU (REQUIREMENT #1) */}
      {/* ========================================================================= */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 text-xs text-slate-700 w-56 font-sans animate-in fade-in duration-100 select-none"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.item ? (
            // ==========================================
            // ITEM CONTEXT MENU (File, Folder, Archive)
            // ==========================================
            <>
              {/* Header showing item name */}
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 border-b border-slate-100 truncate flex items-center gap-1.5">
                {renderItemIcon(contextMenu.item)}
                <span className="truncate">{contextMenu.item.name}</span>
              </div>

              {/* ARCHIVE SPECIFIC: Extract at very top */}
              {(contextMenu.item.name.endsWith('.zip') ||
                contextMenu.item.name.endsWith('.tar') ||
                contextMenu.item.name.endsWith('.gz') ||
                contextMenu.item.name.endsWith('.rar')) && (
                <>
                  <button
                    onClick={() => {
                      setContextMenu(prev => ({ ...prev, visible: false }));
                      setModalExtractDest(currentPath);
                      setActiveModal('extract');
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2 font-bold text-purple-700"
                  >
                    <Archive className="w-3.5 h-3.5 text-purple-600" />
                    <span>Extract (Unzip)</span>
                  </button>
                  <div className="h-px bg-slate-100 my-1" />
                </>
              )}

              {/* FOLDER SPECIFIC: Open Folder */}
              {contextMenu.item.isDir && (
                <button
                  onClick={() => {
                    setContextMenu(prev => ({ ...prev, visible: false }));
                    const target = currentPath === '/' ? `/${contextMenu.item!.name}` : `${currentPath}/${contextMenu.item!.name}`;
                    navigateTo(target);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 font-bold"
                >
                  <Folder className="w-3.5 h-3.5 text-amber-500" />
                  <span>Open Folder</span>
                </button>
              )}

              {/* FILE SPECIFIC: Edit / View / Download */}
              {!contextMenu.item.isDir && (
                <>
                  <button
                    onClick={() => {
                      setContextMenu(prev => ({ ...prev, visible: false }));
                      handleOpenEditor(contextMenu.item!.name, false);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 font-medium"
                  >
                    <Code className="w-3.5 h-3.5 text-blue-600" />
                    <span>Edit / Code Editor</span>
                  </button>
                  <button
                    onClick={() => {
                      setContextMenu(prev => ({ ...prev, visible: false }));
                      handleOpenEditor(contextMenu.item!.name, true);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 font-medium"
                  >
                    <Eye className="w-3.5 h-3.5 text-teal-600" />
                    <span>View</span>
                  </button>
                  <button
                    onClick={() => {
                      setContextMenu(prev => ({ ...prev, visible: false }));
                      handleDownload(contextMenu.item!.name);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 font-medium"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Download</span>
                  </button>
                </>
              )}

              <div className="h-px bg-slate-100 my-1" />

              {/* Rename */}
              <button
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                  setModalInputName(contextMenu.item!.name);
                  setActiveModal('rename');
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2 font-medium"
              >
                <Edit className="w-3.5 h-3.5 text-sky-600" />
                <span>Rename</span>
              </button>

              {/* Change Permissions */}
              <button
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                  handleOpenPermissions(contextMenu.item!);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2 font-medium"
              >
                <Key className="w-3.5 h-3.5 text-emerald-600" />
                <span>Change Permissions ({contextMenu.item.permissions})</span>
              </button>

              <div className="h-px bg-slate-100 my-1" />

              {/* Copy Options */}
              <button
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                  handleCopyClipboard([contextMenu.item!.name], false);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2 font-medium"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy to Clipboard</span>
              </button>

              <button
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                  handleCopyClipboard([contextMenu.item!.name], true);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2 font-medium"
              >
                <Scissors className="w-3.5 h-3.5 text-slate-500" />
                <span>Cut to Clipboard</span>
              </button>

              {/* Copy / Move Dialogs */}
              <button
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                  setModalCopyMoveDest(currentPath);
                  setActiveModal('copy');
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2 font-medium text-slate-500"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy to... (Specify Path)</span>
              </button>

              <button
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                  setModalCopyMoveDest(currentPath);
                  setActiveModal('move');
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2 font-medium text-slate-500"
              >
                <Move className="w-3.5 h-3.5" />
                <span>Move to... (Specify Path)</span>
              </button>

              {/* Compress (Zip) */}
              <div className="h-px bg-slate-100 my-1" />
              <button
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                  setModalArchiveName(`${contextMenu.item!.name}.zip`);
                  setModalArchiveFormat('zip');
                  setActiveModal('compress');
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2 font-medium"
              >
                <Archive className="w-3.5 h-3.5 text-orange-600" />
                <span>Compress (Zip)</span>
              </button>

              <div className="h-px bg-slate-100 my-1" />

              {/* Delete / Restore */}
              {currentPath.startsWith('/.trash') ? (
                <>
                  <button
                    onClick={() => {
                      setContextMenu(prev => ({ ...prev, visible: false }));
                      handleRestoreFromTrash();
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-emerald-50 text-emerald-700 flex items-center gap-2 font-bold"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Restore from Trash</span>
                  </button>
                  <button
                    onClick={() => {
                      setContextMenu(prev => ({ ...prev, visible: false }));
                      setModalSkipTrash(true);
                      setActiveModal('delete');
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-rose-50 text-rose-700 flex items-center gap-2 font-bold"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Delete Permanently</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setContextMenu(prev => ({ ...prev, visible: false }));
                    setModalSkipTrash(false);
                    setActiveModal('delete');
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-rose-50 text-rose-700 flex items-center gap-2 font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Delete</span>
                </button>
              )}
            </>
          ) : (
            // ==========================================
            // EMPTY SPACE / BACKGROUND CONTEXT MENU
            // ==========================================
            <>
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 border-b border-slate-100 truncate">
                Folder: /home/{domainUsername}{currentPath}
              </div>

              {/* + New File */}
              <button
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                  setModalInputName('');
                  setModalInputContent('');
                  setActiveModal('new_file');
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 font-medium"
              >
                <FilePlus className="w-3.5 h-3.5 text-blue-600" />
                <span>New File</span>
              </button>

              {/* + New Folder */}
              <button
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                  setModalInputName('');
                  setActiveModal('new_folder');
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 font-medium"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
                <span>New Folder</span>
              </button>

              {/* Upload Files */}
              <button
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                  setModalUploadFile(null);
                  setUploadProgress(null);
                  setActiveModal('upload');
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 font-medium"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Upload Files</span>
              </button>

              {/* Paste */}
              <button
                disabled={!clipboard || clipboard.items.length === 0}
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                  handlePasteClipboard();
                }}
                className={`w-full px-3 py-1.5 text-left flex items-center gap-2 font-medium ${
                  clipboard && clipboard.items.length > 0
                    ? 'hover:bg-emerald-50 text-emerald-800 font-bold'
                    : 'text-slate-400 cursor-not-allowed'
                }`}
              >
                <Clipboard className="w-3.5 h-3.5 text-emerald-600" />
                <span>Paste{clipboard && clipboard.items.length > 0 ? ` (${clipboard.items.length} items)` : ''}</span>
              </button>

              <div className="h-px bg-slate-100 my-1" />

              {/* Restore Default Structure */}
              <button
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                  setActiveModal('restore_confirm');
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-emerald-50 text-emerald-700 flex items-center gap-2 font-bold"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                <span>Restore Default Structure</span>
              </button>

              {/* Reload / Refresh */}
              <button
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                  handleReload();
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2 font-medium"
              >
                <RotateCw className="w-3.5 h-3.5 text-blue-600" />
                <span>Reload / Refresh</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODALS */}
      {/* ========================================================================= */}

      {/* A. NEW FILE MODAL */}
      {activeModal === 'new_file' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Create New File</h3>
            <p className="text-slate-500 mb-4">
              Destination: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold">/home/{domainUsername}{currentPath}</code>
            </p>
            <form onSubmit={handleCreateFileSubmit} className="space-y-4">
              <div>
                <label className="block font-semibold mb-1">New File Name:</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={modalInputName}
                  onChange={e => setModalInputName(e.target.value)}
                  placeholder="e.g. index.php, style.css, script.js"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm"
                >
                  Create New File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* B. NEW FOLDER MODAL */}
      {activeModal === 'new_folder' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Create New Folder</h3>
            <p className="text-slate-500 mb-4">
              Destination: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold">/home/{domainUsername}{currentPath}</code>
            </p>
            <form onSubmit={handleCreateFolderSubmit} className="space-y-4">
              <div>
                <label className="block font-semibold mb-1">New Folder Name:</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={modalInputName}
                  onChange={e => setModalInputName(e.target.value)}
                  placeholder="e.g. images, assets, includes"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-sm"
                >
                  Create New Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* C. EDIT / HTML EDITOR MODAL */}
      {(activeModal === 'edit' || activeModal === 'view') && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full h-[88vh] flex flex-col shadow-2xl border border-slate-200 text-xs overflow-hidden">
            <div className="bg-[#1f2837] text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-orange-400" />
                <span className="font-bold font-mono text-sm">{modalInputName}</span>
                <span className="text-slate-400 text-[11px] hidden sm:inline">
                  ({viewingFileMeta?.size} • {viewingFileMeta?.modified})
                </span>
                {/* Language Picker */}
                <select
                  value={editorLanguage}
                  onChange={e => setEditorLanguage(e.target.value)}
                  className="bg-slate-800 text-slate-200 border border-slate-600 rounded text-[11px] px-2 py-0.5 ml-2 font-mono focus:outline-none"
                  title="Switch Syntax Highlighting Language"
                >
                  <option value="php">PHP</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="json">JSON</option>
                  <option value="sql">SQL</option>
                  <option value="shell">Bash/Shell</option>
                  <option value="yaml">YAML</option>
                  <option value="xml">XML</option>
                  <option value="markdown">Markdown</option>
                  <option value="ini">INI / .htaccess</option>
                  <option value="plaintext">Plain Text</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                {activeModal === 'edit' && (
                  <>
                    <button
                      onClick={() => handleSaveEditor(false)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Save changes without closing (Ctrl+S)"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </button>
                    <button
                      onClick={() => handleSaveEditor(true)}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg transition-colors cursor-pointer"
                      title="Save and close editor"
                    >
                      <span>Save & Close</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 bg-[#1e1e1e] overflow-hidden">
              <Editor
                height="100%"
                language={editorLanguage}
                value={modalInputContent}
                theme="vs-dark"
                onChange={val => setModalInputContent(val || '')}
                options={{
                  readOnly: activeModal === 'view',
                  minimap: { enabled: true },
                  fontSize: 13,
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  tabSize: 4,
                }}
              />
            </div>

            <div className="bg-slate-100 border-t border-slate-200 px-4 py-2 flex items-center justify-between text-[11px] text-slate-600 font-mono">
              <div className="flex items-center gap-3">
                <span>Encoding: UTF-8</span>
                <span>•</span>
                <span>Lines: {modalInputContent.split('\n').length}</span>
                <span>•</span>
                <span>Language: <strong className="text-blue-700">{editorLanguage.toUpperCase()}</strong></span>
              </div>
              <div className="text-slate-500">
                Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-semibold text-slate-700">Ctrl+S</kbd> to save changes
              </div>
            </div>
          </div>
        </div>
      )}

      {/* D. PERMISSIONS MODAL */}
      {activeModal === 'permissions' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Change Permissions</h3>
            <p className="text-slate-500 font-mono mb-4 truncate">
              {modalInputName}
            </p>

            <div className="border rounded-xl overflow-hidden mb-5">
              <table className="w-full text-center text-xs">
                <thead className="bg-slate-100 font-bold border-b text-slate-700">
                  <tr>
                    <th className="py-2 px-3 text-left">Mode</th>
                    <th className="py-2 px-3">User</th>
                    <th className="py-2 px-3">Group</th>
                    <th className="py-2 px-3">World</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  <tr>
                    <td className="py-2 px-3 text-left font-bold text-slate-700">Read</td>
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={permCheckboxes.uR}
                        onChange={e => {
                          const updated = { ...permCheckboxes, uR: e.target.checked };
                          setPermCheckboxes(updated);
                          setModalSelectedPerms(getOctalFromCheckboxes(updated));
                        }}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={permCheckboxes.gR}
                        onChange={e => {
                          const updated = { ...permCheckboxes, gR: e.target.checked };
                          setPermCheckboxes(updated);
                          setModalSelectedPerms(getOctalFromCheckboxes(updated));
                        }}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={permCheckboxes.wR}
                        onChange={e => {
                          const updated = { ...permCheckboxes, wR: e.target.checked };
                          setPermCheckboxes(updated);
                          setModalSelectedPerms(getOctalFromCheckboxes(updated));
                        }}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-left font-bold text-slate-700">Write</td>
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={permCheckboxes.uW}
                        onChange={e => {
                          const updated = { ...permCheckboxes, uW: e.target.checked };
                          setPermCheckboxes(updated);
                          setModalSelectedPerms(getOctalFromCheckboxes(updated));
                        }}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={permCheckboxes.gW}
                        onChange={e => {
                          const updated = { ...permCheckboxes, gW: e.target.checked };
                          setPermCheckboxes(updated);
                          setModalSelectedPerms(getOctalFromCheckboxes(updated));
                        }}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={permCheckboxes.wW}
                        onChange={e => {
                          const updated = { ...permCheckboxes, wW: e.target.checked };
                          setPermCheckboxes(updated);
                          setModalSelectedPerms(getOctalFromCheckboxes(updated));
                        }}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-left font-bold text-slate-700">Execute</td>
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={permCheckboxes.uX}
                        onChange={e => {
                          const updated = { ...permCheckboxes, uX: e.target.checked };
                          setPermCheckboxes(updated);
                          setModalSelectedPerms(getOctalFromCheckboxes(updated));
                        }}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={permCheckboxes.gX}
                        onChange={e => {
                          const updated = { ...permCheckboxes, gX: e.target.checked };
                          setPermCheckboxes(updated);
                          setModalSelectedPerms(getOctalFromCheckboxes(updated));
                        }}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={permCheckboxes.wX}
                        onChange={e => {
                          const updated = { ...permCheckboxes, wX: e.target.checked };
                          setPermCheckboxes(updated);
                          setModalSelectedPerms(getOctalFromCheckboxes(updated));
                        }}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mb-6 bg-slate-50 p-3 rounded-xl border">
              <span className="font-semibold text-slate-700">Permission Octal:</span>
              <span className="font-mono text-base font-extrabold text-indigo-700 bg-white px-3 py-1 rounded border border-indigo-200">
                {modalSelectedPerms}
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePermissions}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm"
              >
                Change Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* E. RENAME MODAL */}
      {activeModal === 'rename' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Rename Item</h3>
            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <label className="block font-semibold mb-1">New Name:</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={modalInputName}
                  onChange={e => setModalInputName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-sm"
                >
                  Rename File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* F. DELETE MODAL */}
      {activeModal === 'delete' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">Confirm Delete</h3>
            <p className="text-slate-500 mb-4">
              Are you sure you want to delete {selectedItems.size} selected item(s)?
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 max-h-32 overflow-y-auto font-mono text-[11px] text-slate-700 space-y-1">
              {Array.from(selectedItems).map(item => (
                <div key={item} className="flex items-center gap-1.5">
                  <X className="w-3 h-3 text-rose-500" />
                  <span className="truncate">{item}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-5">
              <input
                type="checkbox"
                id="skipTrashCheck"
                checked={modalSkipTrash}
                onChange={e => setModalSkipTrash(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600"
              />
              <label htmlFor="skipTrashCheck" className="font-semibold text-slate-700 select-none cursor-pointer">
                Skip the trash and permanently delete the files
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSubmit}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* G. FAST STREAMING UNLIMITED UPLOAD MODAL (REQUIREMENT #6) */}
      {activeModal === 'upload' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Unlimited Fast File Upload</h3>
            <p className="text-slate-500 font-mono mb-4">
              Destination: /home/{domainUsername}{currentPath}
            </p>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                  isUploading
                    ? 'border-emerald-400 bg-emerald-50/40 cursor-wait'
                    : 'border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40'
                }`}
              >
                <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <span className="font-bold text-slate-700 block text-sm">
                  {modalUploadFile ? modalUploadFile.name : 'Click to browse or drop any file here'}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1 font-mono">
                  {modalUploadFile
                    ? `${(modalUploadFile.size / (1024 * 1024)).toFixed(2)} MB • Unlimited Size Streaming`
                    : 'Direct stream to SSD • Unlimited file size supported'}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setModalUploadFile(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {/* Progress Bar when uploading */}
              {isUploading && uploadProgress !== null && (
                <div className="space-y-1.5 animate-in fade-in duration-100">
                  <div className="flex justify-between text-xs font-bold text-slate-700 font-mono">
                    <span>Uploading direct to server disk...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => {
                    setActiveModal(null);
                    setModalUploadFile(null);
                    setUploadProgress(null);
                  }}
                  className="px-4 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!modalUploadFile || isUploading}
                  className={`px-5 py-2 rounded-xl font-bold text-white shadow-sm transition-colors ${
                    modalUploadFile && !isUploading
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  {isUploading ? `Uploading (${uploadProgress}%)` : 'Upload Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* H. COMPRESS MODAL WITH MULTIPLE FORMATS (.zip, .tar.gz, .tar - REQUIREMENT #5) */}
      {activeModal === 'compress' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Compress Selected Items</h3>
            <p className="text-slate-500 mb-4">
              Create an archive containing {selectedItems.size} selected item(s).
            </p>

            <form onSubmit={handleCompressSubmit} className="space-y-4">
              <div>
                <label className="block font-semibold mb-1">Compression Format:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalArchiveFormat('zip');
                      const base = modalArchiveName.replace(/\.(zip|tar\.gz|tar)$/, '');
                      setModalArchiveName(`${base || 'archive'}.zip`);
                    }}
                    className={`py-2 px-3 rounded-xl border text-center font-bold ${
                      modalArchiveFormat === 'zip'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    .zip (Zip)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalArchiveFormat('tar.gz');
                      const base = modalArchiveName.replace(/\.(zip|tar\.gz|tar)$/, '');
                      setModalArchiveName(`${base || 'archive'}.tar.gz`);
                    }}
                    className={`py-2 px-3 rounded-xl border text-center font-bold ${
                      modalArchiveFormat === 'tar.gz'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    .tar.gz (Gzip)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalArchiveFormat('tar');
                      const base = modalArchiveName.replace(/\.(zip|tar\.gz|tar)$/, '');
                      setModalArchiveName(`${base || 'archive'}.tar`);
                    }}
                    className={`py-2 px-3 rounded-xl border text-center font-bold ${
                      modalArchiveFormat === 'tar'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    .tar (Tar)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Archive Name:</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={modalArchiveName}
                  onChange={e => setModalArchiveName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-sm"
                >
                  Compress File(s)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* I. EXTRACT MODAL */}
      {activeModal === 'extract' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Extract Archive</h3>
            <p className="text-slate-500 mb-4 truncate font-mono">
              Extracting: {singleSelected}
            </p>

            <form onSubmit={handleExtractSubmit} className="space-y-4">
              <div>
                <label className="block font-semibold mb-1">Destination Directory:</label>
                <div className="flex items-center gap-1">
                  <span className="bg-slate-100 border border-slate-300 px-2 py-2 rounded-lg font-mono text-slate-600 font-bold text-xs">
                    /home/{domainUsername}
                  </span>
                  <input
                    type="text"
                    required
                    value={modalExtractDest}
                    onChange={e => setModalExtractDest(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-sm"
                >
                  Extract File(s)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* J. COPY MODAL */}
      {activeModal === 'copy' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Copy Selected Items</h3>
            <p className="text-slate-500 mb-4">
              Copying {selectedItems.size} item(s) to destination directory.
            </p>

            <form onSubmit={handleCopySubmit} className="space-y-4">
              <div>
                <label className="block font-semibold mb-1">Destination Path:</label>
                <div className="flex items-center gap-1">
                  <span className="bg-slate-100 border border-slate-300 px-2 py-2 rounded-lg font-mono text-slate-600 font-bold text-xs">
                    /home/{domainUsername}
                  </span>
                  <input
                    type="text"
                    required
                    value={modalCopyMoveDest}
                    onChange={e => setModalCopyMoveDest(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm"
                >
                  Copy File(s)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* K. MOVE MODAL */}
      {activeModal === 'move' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Move Selected Items</h3>
            <p className="text-slate-500 mb-4">
              Move {selectedItems.size} item(s) to new destination directory.
            </p>

            <form onSubmit={handleMoveSubmit} className="space-y-4">
              <div>
                <label className="block font-semibold mb-1">Destination Path:</label>
                <div className="flex items-center gap-1">
                  <span className="bg-slate-100 border border-slate-300 px-2 py-2 rounded-lg font-mono text-slate-600 font-bold text-xs">
                    /home/{domainUsername}
                  </span>
                  <input
                    type="text"
                    required
                    value={modalCopyMoveDest}
                    onChange={e => setModalCopyMoveDest(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm"
                >
                  Move File(s)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* L. RESTORE DEFAULT HOSTING STRUCTURE MODAL (REQUIREMENT #6 & #7) */}
      {activeModal === 'restore_confirm' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Restore Default Hosting Structure
              </h3>
              <p className="text-slate-500 mt-1 leading-relaxed">
                This will safely check and recreate missing standard hosting directories and files for <strong>{activeDomain}</strong>:
              </p>
              <div className="mt-2 p-3 bg-slate-50 rounded-xl border font-mono text-[11px] text-slate-700 grid grid-cols-2 gap-1.5">
                <span>• public_html/</span>
                <span>• ssl/</span>
                <span>• tmp/</span>
                <span>• mail/</span>
                <span>• logs/</span>
                <span>• etc/</span>
                <span>• public_html/cgi-bin/</span>
                <span>• public_html/.htaccess</span>
              </div>
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] font-semibold flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Safety Guarantee: Only missing default directories and templates are recreated. Existing files, scripts, and custom project folders will NEVER be deleted, modified, or overwritten.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestorePublicHtmlDefaults}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-colors"
              >
                Restore Default
              </button>
            </div>
          </div>
        </div>
      )}

      {/* M. SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-4">File Manager Preferences</h3>
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="showHiddenCheck"
                  checked={showHiddenFiles}
                  onChange={e => handleToggleHiddenFiles(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-blue-600 cursor-pointer"
                />
                <div>
                  <label htmlFor="showHiddenCheck" className="font-bold text-slate-800 select-none cursor-pointer block text-xs">
                    Show Hidden Files (dotfiles)
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Check this option to display hidden dotfiles such as <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono">.htaccess</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono">.user.ini</code>, and <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono">.trash</code>. Uncheck to hide them just like cPanel.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-3 fade-in duration-150">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-xl border text-xs font-bold flex items-center gap-2 ${
              toastMessage.type === 'success'
                ? 'bg-[#1f2837] text-white border-slate-700'
                : 'bg-rose-900 text-white border-rose-700'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </div>
  );
};
