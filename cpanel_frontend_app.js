/**
 * cPanel Jupiter Control Panel - Production Frontend Integration
 * Connects 100% directly to the Linux VPS Backend REST API
 * Zero Mock Data - Full Real MariaDB & Filesystem Execution
 */

const API_BASE = window.location.origin; // Same host or configured API origin
let currentPath = '/';
let selectedFilePath = null;
let currentDatabases = [];
let currentUsers = [];
let tempWizDb = '';
let tempWizUser = '';
let tempWizPass = '';

// Helper for HTTP requests
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Server error occurred');
        }
        return data;
    } catch (err) {
        console.error(`[API Error] ${endpoint}:`, err);
        alert(`Error: ${err.message}`);
        throw err;
    }
}

// ----------------------------------------------------
// 1. SPA VIEW SWITCHER & NAVIGATION
// ----------------------------------------------------
function switchView(viewId) {
    document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active-view'));
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active-view');
    }

    if (viewId === 'view-filemanager') {
        loadFiles(currentPath);
    } else if (viewId === 'view-manage-db') {
        loadDatabases();
    }
}

// Global phpMyAdmin SSO Launch
async function openPhpMyAdmin() {
    try {
        const res = await apiCall('/api/pma-sso', { method: 'POST' });
        if (res.redirectUrl) {
            window.open(res.redirectUrl, '_blank');
        }
    } catch (e) {
        // Handled in apiCall
    }
}

// ----------------------------------------------------
// 2. REAL LINUX FILE MANAGER (POSIX INTEGRATION)
// ----------------------------------------------------
async function loadFiles(dir = '') {
    const tbody = document.getElementById('fmTableBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 25px; color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Loading filesystem directory...</td></tr>`;

    try {
        const data = await apiCall(`/api/files/list?dir=${encodeURIComponent(dir)}`);
        currentPath = data.currentPath;
        renderFileList(data.files);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Failed to load directory: ${err.message}</td></tr>`;
    }
}

function renderFileList(files) {
    const tbody = document.getElementById('fmTableBody');
    tbody.innerHTML = '';

    if (!files || files.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color:#64748b;">(Directory is empty)</td></tr>`;
        return;
    }

    files.forEach(file => {
        const tr = document.createElement('tr');
        tr.dataset.name = file.name;
        tr.dataset.isFolder = file.isFolder ? '1' : '0';

        tr.onclick = (e) => {
            if (e.target.tagName.toLowerCase() === 'input') return;
            document.querySelectorAll('#fmTableBody tr').forEach(r => r.classList.remove('selected'));
            tr.classList.add('selected');
            selectedFilePath = file.name;
        };

        // Double click to enter folders
        tr.ondblclick = () => {
            if (file.isFolder) {
                const nextDir = currentPath === '/' ? file.name : `${currentPath}/${file.name}`;
                loadFiles(nextDir);
            }
        };

        const iconClass = file.isFolder ? 'fa-solid fa-folder' : 'fa-regular fa-file-lines';
        const iconColor = file.isFolder ? '#eab308' : '#64748b';

        tr.innerHTML = `
            <td style="font-weight: 500; cursor: pointer;">
                <i class="${iconClass}" style="color:${iconColor}; margin-right:8px;"></i>
                <span>${file.name}</span>
            </td>
            <td>${file.size}</td>
            <td>${file.date}</td>
            <td>${file.type}</td>
            <td><code>${file.perm}</code></td>
        `;

        tbody.appendChild(tr);
    });
}

async function addNewItem(type) {
    const isFolder = type === 'folder';
    const name = prompt(`Enter new ${isFolder ? 'folder' : 'file'} name:`);
    if (!name) return;

    try {
        await apiCall('/api/files/create', {
            method: 'POST',
            body: JSON.stringify({
                dir: currentPath,
                name: name.trim(),
                isFolder
            })
        });
        await loadFiles(currentPath);
    } catch (e) {}
}

async function deleteSelectedFile() {
    const selected = document.querySelector('#fmTableBody tr.selected');
    if (!selected) {
        return alert('Please select a file or directory to delete.');
    }

    const name = selected.dataset.name;
    if (!confirm(`Are you sure you want to permanently delete "${name}"?`)) return;

    try {
        await apiCall('/api/files/delete', {
            method: 'POST',
            body: JSON.stringify({
                dir: currentPath,
                name,
                skipTrash: false
            })
        });
        await loadFiles(currentPath);
    } catch (e) {}
}

async function renameSelectedFile() {
    const selected = document.querySelector('#fmTableBody tr.selected');
    if (!selected) {
        return alert('Please select a file or directory to rename.');
    }

    const oldName = selected.dataset.name;
    const newName = prompt('Enter new name:', oldName);
    if (!newName || newName.trim() === oldName) return;

    try {
        await apiCall('/api/files/rename', {
            method: 'POST',
            body: JSON.stringify({
                dir: currentPath,
                oldName,
                newName: newName.trim()
            })
        });
        await loadFiles(currentPath);
    } catch (e) {}
}

function selectAllFiles(select) {
    document.querySelectorAll('#fmTableBody tr').forEach(tr => {
        if (select) tr.classList.add('selected');
        else tr.classList.remove('selected');
    });
}

function reloadFiles() {
    loadFiles(currentPath);
}

// ----------------------------------------------------
// 3. REAL MARIADB DATABASE MANAGEMENT
// ----------------------------------------------------
async function loadDatabases() {
    const tbody = document.getElementById('currentDbTable');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 25px; color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Querying MariaDB databases...</td></tr>`;
    }

    try {
        const data = await apiCall('/api/databases/list');
        currentDatabases = data.databases || [];
        currentUsers = data.users || [];
        renderDatabasesTable(currentDatabases);
        populateDatabaseDropdowns();
    } catch (err) {
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading databases: ${err.message}</td></tr>`;
        }
    }
}

function renderDatabasesTable(databases) {
    const tbody = document.getElementById('currentDbTable');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!databases || databases.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color:#64748b;">There are no databases associated with your account.</td></tr>`;
        return;
    }

    databases.forEach(db => {
        const tr = document.createElement('tr');
        const userListStr = db.users && db.users.length > 0 ? db.users.join(', ') : '(None)';

        tr.innerHTML = `
            <td><strong style="color:#1e293b;">${db.name}</strong></td>
            <td>${db.sizeFormatted}</td>
            <td><span style="color:#475569;">${userListStr}</span></td>
            <td>
                <a href="javascript:void(0)" onclick="promptRenameDatabase('${db.name}')" style="color:#2563eb; margin-right:12px; text-decoration:none;">
                    <i class="fa-solid fa-pencil"></i> Rename
                </a>
                <a href="javascript:void(0)" onclick="deleteDatabase('${db.name}')" style="color:#dc2626; text-decoration:none;">
                    <i class="fa-solid fa-trash"></i> Delete
                </a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function populateDatabaseDropdowns() {
    const checkSel = document.getElementById('checkDbSelect');
    const repairSel = document.getElementById('repairDbSelect');
    const assignDbSel = document.getElementById('assignDbSelect');
    const assignUserSel = document.getElementById('assignUserSelect');

    const updateSelect = (el, items, placeholder) => {
        if (!el) return;
        el.innerHTML = `<option value="">-- ${placeholder} --</option>`;
        items.forEach(it => {
            const opt = document.createElement('option');
            opt.value = typeof it === 'object' ? it.name : it;
            opt.textContent = typeof it === 'object' ? it.name : it;
            el.appendChild(opt);
        });
    };

    updateSelect(checkSel, currentDatabases, 'Select Database');
    updateSelect(repairSel, currentDatabases, 'Select Database');
    updateSelect(assignDbSel, currentDatabases, 'Select Database');
    updateSelect(assignUserSel, currentUsers, 'Select User');
}

async function createDatabase() {
    const input = document.getElementById('newDbInput');
    const dbName = input ? input.value.trim() : '';
    if (!dbName) return alert('Please enter a database name.');

    try {
        const res = await apiCall('/api/databases/create', {
            method: 'POST',
            body: JSON.stringify({ dbName })
        });
        alert(res.message);
        if (input) input.value = '';
        await loadDatabases();
    } catch (e) {}
}

async function deleteDatabase(fullDbName) {
    if (!confirm(`Are you sure you want to permanently drop database "${fullDbName}"? This action cannot be undone.`)) return;

    try {
        const res = await apiCall('/api/databases/delete', {
            method: 'POST',
            body: JSON.stringify({ dbName: fullDbName })
        });
        alert(res.message);
        await loadDatabases();
    } catch (e) {}
}

async function promptRenameDatabase(oldDbName) {
    const newDbName = prompt(`Enter new name for database "${oldDbName}":`, oldDbName);
    if (!newDbName || newDbName.trim() === oldDbName) return;

    try {
        const res = await apiCall('/api/databases/rename', {
            method: 'POST',
            body: JSON.stringify({ oldDbName, newDbName: newDbName.trim() })
        });
        alert(res.message);
        await loadDatabases();
    } catch (e) {}
}

async function executeCheckDatabase() {
    const select = document.getElementById('checkDbSelect');
    const dbName = select ? select.value : '';
    if (!dbName) return alert('Please select a database to check.');

    try {
        const res = await apiCall('/api/databases/check', {
            method: 'POST',
            body: JSON.stringify({ dbName })
        });
        alert(`Check Database Results for ${res.database}:\n\n` + JSON.stringify(res.results, null, 2));
    } catch (e) {}
}

async function executeRepairDatabase() {
    const select = document.getElementById('repairDbSelect');
    const dbName = select ? select.value : '';
    if (!dbName) return alert('Please select a database to repair.');

    try {
        const res = await apiCall('/api/databases/repair', {
            method: 'POST',
            body: JSON.stringify({ dbName })
        });
        alert(`Repair Database Results for ${res.database}:\n\n` + JSON.stringify(res.results, null, 2));
    } catch (e) {}
}

// ----------------------------------------------------
// 4. DATABASE USERS MANAGEMENT
// ----------------------------------------------------
function generateRandomPass() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 16; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    
    const input = document.getElementById('dbPassNew');
    if (input) input.value = pass;
    const text = document.getElementById('passGenText');
    if (text) text.innerText = "Generated: " + pass;
}

async function createDbUser() {
    const user = document.getElementById('dbUserNew')?.value.trim();
    const pass = document.getElementById('dbPassNew')?.value;
    if (!user || !pass) return alert('Please provide both a username and password.');

    try {
        const res = await apiCall('/api/databases/users/create', {
            method: 'POST',
            body: JSON.stringify({ username: user, password: pass })
        });
        alert(res.message);
        document.getElementById('dbUserNew').value = '';
        document.getElementById('dbPassNew').value = '';
        await loadDatabases();
    } catch (e) {}
}

// ----------------------------------------------------
// 5. DATABASE WIZARD STEPS (1 -> 2 -> 3)
// ----------------------------------------------------
async function proceedWizStep2() {
    const db = document.getElementById('wizDbName')?.value.trim();
    if (!db) return alert('Please enter a database name');

    try {
        const res = await apiCall('/api/databases/create', {
            method: 'POST',
            body: JSON.stringify({ dbName: db })
        });
        tempWizDb = res.database;
        document.getElementById('wizCreatedDbLabel').innerText = tempWizDb;
        document.getElementById('wizDbFinal').innerText = tempWizDb;
        switchView('view-db-wizard-step2');
    } catch (e) {}
}

async function proceedWizStep3() {
    const user = document.getElementById('wizUserName')?.value.trim();
    const pass = document.getElementById('wizUserPass')?.value || document.getElementById('dbPassNew')?.value || 'Pass_' + Math.random().toString(36).slice(2, 10);
    if (!user) return alert('Please enter a username');

    try {
        const res = await apiCall('/api/databases/users/create', {
            method: 'POST',
            body: JSON.stringify({ username: user, password: pass })
        });
        tempWizUser = res.username;
        tempWizPass = pass;
        document.getElementById('wizCreatedUserLabel').innerText = tempWizUser;
        document.getElementById('wizUserFinal').innerText = tempWizUser;
        switchView('view-db-wizard-step3');
    } catch (e) {}
}

function toggleAllPrivileges(master) {
    document.querySelectorAll('.priv-cb').forEach(cb => cb.checked = master.checked);
}

async function finishWizard() {
    const checked = Array.from(document.querySelectorAll('.priv-cb:checked')).map(cb => cb.value);
    if (checked.length === 0) {
        return alert('Please select at least one privilege to assign.');
    }

    try {
        const res = await apiCall('/api/databases/privileges', {
            method: 'POST',
            body: JSON.stringify({
                dbName: tempWizDb,
                username: tempWizUser,
                privileges: checked
            })
        });
        alert(res.message);
        switchView('view-manage-db');
    } catch (e) {}
}

// ----------------------------------------------------
// 6. DASHBOARD INSTANT TOOL SEARCH
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('toolSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function (e) {
            const query = e.target.value.toLowerCase().trim();
            document.querySelectorAll('.tool-category-card').forEach(card => {
                let match = false;
                card.querySelectorAll('.tool-item').forEach(item => {
                    const txt = item.textContent.toLowerCase();
                    if (txt.includes(query)) {
                        item.style.display = 'flex';
                        match = true;
                    } else {
                        item.style.display = 'none';
                    }
                });
                card.style.display = (match || query === '') ? 'block' : 'none';
            });
        });
    }

    // Attach phpMyAdmin buttons to SSO
    document.querySelectorAll('[data-action="phpmyadmin"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openPhpMyAdmin();
        });
    });
});
