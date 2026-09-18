<?php
/**
 * cPanel Web File Manager (Production Ready)
 * Single-file standalone architecture for Easy Git Deployment
 */

session_start();

// ==========================================
// ১. কনফিগারেশন ও রুট পাথ সেটআপ
// ==========================================
$domain_param = isset($_GET['domain']) ? preg_replace('/[^a-zA-Z0-9.-]/', '', $_GET['domain']) : (isset($_SESSION['domain']) ? preg_replace('/[^a-zA-Z0-9.-]/', '', $_SESSION['domain']) : null);

$candidate_paths = [
    $_SESSION['user_home_dir'] ?? null,
    $domain_param ? __DIR__ . '/server_storage/domains/' . $domain_param . '/public_html' : null,
    $domain_param ? __DIR__ . '/server_storage/domains/' . $domain_param : null,
    isset($_SESSION['username']) ? '/home/' . $_SESSION['username'] . '/public_html' : null,
    isset($_SESSION['username']) ? '/home/' . $_SESSION['username'] : null,
];

// Fallback to existing domain directories in server_storage if domain not explicitly given
$storage_domains = @glob(__DIR__ . '/server_storage/domains/*', GLOB_ONLYDIR);
if (!empty($storage_domains)) {
    foreach ($storage_domains as $d_path) {
        $candidate_paths[] = $d_path . '/public_html';
        $candidate_paths[] = $d_path;
    }
}
$candidate_paths[] = __DIR__ . '/storage';

$BASE_DIR = null;
foreach ($candidate_paths as $p) {
    if ($p && file_exists($p)) {
        $real = realpath($p);
        if ($real) {
            $BASE_DIR = $real;
            break;
        }
    }
}

if (!$BASE_DIR) {
    $fallback = __DIR__ . '/storage';
    @mkdir($fallback, 0755, true);
    $BASE_DIR = realpath($fallback);
}

$DASHBOARD_URL = $_SESSION['dashboard_url'] ?? ("/cpanel.html" . ($domain_param ? "?domain=" . urlencode($domain_param) : "")); // Return link to cPanel dashboard

// সিকিউর পাথ রেজোলিউশন (Path Traversal / Jail Protection)
function get_safe_path($rel_path = '') {
    global $BASE_DIR;
    $rel_path = str_replace(chr(0), '', $rel_path);
    $target = $BASE_DIR . '/' . ltrim($rel_path, '/');
    
    if (!file_exists($target)) {
        $parent = realpath(dirname($target));
        if ($parent === false || strpos($parent, $BASE_DIR) !== 0) {
            return false;
        }
        return $target;
    }
    
    $real = realpath($target);
    if ($real === false || strpos($real, $BASE_DIR) !== 0) {
        return false;
    }
    return $real;
}

// সাইজ ফরম্যাটিং হেল্পার
function format_bytes($bytes, $precision = 2) {
    if ($bytes <= 0) return '0 B';
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, $precision) . ' ' . $units[$pow];
}

// ==========================================
// ২. ব্যাকএন্ড API রিকোয়েস্ট হ্যান্ডলার
// ==========================================
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    header('Content-Type: application/json');
    $action = $_POST['action'];

    try {
        switch ($action) {
            case 'list':
                $dir = $_POST['path'] ?? '';
                $safe_dir = get_safe_path($dir);
                $show_hidden = filter_var($_POST['show_hidden'] ?? false, FILTER_VALIDATE_BOOLEAN);

                if (!$safe_dir || !is_dir($safe_dir)) {
                    throw new Exception('Invalid Directory');
                }

                $items = scandir($safe_dir);
                $result = [];

                foreach ($items as $item) {
                    if ($item === '.' || $item === '..') continue;
                    if (!$show_hidden && $item[0] === '.') continue;

                    $full_path = $safe_dir . '/' . $item;
                    $is_dir = is_dir($full_path);
                    $perms = substr(sprintf('%o', fileperms($full_path)), -4);

                    $result[] = [
                        'name' => $item,
                        'is_dir' => $is_dir,
                        'size' => $is_dir ? '-' : format_bytes(filesize($full_path)),
                        'raw_size' => $is_dir ? 0 : filesize($full_path),
                        'mtime' => date('M d, Y h:i A', filemtime($full_path)),
                        'perms' => $perms,
                        'ext' => $is_dir ? 'folder' : strtolower(pathinfo($item, PATHINFO_EXTENSION))
                    ];
                }

                usort($result, function ($a, $b) {
                    if ($a['is_dir'] === $b['is_dir']) {
                        return strcasecmp($a['name'], $b['name']);
                    }
                    return $a['is_dir'] ? -1 : 1;
                });

                echo json_encode(['success' => true, 'data' => $result]);
                exit;

            case 'create_folder':
                $path = $_POST['path'] ?? '';
                $name = trim($_POST['name'] ?? '');
                if (!$name || preg_match('/[\/\\\]/', $name)) throw new Exception('Invalid folder name');

                $target = get_safe_path($path . '/' . $name);
                if (!$target) throw new Exception('Access Denied');
                if (file_exists($target)) throw new Exception('Folder already exists');

                if (!mkdir($target, 0755, true)) throw new Exception('Failed to create folder');
                chmod($target, 0755);
                echo json_encode(['success' => true, 'message' => 'Folder created successfully']);
                exit;

            case 'create_file':
                $path = $_POST['path'] ?? '';
                $name = trim($_POST['name'] ?? '');
                if (!$name || preg_match('/[\/\\\]/', $name)) throw new Exception('Invalid file name');

                $target = get_safe_path($path . '/' . $name);
                if (!$target) throw new Exception('Access Denied');
                if (file_exists($target)) throw new Exception('File already exists');

                if (file_put_contents($target, '') === false) throw new Exception('Failed to create file');
                chmod($target, 0644);
                echo json_encode(['success' => true, 'message' => 'File created successfully']);
                exit;

            case 'read_file':
                $path = $_POST['path'] ?? '';
                $target = get_safe_path($path);
                if (!$target || !is_file($target)) throw new Exception('File not found');

                $content = file_get_contents($target);
                echo json_encode(['success' => true, 'content' => $content]);
                exit;

            case 'save_file':
                $path = $_POST['path'] ?? '';
                $content = $_POST['content'] ?? '';
                $target = get_safe_path($path);
                if (!$target || !is_file($target)) throw new Exception('File not found or access denied');

                if (file_put_contents($target, $content) === false) throw new Exception('Failed to save file');
                echo json_encode(['success' => true, 'message' => 'File saved successfully']);
                exit;

            case 'rename':
                $path = $_POST['path'] ?? '';
                $new_name = trim($_POST['new_name'] ?? '');
                if (!$new_name || preg_match('/[\/\\\]/', $new_name)) throw new Exception('Invalid name');

                $target = get_safe_path($path);
                if (!$target || !file_exists($target)) throw new Exception('Source item not found');

                $dest = dirname($target) . '/' . $new_name;
                if (file_exists($dest)) throw new Exception('Target item already exists');

                if (!rename($target, $dest)) throw new Exception('Rename failed');
                echo json_encode(['success' => true, 'message' => 'Renamed successfully']);
                exit;

            case 'chmod':
                $path = $_POST['path'] ?? '';
                $mode = $_POST['mode'] ?? '0644';
                $target = get_safe_path($path);
                if (!$target || !file_exists($target)) throw new Exception('Item not found');

                $octal = octdec($mode);
                if (!chmod($target, $octal)) throw new Exception('Chmod failed');
                echo json_encode(['success' => true, 'message' => 'Permissions updated']);
                exit;

            case 'delete':
                $path = $_POST['path'] ?? '';
                $skip_trash = filter_var($_POST['skip_trash'] ?? false, FILTER_VALIDATE_BOOLEAN);
                $target = get_safe_path($path);
                if (!$target || !file_exists($target)) throw new Exception('Item not found');

                if ($skip_trash) {
                    if (is_dir($target)) {
                        $files = new RecursiveIteratorIterator(
                            new RecursiveDirectoryIterator($target, RecursiveDirectoryIterator::SKIP_DOTS),
                            RecursiveIteratorIterator::CHILD_FIRST
                        );
                        foreach ($files as $fileinfo) {
                            $fileinfo->isDir() ? rmdir($fileinfo->getRealPath()) : unlink($fileinfo->getRealPath());
                        }
                        rmdir($target);
                    } else {
                        unlink($target);
                    }
                } else {
                    $trash_dir = $BASE_DIR . '/.trash';
                    if (!is_dir($trash_dir)) @mkdir($trash_dir, 0755, true);
                    $trash_name = time() . '_' . basename($target);
                    rename($target, $trash_dir . '/' . $trash_name);
                }
                echo json_encode(['success' => true, 'message' => 'Deleted successfully']);
                exit;

            case 'upload':
                $path = $_POST['path'] ?? '';
                $target_dir = get_safe_path($path);
                if (!$target_dir || !is_dir($target_dir)) throw new Exception('Invalid upload directory');

                if (!empty($_FILES['files']['name'][0])) {
                    foreach ($_FILES['files']['name'] as $key => $name) {
                        $tmp_name = $_FILES['files']['tmp_name'][$key];
                        $clean_name = basename($name);
                        $dest = $target_dir . '/' . $clean_name;
                        if (move_uploaded_file($tmp_name, $dest)) {
                            chmod($dest, 0644);
                        }
                    }
                }
                echo json_encode(['success' => true, 'message' => 'Files uploaded successfully']);
                exit;

            case 'extract':
                $path = $_POST['path'] ?? '';
                $target = get_safe_path($path);
                if (!$target || !is_file($target)) throw new Exception('Zip file not found');

                if (!class_exists('ZipArchive')) throw new Exception('PHP ZipArchive extension is missing');

                $zip = new ZipArchive;
                if ($zip->open($target) === TRUE) {
                    $zip->extractTo(dirname($target));
                    $zip->close();
                    echo json_encode(['success' => true, 'message' => 'Extracted successfully']);
                } else {
                    throw new Exception('Failed to extract archive');
                }
                exit;

            case 'compress':
                $path = $_POST['path'] ?? '';
                $items = json_decode($_POST['items'] ?? '[]', true);
                $zip_name = trim($_POST['zip_name'] ?? 'archive.zip');
                if (!class_exists('ZipArchive')) throw new Exception('PHP ZipArchive extension is missing');

                $parent_dir = get_safe_path($path);
                if (!$parent_dir || !is_dir($parent_dir)) throw new Exception('Invalid directory');

                $zip = new ZipArchive();
                $zip_file = $parent_dir . '/' . $zip_name;

                if ($zip->open($zip_file, ZipArchive::CREATE | ZipArchive::OVERWRITE) === TRUE) {
                    foreach ($items as $item_name) {
                        $item_path = $parent_dir . '/' . $item_name;
                        if (is_file($item_path)) {
                            $zip->addFile($item_path, $item_name);
                        }
                    }
                    $zip->close();
                    chmod($zip_file, 0644);
                    echo json_encode(['success' => true, 'message' => 'Archive created successfully']);
                } else {
                    throw new Exception('Could not create archive');
                }
                exit;

            case 'terminate_service':
                $domain = $_POST['domain'] ?? '';
                if (!$domain) throw new Exception('Domain is required for termination');
                require_once __DIR__ . '/server/ServiceTerminationController.php';
                $controller = new ServiceTerminationController();
                $result = $controller->terminate($domain);
                echo json_encode($result);
                exit;
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        exit;
    }
}

if (isset($_GET['download'])) {
    $target = get_safe_path($_GET['download']);
    if ($target && is_file($target)) {
        header('Content-Description: File Transfer');
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . basename($target) . '"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');
        header('Content-Length: ' . filesize($target));
        readfile($target);
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>cPanel File Manager</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .context-menu { display: none; position: absolute; z-index: 100; min-width: 180px; }
    </style>
</head>
<body class="bg-[#f3f4f6] text-slate-800 text-sm antialiased select-none" oncontextmenu="return false;">

    <header class="bg-[#2a3039] text-white h-12 flex items-center justify-between px-4 shadow-md">
        <div class="flex items-center space-x-3">
            <a href="<?= htmlspecialchars($DASHBOARD_URL) ?>" class="flex items-center space-x-2 text-orange-500 hover:text-orange-400 font-bold text-lg tracking-wide transition">
                <i class="fa-solid fa-server text-xl"></i>
                <span class="text-white">cPanel <span class="text-orange-500 font-semibold text-xs ml-1">File Manager</span></span>
            </a>
            <span class="text-slate-500 text-xs">|</span>
            <div id="breadcrumb" class="flex items-center space-x-1 text-xs text-slate-300"></div>
        </div>
        <div class="flex items-center space-x-3 text-xs">
            <label class="flex items-center cursor-pointer space-x-2 bg-slate-700/50 px-2.5 py-1 rounded border border-slate-600">
                <input type="checkbox" id="toggleHidden" class="rounded text-orange-500 focus:ring-0">
                <span class="text-slate-300">Show Hidden Files</span>
            </label>
            <button onclick="loadDirectory(currentPath)" class="bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded text-white flex items-center space-x-1">
                <i class="fa-solid fa-rotate-right"></i>
                <span>Reload</span>
            </button>
        </div>
    </header>

    <div class="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div class="flex flex-wrap items-center gap-1.5">
            <button onclick="openModal('modalNewFile')" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 font-medium flex items-center space-x-1.5 shadow-sm transition">
                <i class="fa-solid fa-file-circle-plus text-blue-600"></i>
                <span>+ File</span>
            </button>
            <button onclick="openModal('modalNewFolder')" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 font-medium flex items-center space-x-1.5 shadow-sm transition">
                <i class="fa-solid fa-folder-plus text-amber-500"></i>
                <span>+ Folder</span>
            </button>
            <button onclick="openModal('modalUpload')" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 font-medium flex items-center space-x-1.5 shadow-sm transition">
                <i class="fa-solid fa-cloud-arrow-up text-emerald-600"></i>
                <span>Upload</span>
            </button>
            <button onclick="downloadSelected()" id="btnDownload" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 font-medium flex items-center space-x-1.5 shadow-sm transition disabled:opacity-40" disabled>
                <i class="fa-solid fa-download text-indigo-600"></i>
                <span>Download</span>
            </button>
            <button onclick="deleteSelected()" id="btnDelete" class="px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-red-600 rounded border border-slate-300 font-medium flex items-center space-x-1.5 shadow-sm transition disabled:opacity-40" disabled>
                <i class="fa-solid fa-trash-can"></i>
                <span>Delete</span>
            </button>
            <button onclick="openCompressModal()" id="btnCompress" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 font-medium flex items-center space-x-1.5 shadow-sm transition disabled:opacity-40" disabled>
                <i class="fa-solid fa-file-zipper text-purple-600"></i>
                <span>Compress</span>
            </button>
        </div>

        <div class="relative w-64">
            <input type="text" id="searchInput" oninput="filterFiles()" placeholder="Search files..." class="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500">
            <i class="fa-solid fa-magnifying-glass absolute left-2.5 top-2 text-slate-400 text-xs"></i>
        </div>
    </div>

    <div class="flex h-[calc(100vh-6.25rem)]">
        <div class="w-64 bg-slate-50 border-r border-slate-200 p-3 overflow-y-auto custom-scrollbar flex flex-col justify-between">
            <div>
                <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Directory Tree</div>
                <div id="folderTree" class="space-y-1 text-xs">
                    <div onclick="navigateTo('')" class="cursor-pointer flex items-center space-x-2 py-1.5 px-2 rounded hover:bg-slate-200 text-slate-700 font-medium">
                        <i class="fa-solid fa-house text-orange-500"></i>
                        <span>public_html (Root)</span>
                    </div>
                </div>
            </div>
            <div class="text-[11px] text-slate-400 border-t border-slate-200 pt-2">
                Linux Default: Folders 0755 | Files 0644
            </div>
        </div>

        <div class="flex-1 bg-white overflow-y-auto custom-scrollbar flex flex-col" id="dropArea">
            <table class="w-full text-left border-collapse">
                <thead class="bg-slate-100/75 border-b border-slate-200 text-slate-600 sticky top-0 z-10 text-xs uppercase font-semibold">
                    <tr>
                        <th class="py-2.5 px-4 w-8"><input type="checkbox" id="selectAll" onclick="toggleSelectAll(this)" class="rounded text-orange-500"></th>
                        <th class="py-2.5 px-4">Name</th>
                        <th class="py-2.5 px-4 w-28">Size</th>
                        <th class="py-2.5 px-4 w-44">Last Modified</th>
                        <th class="py-2.5 px-4 w-20">Perms</th>
                    </tr>
                </thead>
                <tbody id="fileListTable" class="divide-y divide-slate-100 text-xs"></tbody>
            </table>
        </div>
    </div>

    <div id="contextMenu" class="context-menu bg-white border border-slate-200 rounded shadow-xl py-1 text-xs text-slate-700">
        <button onclick="contextAction('edit')" id="cmEdit" class="w-full text-left px-3 py-1.5 hover:bg-orange-50 hover:text-orange-600 flex items-center space-x-2">
            <i class="fa-solid fa-code text-blue-500 w-4"></i><span>Edit / Code Editor</span>
        </button>
        <button onclick="contextAction('download')" id="cmDownload" class="w-full text-left px-3 py-1.5 hover:bg-orange-50 hover:text-orange-600 flex items-center space-x-2">
            <i class="fa-solid fa-download text-indigo-500 w-4"></i><span>Download</span>
        </button>
        <button onclick="contextAction('rename')" class="w-full text-left px-3 py-1.5 hover:bg-orange-50 hover:text-orange-600 flex items-center space-x-2">
            <i class="fa-solid fa-pen-to-square text-amber-500 w-4"></i><span>Rename</span>
        </button>
        <button onclick="contextAction('chmod')" class="w-full text-left px-3 py-1.5 hover:bg-orange-50 hover:text-orange-600 flex items-center space-x-2">
            <i class="fa-solid fa-shield-halved text-emerald-500 w-4"></i><span>Change Permissions</span>
        </button>
        <button onclick="contextAction('extract')" id="cmExtract" class="w-full text-left px-3 py-1.5 hover:bg-orange-50 hover:text-orange-600 flex items-center space-x-2">
            <i class="fa-solid fa-file-zipper text-purple-500 w-4"></i><span>Extract Archive</span>
        </button>
        <div class="border-t border-slate-100 my-1"></div>
        <button onclick="contextAction('delete')" class="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center space-x-2">
            <i class="fa-solid fa-trash w-4"></i><span>Delete</span>
        </button>
    </div>

    <div id="modalEditor" class="fixed inset-0 bg-black/60 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-[#1e1e1e] text-slate-200 rounded-lg shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col border border-slate-700">
            <div class="px-4 py-2.5 bg-[#252526] border-b border-slate-700 flex justify-between items-center">
                <div class="flex items-center space-x-2 font-mono text-xs">
                    <i class="fa-solid fa-code text-orange-500"></i>
                    <span id="editorFilename" class="text-white font-semibold">file.php</span>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="saveFileContent()" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium flex items-center space-x-1">
                        <i class="fa-solid fa-floppy-disk"></i><span>Save (Ctrl+S)</span>
                    </button>
                    <button onclick="closeModal('modalEditor')" class="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs">Close</button>
                </div>
            </div>
            <textarea id="editorTextarea" class="w-full flex-1 p-4 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs outline-none resize-none custom-scrollbar leading-relaxed"></textarea>
        </div>
    </div>

    <div id="modalNewFile" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl w-96 p-4 border border-slate-200">
            <h3 class="font-bold text-slate-800 text-sm mb-3">Create New File</h3>
            <input type="text" id="newFileName" placeholder="e.g. index.php, .htaccess" class="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-orange-500 outline-none mb-4">
            <div class="flex justify-end space-x-2 text-xs">
                <button onclick="closeModal('modalNewFile')" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded">Cancel</button>
                <button onclick="submitCreateFile()" class="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded font-medium">Create File</button>
            </div>
        </div>
    </div>

    <div id="modalNewFolder" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl w-96 p-4 border border-slate-200">
            <h3 class="font-bold text-slate-800 text-sm mb-3">Create New Folder</h3>
            <input type="text" id="newFolderName" placeholder="e.g. assets, includes" class="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-orange-500 outline-none mb-4">
            <div class="flex justify-end space-x-2 text-xs">
                <button onclick="closeModal('modalNewFolder')" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded">Cancel</button>
                <button onclick="submitCreateFolder()" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded font-medium">Create Folder</button>
            </div>
        </div>
    </div>

    <div id="modalChmod" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl w-80 p-4 border border-slate-200">
            <h3 class="font-bold text-slate-800 text-sm mb-3">Change Permissions</h3>
            <div class="grid grid-cols-3 gap-2 text-xs text-center border-b pb-3 mb-3">
                <div class="font-semibold text-slate-600">User</div>
                <div class="font-semibold text-slate-600">Group</div>
                <div class="font-semibold text-slate-600">World</div>
                <div><label><input type="checkbox" id="u_r" onchange="calcChmod()"> Read</label></div>
                <div><label><input type="checkbox" id="g_r" onchange="calcChmod()"> Read</label></div>
                <div><label><input type="checkbox" id="w_r" onchange="calcChmod()"> Read</label></div>
                <div><label><input type="checkbox" id="u_w" onchange="calcChmod()"> Write</label></div>
                <div><label><input type="checkbox" id="g_w" onchange="calcChmod()"> Write</label></div>
                <div><label><input type="checkbox" id="w_w" onchange="calcChmod()"> Write</label></div>
                <div><label><input type="checkbox" id="u_x" onchange="calcChmod()"> Exec</label></div>
                <div><label><input type="checkbox" id="g_x" onchange="calcChmod()"> Exec</label></div>
                <div><label><input type="checkbox" id="w_x" onchange="calcChmod()"> Exec</label></div>
            </div>
            <div class="flex items-center justify-between mb-4">
                <span class="text-xs text-slate-500">Permission:</span>
                <input type="text" id="chmodVal" readonly class="w-16 text-center font-bold font-mono bg-slate-100 border border-slate-300 rounded text-xs py-1">
            </div>
            <div class="flex justify-end space-x-2 text-xs">
                <button onclick="closeModal('modalChmod')" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded">Cancel</button>
                <button onclick="submitChmod()" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium">Save Permissions</button>
            </div>
        </div>
    </div>

    <div id="modalUpload" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl w-[450px] p-4 border border-slate-200">
            <h3 class="font-bold text-slate-800 text-sm mb-3">Upload Files</h3>
            <div class="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-orange-500 transition cursor-pointer mb-4" onclick="document.getElementById('fileUploadInput').click()">
                <i class="fa-solid fa-cloud-arrow-up text-3xl text-slate-400 mb-2"></i>
                <p class="text-xs text-slate-600 font-medium">Click to browse or Drag & Drop files here</p>
                <input type="file" id="fileUploadInput" multiple class="hidden" onchange="submitUpload()">
            </div>
            <div class="flex justify-end text-xs">
                <button onclick="closeModal('modalUpload')" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded">Close</button>
            </div>
        </div>
    </div>

    <script>
        let currentPath = '';
        let allItems = [];
        let selectedItems = new Set();
        let contextTarget = null;

        function getFileIcon(item) {
            if (item.is_dir) return '<i class="fa-solid fa-folder text-amber-400 text-base"></i>';
            const ext = item.ext;
            if (['php'].includes(ext)) return '<i class="fa-brands fa-php text-indigo-500 text-base"></i>';
            if (['html', 'htm'].includes(ext)) return '<i class="fa-brands fa-html5 text-orange-500 text-base"></i>';
            if (['css'].includes(ext)) return '<i class="fa-brands fa-css3-alt text-blue-500 text-base"></i>';
            if (['js', 'ts'].includes(ext)) return '<i class="fa-brands fa-js text-yellow-500 text-base"></i>';
            if (['json', 'sql', 'xml'].includes(ext)) return '<i class="fa-solid fa-database text-teal-500 text-base"></i>';
            if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return '<i class="fa-solid fa-file-image text-emerald-500 text-base"></i>';
            if (['zip', 'rar', 'tar', 'gz'].includes(ext)) return '<i class="fa-solid fa-file-zipper text-purple-500 text-base"></i>';
            if (['pdf'].includes(ext)) return '<i class="fa-solid fa-file-pdf text-red-500 text-base"></i>';
            if (item.name.startsWith('.')) return '<i class="fa-solid fa-gear text-slate-500 text-base"></i>';
            return '<i class="fa-solid fa-file-lines text-slate-400 text-base"></i>';
        }

        async function loadDirectory(path = '') {
            currentPath = path;
            renderBreadcrumbs();
            const showHidden = document.getElementById('toggleHidden').checked;

            const res = await apiRequest({ action: 'list', path: currentPath, show_hidden: showHidden });
            if (res && res.success) {
                allItems = res.data;
                selectedItems.clear();
                updateToolbarButtons();
                renderTable(allItems);
            }
        }

        function renderTable(items) {
            const tbody = document.getElementById('fileListTable');
            tbody.innerHTML = '';

            if (items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400 text-xs"><i class="fa-solid fa-folder-open text-2xl mb-1 block"></i>This folder is empty</td></tr>`;
                return;
            }

            items.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-50 cursor-pointer transition select-none';
                tr.dataset.name = item.name;

                tr.innerHTML = `
                    <td class="py-2 px-4"><input type="checkbox" class="row-checkbox rounded text-orange-500" value="${item.name}" onchange="toggleSelect('${item.name}', this)"></td>
                    <td class="py-2 px-4 flex items-center space-x-2.5" onclick="handleItemClick('${item.name}', ${item.is_dir})">
                        ${getFileIcon(item)}
                        <span class="font-medium text-slate-700 hover:text-orange-600">${item.name}</span>
                    </td>
                    <td class="py-2 px-4 text-slate-500">${item.size}</td>
                    <td class="py-2 px-4 text-slate-500">${item.mtime}</td>
                    <td class="py-2 px-4 font-mono text-slate-500">${item.perms}</td>
                `;

                tr.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    showContextMenu(e.pageX, e.pageY, item);
                });

                tbody.appendChild(tr);
            });
        }

        function renderBreadcrumbs() {
            const bc = document.getElementById('breadcrumb');
            const parts = currentPath ? currentPath.split('/') : [];
            let html = `<span onclick="navigateTo('')" class="cursor-pointer hover:text-white">public_html</span>`;
            let accum = '';

            parts.forEach((p, idx) => {
                if (!p) return;
                accum += (accum ? '/' : '') + p;
                const pathTarget = accum;
                html += ` <i class="fa-solid fa-chevron-right text-[9px] text-slate-500"></i> <span onclick="navigateTo('${pathTarget}')" class="cursor-pointer hover:text-white">${p}</span>`;
            });
            bc.innerHTML = html;
        }

        function navigateTo(path) {
            loadDirectory(path);
        }

        function handleItemClick(name, isDir) {
            if (isDir) {
                const newPath = currentPath ? `${currentPath}/${name}` : name;
                loadDirectory(newPath);
            } else {
                openCodeEditor(name);
            }
        }

        function filterFiles() {
            const query = document.getElementById('searchInput').value.toLowerCase();
            const filtered = allItems.filter(i => i.name.toLowerCase().includes(query));
            renderTable(filtered);
        }

        function toggleSelect(name, chk) {
            if (chk.checked) selectedItems.add(name);
            else selectedItems.delete(name);
            updateToolbarButtons();
        }

        function toggleSelectAll(master) {
            const checkboxes = document.querySelectorAll('.row-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = master.checked;
                if (master.checked) selectedItems.add(cb.value);
                else selectedItems.delete(cb.value);
            });
            updateToolbarButtons();
        }

        function updateToolbarButtons() {
            const hasSelection = selectedItems.size > 0;
            document.getElementById('btnDownload').disabled = selectedItems.size !== 1;
            document.getElementById('btnDelete').disabled = !hasSelection;
            document.getElementById('btnCompress').disabled = !hasSelection;
        }

        function openCompressModal() {
            if (selectedItems.size === 0) return;
            const zipName = prompt('Enter archive name:', 'archive.zip');
            if (!zipName) return;
            compressSelected(zipName);
        }

        async function compressSelected(zipName) {
            const items = Array.from(selectedItems);
            const res = await apiRequest({ action: 'compress', path: currentPath, items: JSON.stringify(items), zip_name: zipName });
            if (res && res.success) loadDirectory(currentPath);
        }

        function showContextMenu(x, y, item) {
            contextTarget = item;
            const cm = document.getElementById('contextMenu');
            document.getElementById('cmExtract').style.display = (item.ext === 'zip') ? 'flex' : 'none';
            document.getElementById('cmEdit').style.display = item.is_dir ? 'none' : 'flex';
            document.getElementById('cmDownload').style.display = item.is_dir ? 'none' : 'flex';

            cm.style.left = `${x}px`;
            cm.style.top = `${y}px`;
            cm.style.display = 'block';
        }

        document.addEventListener('click', () => {
            document.getElementById('contextMenu').style.display = 'none';
        });

        function contextAction(type) {
            if (!contextTarget) return;
            const item = contextTarget;
            const relPath = currentPath ? `${currentPath}/${item.name}` : item.name;

            if (type === 'edit') openCodeEditor(item.name);
            if (type === 'download') window.location.href = `?download=${encodeURIComponent(relPath)}`;
            if (type === 'delete') deleteItem(item.name);
            if (type === 'chmod') openChmodModal(item);
            if (type === 'rename') renameItem(item.name);
            if (type === 'extract') extractZip(item.name);
        }

        async function openCodeEditor(name) {
            const relPath = currentPath ? `${currentPath}/${name}` : name;
            const res = await apiRequest({ action: 'read_file', path: relPath });
            if (res && res.success) {
                document.getElementById('editorFilename').innerText = name;
                document.getElementById('editorTextarea').value = res.content;
                openModal('modalEditor');
            }
        }

        async function saveFileContent() {
            const filename = document.getElementById('editorFilename').innerText;
            const relPath = currentPath ? `${currentPath}/${filename}` : filename;
            const content = document.getElementById('editorTextarea').value;

            const res = await apiRequest({ action: 'save_file', path: relPath, content: content });
            if (res && res.success) alert('File saved successfully!');
        }

        async function submitCreateFile() {
            const name = document.getElementById('newFileName').value;
            const res = await apiRequest({ action: 'create_file', path: currentPath, name: name });
            if (res && res.success) {
                closeModal('modalNewFile');
                document.getElementById('newFileName').value = '';
                loadDirectory(currentPath);
            }
        }

        async function submitCreateFolder() {
            const name = document.getElementById('newFolderName').value;
            const res = await apiRequest({ action: 'create_folder', path: currentPath, name: name });
            if (res && res.success) {
                closeModal('modalNewFolder');
                document.getElementById('newFolderName').value = '';
                loadDirectory(currentPath);
            }
        }

        function openChmodModal(item) {
            document.getElementById('chmodVal').value = item.perms;
            const p = item.perms.slice(-3);
            const setBoxes = (char, rId, wId, xId) => {
                const num = parseInt(char);
                document.getElementById(rId).checked = (num & 4) !== 0;
                document.getElementById(wId).checked = (num & 2) !== 0;
                document.getElementById(xId).checked = (num & 1) !== 0;
            };
            setBoxes(p[0], 'u_r', 'u_w', 'u_x');
            setBoxes(p[1], 'g_r', 'g_w', 'g_x');
            setBoxes(p[2], 'w_r', 'w_w', 'w_x');
            openModal('modalChmod');
        }

        function calcChmod() {
            const calc = (r, w, x) => (r ? 4 : 0) + (w ? 2 : 0) + (x ? 1 : 0);
            const u = calc(document.getElementById('u_r').checked, document.getElementById('u_w').checked, document.getElementById('u_x').checked);
            const g = calc(document.getElementById('g_r').checked, document.getElementById('g_w').checked, document.getElementById('g_x').checked);
            const w = calc(document.getElementById('w_r').checked, document.getElementById('w_w').checked, document.getElementById('w_x').checked);
            document.getElementById('chmodVal').value = `0${u}${g}${w}`;
        }

        async function submitChmod() {
            const relPath = currentPath ? `${currentPath}/${contextTarget.name}` : contextTarget.name;
            const mode = document.getElementById('chmodVal').value;
            const res = await apiRequest({ action: 'chmod', path: relPath, mode: mode });
            if (res && res.success) {
                closeModal('modalChmod');
                loadDirectory(currentPath);
            }
        }

        async function submitUpload() {
            const files = document.getElementById('fileUploadInput').files;
            if (!files.length) return;

            const formData = new FormData();
            formData.append('action', 'upload');
            formData.append('path', currentPath);
            for (let i = 0; i < files.length; i++) {
                formData.append('files[]', files[i]);
            }

            const response = await fetch('', { method: 'POST', body: formData });
            const res = await response.json();
            if (res.success) {
                closeModal('modalUpload');
                loadDirectory(currentPath);
            } else {
                alert(res.error || 'Upload failed');
            }
        }

        async function deleteItem(name) {
            if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
            const relPath = currentPath ? `${currentPath}/${name}` : name;
            const res = await apiRequest({ action: 'delete', path: relPath, skip_trash: false });
            if (res && res.success) loadDirectory(currentPath);
        }

        async function deleteSelected() {
            if (!confirm(`Delete ${selectedItems.size} selected item(s)?`)) return;
            for (let name of selectedItems) {
                const relPath = currentPath ? `${currentPath}/${name}` : name;
                await apiRequest({ action: 'delete', path: relPath, skip_trash: false });
            }
            loadDirectory(currentPath);
        }

        async function renameItem(name) {
            const newName = prompt(`Enter new name for "${name}":`, name);
            if (!newName || newName === name) return;
            const relPath = currentPath ? `${currentPath}/${name}` : name;
            const res = await apiRequest({ action: 'rename', path: relPath, new_name: newName });
            if (res && res.success) loadDirectory(currentPath);
        }

        async function openCompressModal() {
            if (!selectedItems.size) return;
            const zipName = prompt('Enter zip archive name (e.g. archive.zip):', 'archive.zip');
            if (!zipName) return;
            const items = Array.from(selectedItems);
            const res = await apiRequest({
                action: 'compress',
                path: currentPath,
                items: JSON.stringify(items),
                zip_name: zipName
            });
            if (res && res.success) {
                loadDirectory(currentPath);
            }
        }

        async function extractZip(name) {
            const relPath = currentPath ? `${currentPath}/${name}` : name;
            const res = await apiRequest({ action: 'extract', path: relPath });
            if (res && res.success) loadDirectory(currentPath);
        }

        async function apiRequest(data) {
            const formData = new FormData();
            for (const key in data) formData.append(key, data[key]);
            try {
                const response = await fetch('', { method: 'POST', body: formData });
                const json = await response.json();
                if (!json.success) alert(json.error || 'Request Failed');
                return json;
            } catch (err) {
                alert('Network Error');
            }
        }

        function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
        function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (!document.getElementById('modalEditor').classList.contains('hidden')) {
                    saveFileContent();
                }
            }
        });

        document.getElementById('toggleHidden').addEventListener('change', () => loadDirectory(currentPath));

        loadDirectory('');
    </script>
</body>
</html>
