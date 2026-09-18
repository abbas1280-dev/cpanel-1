import os
import re

cpanel_path = os.path.join(os.getcwd(), 'cpanel.html')
with open(cpanel_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Right Sidebar
old_sidebar = """                        <div class="info-group">

                            <div class="info-label">Current User</div>

                            <div class="info-value">sebagadg</div>

                        </div>

                        <div class="info-group">

                            <div class="info-label">Primary Domain</div>

                            <div class="info-value"><a href="http://sebagadget.com" target="_blank">sebagadget.com <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 11px;"></i></a></div>

                        </div>

                        <div class="info-group">

                            <div class="info-label">SSL Certificate <i class="fa-regular fa-circle-question"></i></div>

                            <div style="display:flex; justify-content:space-between; align-items:center;">

                                <span style="color:#10b981; font-size:13px;"><i class="fa-solid fa-circle-check"></i> Active</span>

                                <a href="#" style="font-size:12px; color:#2563eb; text-decoration:none;">View SSL</a>

                            </div>

                        </div>

                        <div class="info-group">

                            <div class="info-label">Shared IP Address</div>

                            <div class="info-value">161.248.201.171</div>

                        </div>

                        <div class="info-group">

                            <div class="info-label">Home Directory</div>

                            <div class="info-value">/home/sebagadg</div>

                        </div>"""

new_sidebar = """                        <div class="info-group">

                            <div class="info-label">Current User</div>

                            <div class="info-value" id="infoCurrentUser"><i class="fa-solid fa-spinner fa-spin"></i></div>

                        </div>

                        <div class="info-group">

                            <div class="info-label">Primary Domain</div>

                            <div class="info-value" id="infoPrimaryDomain"><i class="fa-solid fa-spinner fa-spin"></i></div>

                        </div>

                        <div class="info-group">

                            <div class="info-label">SSL Certificate <i class="fa-regular fa-circle-question"></i></div>

                            <div style="display:flex; justify-content:space-between; align-items:center;">

                                <span style="color:#10b981; font-size:13px;" id="infoSslStatus"><i class="fa-solid fa-circle-check"></i> Active</span>

                                <a href="#" style="font-size:12px; color:#2563eb; text-decoration:none;">View SSL</a>

                            </div>

                        </div>

                        <div class="info-group">

                            <div class="info-label">Shared IP Address</div>

                            <div class="info-value" id="infoSharedIp"><i class="fa-solid fa-spinner fa-spin"></i></div>

                        </div>

                        <div class="info-group">

                            <div class="info-label">Home Directory</div>

                            <div class="info-value" id="infoHomeDir"><i class="fa-solid fa-spinner fa-spin"></i></div>

                        </div>

                        <div class="info-header" style="margin-top:20px;">Statistics</div>

                        <div class="info-group">

                            <div class="info-label">Disk Usage</div>

                            <div class="info-value" id="infoDiskUsage"><i class="fa-solid fa-spinner fa-spin"></i></div>

                        </div>

                        <div class="info-group">

                            <div class="info-label">MySQL® Disk Usage</div>

                            <div class="info-value" id="infoMysqlUsage"><i class="fa-solid fa-spinner fa-spin"></i></div>

                        </div>"""

if old_sidebar in content:
    content = content.replace(old_sidebar, new_sidebar, 1)
    print("Sidebar updated")
else:
    print("Warning: old_sidebar not found")

# 2. File Manager Path Bar & Tree
old_fm_path = """                <input type="text" id="fmPathInput" class="cp-input" value="/home/sebagadg" style="flex:1; height: 26px; font-size: 12px;">

                <button class="cp-btn-default" style="padding: 2px 10px; font-size: 12px;">Go</button>"""

new_fm_path = """                <input type="text" id="fmPathInput" class="cp-input" value="" style="flex:1; height: 26px; font-size: 12px;" onkeydown="if(event.key==='Enter') navigateToFmPath()">

                <button class="cp-btn-default" style="padding: 2px 10px; font-size: 12px;" onclick="navigateToFmPath()">Go</button>"""

if old_fm_path in content:
    content = content.replace(old_fm_path, new_fm_path, 1)
    print("FM Path updated")
else:
    print("Warning: old_fm_path not found")

old_fm_tree = """                    <div class="tree-item active"><i class="fa-solid fa-house-chimney"></i> <b>(home/sebagadg)</b></div>

                    <div style="padding-left: 14px;">

                        <div class="tree-item"><i class="fa-solid fa-folder"></i> .cagefs</div>

                        <div class="tree-item"><i class="fa-solid fa-folder"></i> .cpanel</div>

                        <div class="tree-item"><i class="fa-solid fa-folder"></i> etc</div>

                        <div class="tree-item"><i class="fa-solid fa-folder"></i> mail</div>

                        <div class="tree-item"><i class="fa-solid fa-folder"></i> public_ftp</div>

                        <div class="tree-item" style="color: #2563eb; font-weight: bold;"><i class="fa-solid fa-globe"></i> public_html</div>

                        <div class="tree-item"><i class="fa-solid fa-folder"></i> ssl</div>

                        <div class="tree-item"><i class="fa-solid fa-folder"></i> tmp</div>

                    </div>"""

new_fm_tree = """                    <div class="tree-item active" onclick="reloadFiles('')" style="cursor:pointer;"><i class="fa-solid fa-house-chimney"></i> <b id="fmTreeHomeLabel">(home)</b></div>

                    <div id="fmTreeSubfolders" style="padding-left: 14px;">
                        <div class="tree-item" onclick="reloadFiles('public_html')" style="color: #2563eb; font-weight: bold; cursor:pointer;"><i class="fa-solid fa-globe"></i> public_html</div>
                        <div class="tree-item" onclick="reloadFiles('ssl')" style="cursor:pointer;"><i class="fa-solid fa-folder"></i> ssl</div>
                        <div class="tree-item" onclick="reloadFiles('tmp')" style="cursor:pointer;"><i class="fa-solid fa-folder"></i> tmp</div>
                        <div class="tree-item" onclick="reloadFiles('etc')" style="cursor:pointer;"><i class="fa-solid fa-folder"></i> etc</div>
                        <div class="tree-item" onclick="reloadFiles('mail')" style="cursor:pointer;"><i class="fa-solid fa-folder"></i> mail</div>
                    </div>"""

if old_fm_tree in content:
    content = content.replace(old_fm_tree, new_fm_tree, 1)
    print("FM Tree updated")
else:
    print("Warning: old_fm_tree not found")

# 3. File Manager Subnav
old_subnav = """                        <a onclick="reloadFiles()"><i class="fa-solid fa-house"></i> Home</a>

                        <a><i class="fa-solid fa-arrow-up"></i> Up One Level</a>

                        <a><i class="fa-solid fa-arrow-left"></i> Back</a>

                        <a><i class="fa-solid fa-arrow-right"></i> Forward</a>

                        <a onclick="reloadFiles()"><i class="fa-solid fa-rotate"></i> Reload</a>"""

new_subnav = """                        <a onclick="reloadFiles('')" style="cursor:pointer;"><i class="fa-solid fa-house"></i> Home</a>

                        <a onclick="navigateFmUp()" style="cursor:pointer;"><i class="fa-solid fa-arrow-up"></i> Up One Level</a>

                        <a onclick="reloadFiles(currentPath)" style="cursor:pointer;"><i class="fa-solid fa-rotate"></i> Reload</a>"""

if old_subnav in content:
    content = content.replace(old_subnav, new_subnav, 1)
    print("Subnav updated")
else:
    print("Warning: old_subnav not found")

# 4. phpMyAdmin View
old_pma_tree = """                <div class="pma-left-tree">

                    <div style="margin-bottom: 8px;"><i class="fa-solid fa-house"></i> <b>localhost</b></div>

                    <div style="padding-left: 12px;">

                        <div style="padding: 3px 0;"><i class="fa-solid fa-database" style="color: #eab308;"></i> information_schema</div>

                        <div style="padding: 3px 0; color: #2563eb; font-weight: bold;"><i class="fa-solid fa-database" style="color: #eab308;"></i> sebagadg_seba</div>

                    </div>

                </div>"""

new_pma_tree = """                <div class="pma-left-tree">

                    <div style="margin-bottom: 8px;"><i class="fa-solid fa-house"></i> <b>localhost</b></div>

                    <div id="pmaDbListContainer" style="padding-left: 12px;">
                        <div style="padding: 3px 0; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>
                    </div>

                </div>"""

if old_pma_tree in content:
    content = content.replace(old_pma_tree, new_pma_tree, 1)
    print("PMA Tree updated")
else:
    print("Warning: old_pma_tree not found")

old_pma_user = '<li>User: sebagadg@localhost</li>'
new_pma_user = '<li id="pmaUserItem">User: localhost</li>'
if old_pma_user in content:
    content = content.replace(old_pma_user, new_pma_user, 1)
    print("PMA User updated")
else:
    print("Warning: old_pma_user not found")

# 5. Manage My Databases
old_db_section = """            <!-- 1. Create New Database -->

            <div class="db-section-heading">Create New Database</div>

            <label style="font-size: 13px; color: #555;">New Database:</label>

            <div style="display:flex; align-items:center; gap: 8px; margin: 8px 0 15px;">

                <span style="font-size: 13px; font-weight: bold;">sebagadg_</span>

                <input type="text" id="newDbInput" class="cp-input" style="width: 250px;">

            </div>

            <button class="cp-btn-primary" onclick="createDatabase()">Create Database</button>



            <hr style="border:0; border-top:1px solid #e5e5e5; margin: 30px 0;">



            <!-- 2. Modify Databases -->

            <div class="db-section-heading">Modify Databases</div>

            <div style="display:flex; gap: 40px; margin-bottom: 25px;">

                <div>

                    <label style="display:block; font-size: 13px; margin-bottom: 6px;">Check Database</label>

                    <div style="display:flex; gap: 8px;">

                        <select class="cp-input" style="width: 220px;"><option>sebagadg_seba</option></select>

                        <button class="cp-btn-primary" onclick="alert('Database Checked: OK')">Check Database</button>

                    </div>

                </div>

                <div>

                    <label style="display:block; font-size: 13px; margin-bottom: 6px;">Repair Database</label>

                    <div style="display:flex; gap: 8px;">

                        <select class="cp-input" style="width: 220px;"><option>sebagadg_seba</option></select>

                        <button class="cp-btn-primary" onclick="alert('Database Repaired: OK')">Repair Database</button>

                    </div>

                </div>

            </div>



            <hr style="border:0; border-top:1px solid #e5e5e5; margin: 30px 0;">



            <!-- 3. Current Databases Table -->

            <div class="db-section-heading">Current Databases</div>

            <table class="db-table">

                <thead>

                    <tr>

                        <th>Database</th>

                        <th>Size</th>

                        <th>Privileged Users</th>

                        <th>Actions</th>

                    </tr>

                </thead>

                <tbody id="currentDbTable">

                    <tr>

                        <td><b>sebagadg_seba</b></td>

                        <td>968.96 KB</td>

                        <td>sebagadg_seba</td>

                        <td>

                            <a href="#" style="color:#2563eb; margin-right:10px;"><i class="fa-solid fa-pencil"></i> Rename</a>

                            <a href="#" style="color:#dc2626;" onclick="this.closest('tr').remove()"><i class="fa-solid fa-trash"></i> Delete</a>

                        </td>

                    </tr>

                </tbody>

            </table>



            <hr style="border:0; border-top:1px solid #e5e5e5; margin: 30px 0;">



            <!-- 4. Add New User -->

            <div class="db-section-heading">Database Users - Add New User</div>

            <div style="max-width: 450px;">

                <label style="font-size: 12.5px;">Username</label>

                <div style="display:flex; align-items:center; gap: 6px; margin: 4px 0 12px;">

                    <span style="font-size: 13px; font-weight: bold;">sebagadg_</span>

                    <input type="text" id="dbUserNew" class="cp-input" style="flex:1;">

                </div>"""

new_db_section = """            <!-- 1. Create New Database -->

            <div class="db-section-heading">Create New Database</div>

            <label style="font-size: 13px; color: #555;">New Database:</label>

            <div style="display:flex; align-items:center; gap: 8px; margin: 8px 0 15px;">

                <span class="db-prefix-span" style="font-size: 13px; font-weight: bold;"></span>

                <input type="text" id="newDbInput" class="cp-input" style="width: 250px;" placeholder="database_name">

            </div>

            <button class="cp-btn-primary" onclick="createDatabase()">Create Database</button>



            <hr style="border:0; border-top:1px solid #e5e5e5; margin: 30px 0;">



            <!-- 2. Modify Databases -->

            <div class="db-section-heading">Modify Databases</div>

            <div style="display:flex; gap: 40px; margin-bottom: 25px; flex-wrap: wrap;">

                <div>

                    <label style="display:block; font-size: 13px; margin-bottom: 6px;">Check Database</label>

                    <div style="display:flex; gap: 8px;">

                        <select id="checkDbSelect" class="cp-input" style="width: 220px;"></select>

                        <button class="cp-btn-primary" onclick="runCheckDb()">Check Database</button>

                    </div>

                </div>

                <div>

                    <label style="display:block; font-size: 13px; margin-bottom: 6px;">Repair Database</label>

                    <div style="display:flex; gap: 8px;">

                        <select id="repairDbSelect" class="cp-input" style="width: 220px;"></select>

                        <button class="cp-btn-primary" onclick="runRepairDb()">Repair Database</button>

                    </div>

                </div>

            </div>



            <hr style="border:0; border-top:1px solid #e5e5e5; margin: 30px 0;">



            <!-- 3. Current Databases Table -->

            <div class="db-section-heading">Current Databases</div>

            <table class="db-table">

                <thead>

                    <tr>

                        <th>Database</th>

                        <th>Size</th>

                        <th>Privileged Users</th>

                        <th>Actions</th>

                    </tr>

                </thead>

                <tbody id="currentDbTable">

                    <tr><td colspan="4" style="text-align:center; padding:20px; color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Loading databases...</td></tr>

                </tbody>

            </table>



            <hr style="border:0; border-top:1px solid #e5e5e5; margin: 30px 0;">



            <!-- 4. Add New User -->

            <div class="db-section-heading">Database Users - Add New User</div>

            <div style="max-width: 450px;">

                <label style="font-size: 12.5px;">Username</label>

                <div style="display:flex; align-items:center; gap: 6px; margin: 4px 0 12px;">

                    <span class="db-prefix-span" style="font-size: 13px; font-weight: bold;"></span>

                    <input type="text" id="dbUserNew" class="cp-input" style="flex:1;" placeholder="username">

                </div>"""

if old_db_section in content:
    content = content.replace(old_db_section, new_db_section, 1)
    print("DB Section updated")
else:
    print("Warning: old_db_section not found")

# 6. Wizard Steps
old_wiz1 = """            <div class="db-section-heading">Step 1: Create A Database</div>

            <label style="font-size: 13px;">New Database:</label>

            <div style="display:flex; align-items:center; gap: 8px; margin: 8px 0;">

                <span style="font-weight: bold;">sebagadg_</span>

                <input type="text" id="wizDbName" class="cp-input" style="width: 320px;" placeholder="e.g. blog">

            </div>"""

new_wiz1 = """            <div class="db-section-heading">Step 1: Create A Database</div>

            <label style="font-size: 13px;">New Database:</label>

            <div style="display:flex; align-items:center; gap: 8px; margin: 8px 0;">

                <span class="db-prefix-span" style="font-weight: bold;"></span>

                <input type="text" id="wizDbName" class="cp-input" style="width: 320px;" placeholder="e.g. blog">

            </div>"""

if old_wiz1 in content:
    content = content.replace(old_wiz1, new_wiz1, 1)
    print("Wiz 1 updated")
else:
    print("Warning: old_wiz1 not found")

old_wiz2 = """            <div class="alert-success-cp">

                <i class="fa-solid fa-circle-check"></i>

                <span>You have created a database named "<b id="wizCreatedDbLabel">sebagadg_aaa</b>".</span>

            </div>



            <div class="db-section-heading">Step 2: Create Database Users:</div>

            

            <div style="max-width: 480px;">

                <label style="font-size: 13px;">Username:</label>

                <div style="display:flex; align-items:center; gap: 8px; margin: 6px 0 12px;">

                    <span style="font-weight: bold;">sebagadg_</span>

                    <input type="text" id="wizUserName" class="cp-input" style="flex:1;" value="sebagadg">

                </div>"""

new_wiz2 = """            <div class="alert-success-cp">

                <i class="fa-solid fa-circle-check"></i>

                <span>You have created a database named "<b id="wizCreatedDbLabel">(database)</b>".</span>

            </div>



            <div class="db-section-heading">Step 2: Create Database Users:</div>

            

            <div style="max-width: 480px;">

                <label style="font-size: 13px;">Username:</label>

                <div style="display:flex; align-items:center; gap: 8px; margin: 6px 0 12px;">

                    <span class="db-prefix-span" style="font-weight: bold;"></span>

                    <input type="text" id="wizUserName" class="cp-input" style="flex:1;" placeholder="e.g. user">

                </div>"""

if old_wiz2 in content:
    content = content.replace(old_wiz2, new_wiz2, 1)
    print("Wiz 2 updated")
else:
    print("Warning: old_wiz2 not found")

old_wiz3 = """            <div class="alert-success-cp">

                <i class="fa-solid fa-circle-check"></i>

                <span>You have successfully created a database user named "<b id="wizCreatedUserLabel">sebagadg_sebagadg</b>".</span>

            </div>



            <div class="db-section-heading">Step 3: Add user to the database.</div>

            <div style="font-size: 13.5px; margin-bottom: 15px;">

                <div>User: <b id="wizUserFinal">sebagadg_sebagadg</b></div>

                <div>Database: <b id="wizDbFinal">sebagadg_aaa</b></div>

            </div>"""

new_wiz3 = """            <div class="alert-success-cp">

                <i class="fa-solid fa-circle-check"></i>

                <span>You have successfully created a database user named "<b id="wizCreatedUserLabel">(user)</b>".</span>

            </div>



            <div class="db-section-heading">Step 3: Add user to the database.</div>

            <div style="font-size: 13.5px; margin-bottom: 15px;">

                <div>User: <b id="wizUserFinal">(user)</b></div>

                <div>Database: <b id="wizDbFinal">(database)</b></div>

            </div>"""

if old_wiz3 in content:
    content = content.replace(old_wiz3, new_wiz3, 1)
    print("Wiz 3 updated")
else:
    print("Warning: old_wiz3 not found")

# 7. Replace the entire <script> block at bottom
script_start = content.find('<script>')
script_end = content.find('</script>') + len('</script>')
if script_start != -1 and script_end != -1:
    new_script = """<script>
        // Real API Base URL & Query Parameter Binding
        const API_BASE = window.location.origin;
        const urlParams = new URLSearchParams(window.location.search);
        const currentDomain = urlParams.get('domain') || 'turkyhub.com';
        
        let accountInfo = null;
        let fileList = [];
        let currentDatabases = [];
        let currentUsers = [];
        let currentPath = '';
        let tempWizDb = "";
        let tempWizUser = "";
        let tempWizPass = "";

        // Universal API Caller
        async function apiCall(endpoint, options = {}) {
            try {
                const res = await fetch(`${API_BASE}${endpoint}`, {
                    headers: { 'Content-Type': 'application/json', ...options.headers },
                    ...options
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.error || 'Request failed');
                }
                return data;
            } catch (err) {
                console.error(`[API Error] ${endpoint}:`, err);
                alert(`Error: ${err.message}`);
                throw err;
            }
        }

        // 1. Account Info Dynamic Binding
        async function loadAccountInfo() {
            try {
                const res = await fetch(`${API_BASE}/api/cpanel/account-info?domain=${encodeURIComponent(currentDomain)}`);
                const data = await res.json();
                if (!data.success) return;
                accountInfo = data;

                const userEl = document.getElementById('infoCurrentUser');
                if (userEl) userEl.innerText = data.username || 'user';

                const domEl = document.getElementById('infoPrimaryDomain');
                if (domEl) {
                    domEl.innerHTML = `<a href="http://${data.primaryDomain}" target="_blank">${data.primaryDomain} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 11px;"></i></a>`;
                }

                const ipEl = document.getElementById('infoSharedIp');
                if (ipEl) ipEl.innerText = data.sharedIp || '127.0.0.1';

                const homeEl = document.getElementById('infoHomeDir');
                if (homeEl) homeEl.innerText = data.homeDir || `/home/${data.username}`;

                const diskEl = document.getElementById('infoDiskUsage');
                if (diskEl) diskEl.innerText = data.diskUsedFormatted || '0 B';

                const mysqlEl = document.getElementById('infoMysqlUsage');
                if (mysqlEl) mysqlEl.innerText = data.mysqlUsedFormatted || '0 B';

                const fmPath = document.getElementById('fmPathInput');
                if (fmPath && !fmPath.value) fmPath.value = data.homeDir;

                const fmTreeLabel = document.getElementById('fmTreeHomeLabel');
                if (fmTreeLabel) fmTreeLabel.innerText = `(${data.homeDir.replace(/^\\//, '')})`;

                document.querySelectorAll('.db-prefix-span').forEach(el => {
                    el.innerText = `${data.username}_`;
                });

                const pmaUser = document.getElementById('pmaUserItem');
                if (pmaUser) pmaUser.innerText = `User: ${data.username}@localhost`;
            } catch (e) {
                console.error('Failed to load account info:', e);
            }
        }

        // 2. View Switcher SPA
        function switchView(viewId) {
            document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active-view'));
            const target = document.getElementById(viewId);
            if (target) {
                target.classList.add('active-view');
            }
            if (viewId === 'view-filemanager') {
                reloadFiles(currentPath);
            } else if (viewId === 'view-manage-db') {
                loadRealDatabases();
            } else if (viewId === 'view-pma') {
                loadPmaTree();
            }
        }

        // 3. Real File Manager Functions
        async function reloadFiles(subDir = '') {
            const tbody = document.getElementById('fmTableBody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 25px; color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Loading directory from VPS...</td></tr>';
            }
            try {
                const data = await apiCall(`/api/files/list?domain=${encodeURIComponent(currentDomain)}&dir=${encodeURIComponent(subDir)}`);
                fileList = data.files || [];
                currentPath = data.currentPath === '/' ? '' : data.currentPath;

                const pathInput = document.getElementById('fmPathInput');
                if (pathInput) {
                    const home = accountInfo ? accountInfo.homeDir : `/home/${currentDomain.split('.')[0]}`;
                    pathInput.value = home + (currentPath ? '/' + currentPath : '');
                }

                renderFiles();
            } catch (e) {
                if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color:#ef4444;">Failed to load filesystem: ${e.message}</td></tr>`;
            }
        }

        function renderFiles() {
            const tbody = document.getElementById('fmTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (fileList.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color:#64748b;">(Directory is empty)</td></tr>';
                return;
            }

            fileList.forEach((file) => {
                const tr = document.createElement('tr');
                tr.dataset.fileName = file.name;
                tr.dataset.isFolder = file.isFolder ? '1' : '0';
                tr.style.cursor = 'pointer';

                tr.onclick = (e) => {
                    document.querySelectorAll('#fmTableBody tr').forEach(r => r.classList.remove('selected'));
                    tr.classList.add('selected');
                };

                if (file.isFolder) {
                    tr.ondblclick = () => {
                        const nextDir = currentPath ? `${currentPath}/${file.name}` : file.name;
                        reloadFiles(nextDir);
                    };
                }

                tr.innerHTML = `
                    <td style="font-weight: 500;">
                        <i class="${file.isFolder ? 'fa-solid fa-folder text-warning' : 'fa-regular fa-file-lines text-secondary'}" style="color:${file.isFolder ? '#eab308' : '#64748b'}; margin-right:8px;"></i>
                        <span class="file-label-text">${file.name}</span>
                    </td>
                    <td>${file.size}</td>
                    <td>${file.date}</td>
                    <td>${file.type}</td>
                    <td><code>${file.perm}</code></td>
                `;
                tbody.appendChild(tr);
            });
        }

        function navigateFmUp() {
            if (!currentPath) return;
            const parts = currentPath.split('/').filter(Boolean);
            parts.pop();
            reloadFiles(parts.join('/'));
        }

        function navigateToFmPath() {
            const pathInput = document.getElementById('fmPathInput');
            if (!pathInput) return;
            let val = pathInput.value.trim();
            const home = accountInfo ? accountInfo.homeDir : '';
            if (home && val.startsWith(home)) {
                val = val.slice(home.length).replace(/^\\/+/, '');
            }
            reloadFiles(val);
        }

        async function addNewItem(type) {
            const isFolder = type === 'folder';
            const name = prompt(`Enter new ${type} name:`);
            if (!name) return;

            try {
                await apiCall('/api/files/create', {
                    method: 'POST',
                    body: JSON.stringify({ domain: currentDomain, dir: currentPath, name: name.trim(), isFolder })
                });
                await reloadFiles(currentPath);
            } catch (e) {}
        }

        async function deleteSelectedFile() {
            const selected = document.querySelector('#fmTableBody tr.selected');
            if (!selected) {
                return alert('Please click and select a file first.');
            }

            const name = selected.dataset.fileName;
            if (!confirm(`Are you sure you want to permanently delete "${name}"?`)) return;

            try {
                await apiCall('/api/files/delete', {
                    method: 'POST',
                    body: JSON.stringify({ domain: currentDomain, dir: currentPath, name, skipTrash: false })
                });
                await reloadFiles(currentPath);
            } catch (e) {}
        }

        async function renameSelectedFile() {
            const selected = document.querySelector('#fmTableBody tr.selected');
            if (!selected) {
                return alert('Please select a file first.');
            }

            const oldName = selected.dataset.fileName;
            const newName = prompt('Enter new name:', oldName);
            if (!newName || newName.trim() === oldName) return;

            try {
                await apiCall('/api/files/rename', {
                    method: 'POST',
                    body: JSON.stringify({ domain: currentDomain, dir: currentPath, oldName, newName: newName.trim() })
                });
                await reloadFiles(currentPath);
            } catch (e) {}
        }

        function selectAllFiles(select) {
            document.querySelectorAll('#fmTableBody tr').forEach(tr => {
                if (select) tr.classList.add('selected');
                else tr.classList.remove('selected');
            });
        }

        // 4. Real Manage Databases Functions
        async function loadRealDatabases() {
            const tbody = document.getElementById('currentDbTable');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 25px; color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Querying MariaDB databases...</td></tr>';
            }
            try {
                const data = await apiCall(`/api/databases/list?domain=${encodeURIComponent(currentDomain)}`);
                currentDatabases = data.databases || [];
                currentUsers = data.users || [];
                renderDatabasesList();
                updateDbSelects();
            } catch (e) {
                if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color:#ef4444;">Error loading databases: ${e.message}</td></tr>`;
            }
        }

        function updateDbSelects() {
            const checkSelect = document.getElementById('checkDbSelect');
            const repairSelect = document.getElementById('repairDbSelect');
            if (checkSelect && repairSelect) {
                if (currentDatabases.length === 0) {
                    checkSelect.innerHTML = '<option value="">No databases found</option>';
                    repairSelect.innerHTML = '<option value="">No databases found</option>';
                } else {
                    const opts = currentDatabases.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
                    checkSelect.innerHTML = opts;
                    repairSelect.innerHTML = opts;
                }
            }
        }

        function renderDatabasesList() {
            const tbody = document.getElementById('currentDbTable');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (currentDatabases.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 25px; color:#64748b;">There are no databases associated with your account.</td></tr>';
                return;
            }

            currentDatabases.forEach(db => {
                const tr = document.createElement('tr');
                const userStr = (db.users && db.users.length > 0) ? db.users.join(', ') : '(None)';

                tr.innerHTML = `
                    <td><b>${db.name}</b></td>
                    <td>${db.sizeFormatted}</td>
                    <td>${userStr}</td>
                    <td>
                        <a href="javascript:void(0)" onclick="promptRenameDb('${db.name}')" style="color:#2563eb; margin-right:10px;"><i class="fa-solid fa-pencil"></i> Rename</a>
                        <a href="javascript:void(0)" onclick="realDeleteDb('${db.name}')" style="color:#dc2626;"><i class="fa-solid fa-trash"></i> Delete</a>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        async function createDatabase() {
            const input = document.getElementById('newDbInput');
            const dbName = input ? input.value.trim() : '';
            if (!dbName) return alert('Please enter a database name');

            try {
                const res = await apiCall('/api/databases/create', {
                    method: 'POST',
                    body: JSON.stringify({ domain: currentDomain, dbName })
                });
                alert(res.message);
                if (input) input.value = '';
                await loadRealDatabases();
            } catch (e) {}
        }

        async function realDeleteDb(fullDb) {
            if (!confirm(`Are you sure you want to permanently drop database "${fullDb}"?`)) return;
            try {
                const res = await apiCall('/api/databases/delete', {
                    method: 'POST',
                    body: JSON.stringify({ domain: currentDomain, dbName: fullDb })
                });
                alert(res.message);
                await loadRealDatabases();
            } catch (e) {}
        }

        async function promptRenameDb(oldDb) {
            const newName = prompt(`Enter new name for database "${oldDb}":`, oldDb);
            if (!newName || newName.trim() === oldDb) return;
            try {
                const res = await apiCall('/api/databases/rename', {
                    method: 'POST',
                    body: JSON.stringify({ domain: currentDomain, oldDbName: oldDb, newDbName: newName.trim() })
                });
                alert(res.message);
                await loadRealDatabases();
            } catch (e) {}
        }

        async function runCheckDb() {
            const db = document.getElementById('checkDbSelect')?.value;
            if (!db) return alert('Please select a database to check.');
            try {
                const res = await apiCall('/api/databases/check', {
                    method: 'POST',
                    body: JSON.stringify({ domain: currentDomain, dbName: db })
                });
                alert(`Check Database completed for "${db}": OK\\n` + JSON.stringify(res.results || [], null, 2));
            } catch (e) {}
        }

        async function runRepairDb() {
            const db = document.getElementById('repairDbSelect')?.value;
            if (!db) return alert('Please select a database to repair.');
            try {
                const res = await apiCall('/api/databases/repair', {
                    method: 'POST',
                    body: JSON.stringify({ domain: currentDomain, dbName: db })
                });
                alert(`Repair Database completed for "${db}": OK\\n` + JSON.stringify(res.results || [], null, 2));
            } catch (e) {}
        }

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
            if (!user || !pass) return alert('Please enter a username and password');

            try {
                const res = await apiCall('/api/databases/users/create', {
                    method: 'POST',
                    body: JSON.stringify({ domain: currentDomain, username: user, password: pass })
                });
                alert(res.message);
                document.getElementById('dbUserNew').value = '';
                document.getElementById('dbPassNew').value = '';
                await loadRealDatabases();
            } catch (e) {}
        }

        // 5. Real Wizard Step Logic
        async function proceedWizStep2() {
            const db = document.getElementById('wizDbName')?.value.trim();
            if (!db) return alert('Please enter a database name');

            try {
                const res = await apiCall('/api/databases/create', {
                    method: 'POST',
                    body: JSON.stringify({ domain: currentDomain, dbName: db })
                });
                tempWizDb = res.database;
                document.getElementById('wizCreatedDbLabel').innerText = tempWizDb;
                document.getElementById('wizDbFinal').innerText = tempWizDb;
                switchView('view-db-wizard-step2');
            } catch (e) {}
        }

        async function proceedWizStep3() {
            const user = document.getElementById('wizUserName')?.value.trim();
            const pass = document.getElementById('wizUserPass')?.value || 'Pass_' + Math.random().toString(36).slice(2, 10);
            if (!user) return alert('Please enter a username');

            try {
                const res = await apiCall('/api/databases/users/create', {
                    method: 'POST',
                    body: JSON.stringify({ domain: currentDomain, username: user, password: pass })
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
            const checked = Array.from(document.querySelectorAll('.priv-cb:checked')).map(cb => cb.parentNode.textContent.trim());
            if (checked.length === 0) {
                return alert('Please select at least one privilege.');
            }

            try {
                const res = await apiCall('/api/databases/privileges', {
                    method: 'POST',
                    body: JSON.stringify({
                        domain: currentDomain,
                        dbName: tempWizDb,
                        username: tempWizUser,
                        privileges: checked
                    })
                });
                alert(`Success! User "${tempWizUser}" was added to "${tempWizDb}" with selected privileges in MariaDB.`);
                switchView('view-manage-db');
                await loadRealDatabases();
            } catch (e) {}
        }

        // 6. phpMyAdmin SSO and Tree
        async function loadPmaTree() {
            try {
                const data = await apiCall(`/api/databases/list?domain=${encodeURIComponent(currentDomain)}`);
                const treeContainer = document.getElementById('pmaDbListContainer');
                if (treeContainer) {
                    if (!data.databases || data.databases.length === 0) {
                        treeContainer.innerHTML = '<div style="padding: 4px 6px; font-size: 11px; color: #94a3b8;">(No databases)</div>';
                    } else {
                        let html = '';
                        data.databases.forEach(db => {
                            html += `
                                <div style="padding: 4px 6px; font-size: 12px; color: #334155; cursor: pointer; border-radius: 4px; display:flex; align-items:center; gap:6px;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                                    <i class="fa-solid fa-database" style="color: #64748b; font-size:11px;"></i>
                                    <span style="font-family:monospace;">${db.name}</span>
                                    <span style="margin-left:auto; font-size:10px; color:#94a3b8;">${db.sizeFormatted}</span>
                                </div>
                            `;
                        });
                        treeContainer.innerHTML = html;
                    }
                }
            } catch (e) {}
        }

        async function launchPmaSSO() {
            try {
                const res = await apiCall('/api/pma-sso', {
                    method: 'POST',
                    body: JSON.stringify({ domain: currentDomain })
                });
                if (res.redirectUrl) {
                    window.open(res.redirectUrl, '_blank');
                }
            } catch (e) {}
        }

        // 7. Tool Search Filter in Dashboard
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

            // Auto-load live account info and real data
            loadAccountInfo();
            reloadFiles();
            loadRealDatabases();
        });
    </script>"""

    content = content[:script_start] + new_script + content[script_end:]
    print("Script block replaced")
else:
    print("Warning: script block not found")

# Write out clean files
with open(cpanel_path, 'w', encoding='utf-8') as f:
    f.write(content)

prod_path = os.path.join(os.getcwd(), 'cpanel_production.html')
with open(prod_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Saved cpanel.html and cpanel_production.html successfully!")
