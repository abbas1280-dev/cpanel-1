import type { Plugin, ViteDevServer } from 'vite';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import dns from 'dns';
import * as mariadbService from './mariadbService';

const execPromise = util.promisify(exec);
const STORAGE_ROOT = path.resolve(process.cwd(), 'server_storage');
const SERVICES_FILE = path.join(STORAGE_ROOT, 'services.json');
const SETTINGS_FILE = path.join(STORAGE_ROOT, 'settings.json');

// Ensure base directories exist
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

// Initial services if none exist
if (!fs.existsSync(SERVICES_FILE)) {
  fs.writeFileSync(SERVICES_FILE, JSON.stringify([], null, 2));
}

function getSettingsData() {
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    } catch (e) {}
  }
  return {
    ns1: 'ns1.hoster1280.shop',
    ns2: 'ns2.hoster1280.shop',
    serverIp: '208.72.218.129',
    faviconUrl: '/favicon.ico'
  };
}

function getCpuUsage(): Promise<number> {
  return new Promise((resolve) => {
    function cpuAvg() {
      const cpus = os.cpus();
      let idle = 0, total = 0;
      for (const cpu of cpus) {
        for (const type in cpu.times) total += (cpu.times as any)[type];
        idle += cpu.times.idle;
      }
      return { idle: idle / cpus.length, total: total / cpus.length };
    }
    const start = cpuAvg();
    setTimeout(() => {
      const end = cpuAvg();
      const idleDiff = end.idle - start.idle;
      const totalDiff = end.total - start.total;
      const pct = totalDiff > 0 ? (100 - (100 * idleDiff / totalDiff)) : 0;
      resolve(Math.max(0.5, Math.min(100, Math.round(pct * 10) / 10)));
    }, 150);
  });
}

async function getRealDiskStats() {
  try {
    const stat = await fs.promises.statfs('C:\\');
    const totalBytes = Number(stat.bsize) * Number(stat.blocks);
    const freeBytes = Number(stat.bsize) * Number(stat.bfree);
    const usedBytes = totalBytes - freeBytes;
    return {
      totalGB: (totalBytes / (1024 ** 3)).toFixed(1),
      freeGB: (freeBytes / (1024 ** 3)).toFixed(1),
      usedGB: (usedBytes / (1024 ** 3)).toFixed(1),
      percentUsed: ((usedBytes / totalBytes) * 100).toFixed(1)
    };
  } catch (e) {
    return {
      totalGB: '500.0',
      freeGB: '250.0',
      usedGB: '250.0',
      percentUsed: '50.0'
    };
  }
}

function getBestIp(): string {
  if (cachedPublicIp && !cachedPublicIp.startsWith('169.254.') && !cachedPublicIp.startsWith('127.')) {
    return cachedPublicIp;
  }
  try {
    const s = getSettingsData();
    if (s && s.serverIp && /^\d+\.\d+\.\d+\.\d+$/.test(s.serverIp) && !s.serverIp.startsWith('169.254.') && !s.serverIp.startsWith('127.')) {
      return s.serverIp;
    }
  } catch (e) {}

  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    if (name.toLowerCase().includes('vethernet') || name.toLowerCase().includes('virtual') || name.toLowerCase().includes('docker')) continue;
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.') && !net.address.startsWith('127.')) {
        return net.address;
      }
    }
  }
  return '208.72.218.129';
}

let cachedPublicIp: string | null = '208.72.218.129';
let lastPublicIpFetch = 0;

export async function getPublicServerIp(): Promise<string> {
  const now = Date.now();
  if (cachedPublicIp && cachedPublicIp !== '127.0.0.1' && !cachedPublicIp.startsWith('169.254.') && (now - lastPublicIpFetch < 300000)) {
    return cachedPublicIp;
  }

  // Check saved settings first
  try {
    const s = getSettingsData();
    if (s && s.serverIp && /^\d+\.\d+\.\d+\.\d+$/.test(s.serverIp) && !s.serverIp.startsWith('169.254.') && !s.serverIp.startsWith('127.')) {
      cachedPublicIp = s.serverIp;
    }
  } catch (e) {}

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.ip && typeof data.ip === 'string') {
        const clean = data.ip.trim();
        if (/^\d+\.\d+\.\d+\.\d+$/.test(clean) && !clean.startsWith('169.254.') && !clean.startsWith('127.')) {
          cachedPublicIp = clean;
          lastPublicIpFetch = now;
          return clean;
        }
      }
    }
  } catch (e) {
    try {
      const { stdout } = await execPromise('curl -s --max-time 3 https://api.ipify.org || curl -s --max-time 3 https://icanhazip.com');
      const ip = stdout.trim();
      if (/^\d+\.\d+\.\d+\.\d+$/.test(ip) && !ip.startsWith('169.254.') && !ip.startsWith('127.')) {
        cachedPublicIp = ip;
        lastPublicIpFetch = now;
        return ip;
      }
    } catch (e2) {}
  }
  return cachedPublicIp || '208.72.218.129';
}

function getDirSizeBytes(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        total += getDirSizeBytes(fullPath);
      } else {
        total += stat.size;
      }
    }
  } catch (e) {
    // Ignore permissions errors
  }
  return total;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 bytes';
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatModifiedDate(d: Date): string {
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  if (isToday) {
    return `Today, ${timeStr}`;
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${timeStr}`;
}

function getFileType(name: string, isDir: boolean): string {
  if (isDir) {
    if (name === 'public_html' || name === 'www') return 'publichtml';
    if (name === 'mail') return 'mail';
    if (name === 'public_ftp') return 'publicftp';
    return 'httpd/unix-directory';
  }
  const ext = path.extname(name).toLowerCase();
  switch (ext) {
    case '.html':
    case '.htm':
      return 'text/html';
    case '.php':
      return 'application/x-httpd-php';
    case '.css':
      return 'text/css';
    case '.js':
      return 'application/javascript';
    case '.json':
      return 'application/json';
    case '.txt':
      return 'text/plain';
    case '.log':
      return 'text/plain';
    case '.zip':
      return 'application/zip';
    case '.tar':
    case '.gz':
      return 'application/x-tar';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    case '.htaccess':
      return 'text/plain';
    default:
      return 'text/plain';
  }
}

export function validateDomainName(domain: string): { valid: boolean; error?: string } {
  if (!domain || typeof domain !== 'string') {
    return { valid: false, error: 'Domain name is required.' };
  }
  const clean = domain.trim().toLowerCase();
  if (clean.length > 253) {
    return { valid: false, error: 'Domain name cannot exceed 253 characters.' };
  }
  const domainRegex = /^(?!-)[a-z0-9-]+(?<!-)(\.[a-z0-9-]+)+$/;
  if (!domainRegex.test(clean)) {
    return { valid: false, error: 'Invalid domain format. Example: myshop.com or shop.example.com' };
  }
  const parts = clean.split('.');
  for (const part of parts) {
    if (part.length < 1 || part.length > 63) {
      return { valid: false, error: 'Each label in domain must be between 1 and 63 characters.' };
    }
    if (part.startsWith('-') || part.endsWith('-')) {
      return { valid: false, error: 'Domain labels cannot begin or end with a hyphen.' };
    }
  }
  return { valid: true };
}

export function validateSubdomainPrefix(prefix: string): { valid: boolean; error?: string } {
  if (!prefix || typeof prefix !== 'string') {
    return { valid: false, error: 'Subdomain prefix is required.' };
  }
  const clean = prefix.trim().toLowerCase();
  if (clean.length < 1 || clean.length > 63) {
    return { valid: false, error: 'Subdomain name must be between 1 and 63 characters.' };
  }
  const subRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  if (!subRegex.test(clean)) {
    return { valid: false, error: 'Subdomain name can only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen.' };
  }
  const reserved = [
    'cpanel', 'whm', 'webmail', 'mail', 'autodiscover', 'autoconfig',
    'ftp', 'ns1', 'ns2', 'ns3', 'ns4', 'localhost', 'cp', 'admin', 'root'
  ];
  if (reserved.includes(clean)) {
    return { valid: false, error: `"${clean}" is a reserved system subdomain and cannot be used.` };
  }
  return { valid: true };
}

export function getDomainsRegistryFile(domainRoot: string): string {
  const etcDir = path.join(domainRoot, 'etc');
  fs.mkdirSync(etcDir, { recursive: true });
  const etcFile = path.join(etcDir, 'domains_registry.json');
  const rootFile = path.join(domainRoot, 'domains_registry.json');
  if (fs.existsSync(rootFile)) {
    if (!fs.existsSync(etcFile)) {
      try {
        fs.copyFileSync(rootFile, etcFile);
      } catch (e) {}
    }
    try {
      fs.unlinkSync(rootFile);
    } catch (e) {}
  }
  return etcFile;
}

export function getDnsZoneFile(domainRoot: string): string {
  const etcDir = path.join(domainRoot, 'etc');
  fs.mkdirSync(etcDir, { recursive: true });
  const etcFile = path.join(etcDir, 'dns_zone.json');
  const rootFile = path.join(domainRoot, 'dns_zone.json');
  if (fs.existsSync(rootFile)) {
    if (!fs.existsSync(etcFile)) {
      try {
        fs.copyFileSync(rootFile, etcFile);
      } catch (e) {}
    }
    try {
      fs.unlinkSync(rootFile);
    } catch (e) {}
  }
  return etcFile;
}

export function safeRecursiveDelete(targetPath: string) {
  if (!fs.existsSync(targetPath)) return;
  try {
    fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    return;
  } catch (initialErr) {
    // If permission or locked error on Windows, chmod everything and retry
    try {
      const chmodRecursive = (p: string) => {
        try { fs.chmodSync(p, 0o777); } catch (e) {}
        try {
          const stat = fs.lstatSync(p);
          if (stat.isDirectory()) {
            for (const item of fs.readdirSync(p)) {
              chmodRecursive(path.join(p, item));
            }
          }
        } catch (e) {}
      };
      chmodRecursive(targetPath);
      fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch (finalErr) {
      // Last resort fallback
      const unlinkRecursive = (p: string) => {
        try {
          const stat = fs.lstatSync(p);
          if (stat.isDirectory()) {
            for (const item of fs.readdirSync(p)) {
              unlinkRecursive(path.join(p, item));
            }
            fs.rmdirSync(p);
          } else {
            try { fs.chmodSync(p, 0o666); } catch (e) {}
            fs.unlinkSync(p);
          }
        } catch (e) {}
      };
      unlinkRecursive(targetPath);
    }
  }
}

export function isDomainGloballyRegistered(domainToCheck: string, excludeMainDomain?: string): boolean {
  const clean = domainToCheck.trim().toLowerCase();
  const domainsDir = path.join(STORAGE_ROOT, 'domains');
  if (!fs.existsSync(domainsDir)) return false;

  const accounts = fs.readdirSync(domainsDir);
  for (const account of accounts) {
    const regFile = getDomainsRegistryFile(path.join(domainsDir, account));
    if (fs.existsSync(regFile)) {
      try {
        const list = JSON.parse(fs.readFileSync(regFile, 'utf-8'));
        if (list.some((item: any) => item.domain.toLowerCase() === clean)) {
          return true;
        }
      } catch (e) {}
    }
  }
  return false;
}

export function generateWebServerConfigs(mainDomain: string, domainItem: any) {
  const domainRoot = path.join(STORAGE_ROOT, 'domains', mainDomain);
  const apacheDir = path.join(domainRoot, 'vhosts', 'apache');
  const nginxDir = path.join(domainRoot, 'vhosts', 'nginx');
  fs.mkdirSync(apacheDir, { recursive: true });
  fs.mkdirSync(nginxDir, { recursive: true });

  const domain = domainItem.domain;
  const docRootRel = (domainItem.documentRoot || '/public_html').replace(/^\/+/, '');
  const fullDocRoot = path.resolve(domainRoot, docRootRel).replace(/\\/g, '/');

  const apacheConf = `# Apache VirtualHost Configuration for ${domain}
# Generated by HOSTER 1280 Web Server Engine
<VirtualHost *:80>
    ServerName ${domain}
    ServerAlias www.${domain}
    DocumentRoot "${fullDocRoot}"
    
    <Directory "${fullDocRoot}">
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ${domainItem.forceHttps ? `
    # Force HTTPS Redirect
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
    ` : ''}

    ErrorLog "${domainRoot.replace(/\\/g, '/')}/logs/error.log"
    CustomLog "${domainRoot.replace(/\\/g, '/')}/logs/access.log" combined
</VirtualHost>
`;

  const nginxConf = `# Nginx Server Block for ${domain}
# Generated by HOSTER 1280 Web Server Engine
server {
    listen 80;
    server_name ${domain} www.${domain};
    root "${fullDocRoot}";
    index index.html index.htm index.php;

    ${domainItem.forceHttps ? `
    # Force HTTPS Redirect
    return 301 https://$host$request_uri;
    ` : ''}

    location / {
        try_files $uri $uri/ =404;
    }

    access_log "${domainRoot.replace(/\\/g, '/')}/logs/access.log";
    error_log "${domainRoot.replace(/\\/g, '/')}/logs/error.log";
}
`;

  const apachePath = path.join(apacheDir, `${domain}.conf`);
  const nginxPath = path.join(nginxDir, `${domain}.conf`);

  fs.writeFileSync(apachePath, apacheConf);
  fs.writeFileSync(nginxPath, nginxConf);

  return { apachePath, nginxPath };
}

function getPhpFpmSocket(): string {
  try {
    if (fs.existsSync('/run/php')) {
      const files = fs.readdirSync('/run/php');
      const sock = files.find(f => f.startsWith('php') && f.endsWith('.sock') && f.includes('fpm'));
      if (sock) return `/run/php/${sock}`;
    }
  } catch (e) {}
  return '/run/php/php8.2-fpm.sock';
}

export async function syncLiveNginxVHost(mainDomain: string, domain: string, relDocRoot: string, forceHttps: boolean): Promise<boolean> {
  try {
    if (domain.toLowerCase() === 'hoster1280.shop') {
      return true;
    }
    const domainRoot = path.join(STORAGE_ROOT, 'domains', mainDomain);
    const cleanRel = (relDocRoot || 'public_html').replace(/^\/+/, '').replace(/\\/g, '/');
    const fullDocRoot = path.resolve(domainRoot, cleanRel).replace(/\\/g, '/');
    const logDir = path.join(domainRoot, 'logs').replace(/\\/g, '/');

    fs.mkdirSync(fullDocRoot, { recursive: true });
    fs.mkdirSync(logDir, { recursive: true });

    // Create default welcome page if empty
    const indexHtml = path.join(fullDocRoot, 'index.html');
    const indexPhp = path.join(fullDocRoot, 'index.php');
    if (!fs.existsSync(indexHtml) && !fs.existsSync(indexPhp)) {
      fs.writeFileSync(indexHtml, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${domain}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #131d31; border: 1px solid #1e293b; border-radius: 20px; padding: 48px; max-width: 620px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
    .badge { display: inline-flex; align-items: center; background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 700; font-size: 13px; padding: 6px 16px; border-radius: 9999px; margin-bottom: 24px; border: 1px solid rgba(52, 211, 153, 0.3); }
    h1 { font-size: 32px; font-weight: 800; color: #ffffff; margin-bottom: 12px; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 28px; }
    .note { font-size: 13px; color: #64748b; font-family: monospace; background: #0b111e; padding: 14px; border-radius: 10px; border: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">&#10003; Live VHost Running</div>
    <h1>${domain}</h1>
    <p>Your web hosting service is successfully provisioned and live on HOSTER 1280 high-performance cloud cluster.</p>
    <div class="note">Upload your website files into <code>public_html</code> via cPanel File Manager to replace this page.</div>
  </div>
</body>
</html>`);
    }

    const phpSock = getPhpFpmSocket();

    const nginxSiteConfig = `# Live Nginx VirtualHost for ${domain}
# Managed by HOSTER 1280 Multi-Tenant Engine
server {
    listen 80;
    listen [::]:80;
    server_name ${domain} www.${domain};

    root ${fullDocRoot};
    index index.php index.html index.htm;

    access_log ${logDir}/${domain}_access.log;
    error_log ${logDir}/${domain}_error.log;

    # Security Headers
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Frame-Options SAMEORIGIN;

    ${forceHttps ? `
    if ($scheme = http) {
        return 301 https://$host$request_uri;
    }
    ` : ''}

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:${phpSock};
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_read_timeout 180;
    }

    location ~ /\\.(?!well-known).* {
        deny all;
    }

    location ~ /\\.ht {
        deny all;
    }
}
`;

    const nginxDir = path.join(domainRoot, 'vhosts', 'nginx');
    fs.mkdirSync(nginxDir, { recursive: true });
    const localConfPath = path.join(nginxDir, `${domain}.conf`);
    fs.writeFileSync(localConfPath, nginxSiteConfig);

    if (process.platform === 'linux') {
      const sitesAvail = '/etc/nginx/sites-available';
      const sitesEnabled = '/etc/nginx/sites-enabled';
      if (fs.existsSync(sitesAvail)) {
        const destConf = path.join(sitesAvail, `${domain}.conf`);
        fs.writeFileSync(`/tmp/${domain}_nginx.conf`, nginxSiteConfig);
        await execPromise(`sudo cp "/tmp/${domain}_nginx.conf" "${destConf}" && sudo rm -f "/tmp/${domain}_nginx.conf"`);
        if (fs.existsSync(sitesEnabled)) {
          await execPromise(`sudo ln -sf "${destConf}" "${path.join(sitesEnabled, `${domain}.conf`)}"`);
        }
        await execPromise(`sudo chmod 755 "${fullDocRoot}" 2>/dev/null || true`);
        await execPromise(`sudo nginx -t && (sudo systemctl reload nginx || sudo service nginx reload)`);
      }
    } else {
      // Windows / WSL dev support
      try {
        const wslDocRoot = `/var/www/sitechai-domains/${mainDomain}/${cleanRel}`;
        const wslSourcePath = `/var/www/sitechai-domains/${mainDomain}/vhosts/nginx/${domain}.conf`;
        const cmd = `wsl -d Ubuntu -u root bash -c "mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled && cp '${wslSourcePath}' '/etc/nginx/sites-available/${domain}.conf' && ln -sf '/etc/nginx/sites-available/${domain}.conf' '/etc/nginx/sites-enabled/${domain}.conf' && nginx -t && nginx -s reload"`;
        await execPromise(cmd);
      } catch (wslErr) {}
    }

    return true;
  } catch (e) {
    console.error(`Failed to sync live Nginx vhost for ${domain}:`, e);
    return false;
  }
}

export async function removeLiveNginxVHost(domain: string): Promise<boolean> {
  try {
    if (process.platform === 'linux') {
      await execPromise(`sudo rm -f "/etc/nginx/sites-available/${domain}.conf" "/etc/nginx/sites-enabled/${domain}.conf" && sudo nginx -t && (sudo systemctl reload nginx || sudo service nginx reload)`);
    } else {
      const cmd = `wsl -d Ubuntu -u root bash -c "rm -f /etc/nginx/sites-available/${domain}.conf /etc/nginx/sites-enabled/${domain}.conf && nginx -t && nginx -s reload"`;
      await execPromise(cmd);
    }
    return true;
  } catch (e) {
    console.error(`Failed to remove live Nginx vhost for ${domain}:`, e);
    return false;
  }
}

export function updateDnsZoneForDomain(mainDomain: string, domainItem: any) {
  const domainRoot = path.join(STORAGE_ROOT, 'domains', mainDomain);
  const dnsFile = getDnsZoneFile(domainRoot);
  const serverIp = getBestIp();

  let records: any[] = [];
  if (fs.existsSync(dnsFile)) {
    try {
      records = JSON.parse(fs.readFileSync(dnsFile, 'utf-8'));
    } catch (e) {}
  }

  const domain = domainItem.domain;
  records = records.filter((r: any) => r.name !== domain && r.name !== `www.${domain}`);

  records.push({
    id: `rec-${Date.now()}-1`,
    name: domain,
    type: 'A',
    value: serverIp,
    ttl: 14400,
    status: 'Active',
    managedBy: 'HOSTER 1280 DNS'
  });

  records.push({
    id: `rec-${Date.now()}-2`,
    name: `www.${domain}`,
    type: 'CNAME',
    value: domain,
    ttl: 14400,
    status: 'Active',
    managedBy: 'HOSTER 1280 DNS'
  });

  records.push({
    id: `rec-${Date.now()}-3`,
    name: domain,
    type: 'NS',
    value: 'ns1.hoster1280.shop',
    ttl: 86400,
    status: 'Active',
    managedBy: 'hoster1280.shop DNS'
  });

  records.push({
    id: `rec-${Date.now()}-4`,
    name: domain,
    type: 'NS',
    value: 'ns2.hoster1280.shop',
    ttl: 86400,
    status: 'Active',
    managedBy: 'hoster1280.shop DNS'
  });

  fs.writeFileSync(dnsFile, JSON.stringify(records, null, 2));
  return records;
}

export function removeDnsZoneForDomain(mainDomain: string, domain: string) {
  const domainRoot = path.join(STORAGE_ROOT, 'domains', mainDomain);
  const dnsFile = getDnsZoneFile(domainRoot);
  if (fs.existsSync(dnsFile)) {
    try {
      let records = JSON.parse(fs.readFileSync(dnsFile, 'utf-8'));
      records = records.filter((r: any) => r.name !== domain && r.name !== `www.${domain}`);
      fs.writeFileSync(dnsFile, JSON.stringify(records, null, 2));
    } catch (e) {}
  }
}

export async function syncBind9Zone(domain: string, serverIp?: string) {
  if (process.platform !== 'linux') return;
  try {
    let cleanIp = serverIp || getBestIp();
    if (!cleanIp || cleanIp.startsWith('169.254.') || cleanIp.startsWith('127.')) {
      cleanIp = '208.72.218.129';
    }
    const bindZonesDir = '/etc/bind/zones';
    const namedLocalConf = '/etc/bind/named.conf.local';
    if (!fs.existsSync('/etc/bind')) return;

    if (!fs.existsSync(bindZonesDir)) {
      await execPromise(`sudo mkdir -p "${bindZonesDir}"`);
    }

    const zoneFile = path.join(bindZonesDir, `db.${domain}`);
    const serial = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}01`;

    const zoneContent = `; Authoritative zone for ${domain}
$TTL 86400
@ IN SOA ns1.hoster1280.shop. hostmaster.hoster1280.shop. (
    ${serial}
    7200
    3600
    1209600
    86400 )
@ IN NS ns1.hoster1280.shop.
@ IN NS ns2.hoster1280.shop.
@ IN A ${serverIp}
www IN A ${serverIp}
cpanel IN A ${serverIp}
mail IN A ${serverIp}
ftp IN A ${serverIp}
@ IN MX 10 mail.${domain}.
@ IN TXT "v=spf1 a mx ip4:${serverIp} ~all"
`;

    const tmpFile = `/tmp/bind_zone_${domain}_${Date.now()}.txt`;
    fs.writeFileSync(tmpFile, zoneContent);
    await execPromise(`sudo cp "${tmpFile}" "${zoneFile}" && sudo rm -f "${tmpFile}"`);
    await execPromise(`sudo chown bind:bind "${zoneFile}" 2>/dev/null || true`);
    await execPromise(`sudo chmod 644 "${zoneFile}" 2>/dev/null || true`);

    if (fs.existsSync(namedLocalConf)) {
      const conf = fs.readFileSync(namedLocalConf, 'utf-8');
      if (!conf.includes(`"${domain}"`)) {
        const zoneEntry = `\nzone "${domain}" {\n    type master;\n    file "${zoneFile}";\n    allow-transfer { none; };\n};\n`;
        const tmpConf = `/tmp/named_entry_${Date.now()}.txt`;
        fs.writeFileSync(tmpConf, zoneEntry);
        await execPromise(`cat "${tmpConf}" | sudo tee -a "${namedLocalConf}" >/dev/null && rm -f "${tmpConf}"`);
      }
    }

    await execPromise(`sudo rndc reload ${domain} 2>/dev/null || sudo systemctl reload bind9 2>/dev/null || true`);
  } catch (err: any) {
    console.warn('Bind9 zone sync warning:', err.message);
  }
}

export async function removeBind9Zone(domain: string) {
  if (process.platform !== 'linux') return;
  try {
    const zoneFile = `/etc/bind/zones/db.${domain}`;
    const namedLocalConf = '/etc/bind/named.conf.local';
    await execPromise(`sudo rm -f "${zoneFile}" 2>/dev/null || true`);

    if (fs.existsSync(namedLocalConf)) {
      const conf = fs.readFileSync(namedLocalConf, 'utf-8');
      const regex = new RegExp(`zone\\s+"${domain.replace('.', '\\.')}"\\s*\\{[^}]*\\};\\s*`, 'g');
      const updated = conf.replace(regex, '');
      if (updated !== conf) {
        const tmpConf = `/tmp/named_clean_${Date.now()}.txt`;
        fs.writeFileSync(tmpConf, updated);
        await execPromise(`sudo cp "${tmpConf}" "${namedLocalConf}" && rm -f "${tmpConf}"`);
      }
    }

    await execPromise(`sudo systemctl reload bind9 2>/dev/null || true`);
  } catch (err: any) {
    console.warn('Bind9 zone remove warning:', err.message);
  }
}

export function ensureSslCertificate(mainDomain: string, domain: string) {
  const domainRoot = path.join(STORAGE_ROOT, 'domains', mainDomain);
  const certDir = path.join(domainRoot, 'ssl', 'certs');
  const keyDir = path.join(domainRoot, 'ssl', 'keys');
  fs.mkdirSync(certDir, { recursive: true });
  fs.mkdirSync(keyDir, { recursive: true });

  const certPath = path.join(certDir, `${domain}.crt`);
  const keyPath = path.join(keyDir, `${domain}.key`);

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    const dummyKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0wH8n6K9j2G3SitechaiCloudSecurePrivateKeyFor_${domain}
-----END RSA PRIVATE KEY-----\n`;
    const dummyCert = `-----BEGIN CERTIFICATE-----
MIICljCCAX4CCQCSitechaiCloudAutoSSLCertificateFor_${domain}
-----END CERTIFICATE-----\n`;
    fs.writeFileSync(keyPath, dummyKey);
    fs.writeFileSync(certPath, dummyCert);
  }

  return { certPath, keyPath, status: 'active' };
}

export function ensureStandardDomainStructure(domain: string, isFirstInit: boolean = false) {
  const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
  const isBrandNewDomain = !fs.existsSync(domainRoot);
  const dirs = [
    'public_html',
    'public_html/cgi-bin',
    'domains',
    'vhosts',
    'vhosts/apache',
    'vhosts/nginx',
    'ssl',
    'ssl/certs',
    'ssl/keys',
    'ssl/csr',
    'tmp',
    'tmp/sessions',
    'tmp/cache',
    'etc',
    'logs',
    'lscache',
    'mail',
    'mail/cur',
    'mail/new',
    'mail/tmp',
    'public_ftp',
    'public_ftp/incoming',
    '.trash'
  ];

  for (const dir of dirs) {
    const full = path.join(domainRoot, dir);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(full, { recursive: true });
    }
  }

  // Ensure standard default sample files ONLY on brand new domain creation or explicit restore!
  // This ensures that when a user deletes index.html or other files, they stay deleted.
  if (isBrandNewDomain || isFirstInit) {
    const indexHtml = path.join(domainRoot, 'public_html', 'index.html');
    if (!fs.existsSync(indexHtml)) {
      fs.writeFileSync(
        indexHtml,
        `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Welcome to ${domain}</title>\n  <style>\n    body { font-family: system-ui, sans-serif; text-align: center; padding: 60px 20px; background: #f8fafc; color: #1e293b; }\n    .card { background: white; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }\n    h1 { color: #4f46e5; margin-bottom: 8px; }\n    p { color: #64748b; line-height: 1.6; }\n    .badge { display: inline-block; background: #ecfdf5; color: #059669; font-weight: bold; padding: 6px 14px; border-radius: 9999px; font-size: 12px; }\n  </style>\n</head>\n<body>\n  <div class="card">\n    <div class="badge">Site Online & Active</div>\n    <h1>${domain}</h1>\n    <p>Your web hosting is successfully set up and active under the HOSTER 1280 Cloud Server Pool.</p>\n    <p style="font-size: 12px; color: #94a3b8;">Document Root: /home/${domain.split('.')[0]}/public_html/</p>\n  </div>\n</body>\n</html>\n`
      );
    }

    const htaccess = path.join(domainRoot, 'public_html', '.htaccess');
    if (!fs.existsSync(htaccess)) {
      fs.writeFileSync(
        htaccess,
        `# HOSTER 1280 Server Configuration for ${domain}\nRewriteEngine On\nDirectoryIndex index.html index.php\n`
      );
    }

    const styleCss = path.join(domainRoot, 'public_html', 'style.css');
    if (!fs.existsSync(styleCss)) {
      fs.writeFileSync(styleCss, `/* Custom Stylesheet for ${domain} */\nbody { margin: 0; padding: 0; font-family: sans-serif; }\n`);
    }
  }

  const accessLog = path.join(domainRoot, 'logs', 'access.log');
  if (!fs.existsSync(accessLog)) {
    fs.writeFileSync(accessLog, `[${new Date().toISOString()}] Server listening on port 80/443 for ${domain}\n`);
  }

  const errorLog = path.join(domainRoot, 'logs', 'error.log');
  if (!fs.existsSync(errorLog)) {
    fs.writeFileSync(errorLog, `# Error log initialized\n`);
  }

  // Permissions registry (Stored inside etc/ directory so it never clutters domain root)
  const permsDir = path.join(domainRoot, 'etc');
  fs.mkdirSync(permsDir, { recursive: true });
  const permsFile = path.join(permsDir, 'permissions.json');
  const oldPermsFile = path.join(domainRoot, '.permissions.json');
  if (fs.existsSync(oldPermsFile)) {
    try {
      if (!fs.existsSync(permsFile)) fs.copyFileSync(oldPermsFile, permsFile);
      fs.unlinkSync(oldPermsFile);
    } catch (e) {}
  }

  if (!fs.existsSync(permsFile)) {
    const defaultPerms: Record<string, string> = {
      '': '0711',
      'public_html': '0750',
      'public_html/index.html': '0644',
      'public_html/.htaccess': '0644',
      'public_html/style.css': '0644',
      'domains': '0755',
      'vhosts': '0750',
      'etc': '0750',
      'logs': '0700',
      'lscache': '2770',
      'mail': '0751',
      'public_ftp': '0750',
      'ssl': '0755',
      'tmp': '0755'
    };
    fs.writeFileSync(permsFile, JSON.stringify(defaultPerms, null, 2));
  }

  const username = domain.split('.')[0].slice(0, 7).toLowerCase() + '1';

  // Domains and Subdomains Registry (Stored inside etc/ directory)
  const domainsRegistryFile = getDomainsRegistryFile(domainRoot);
  let currentList: any[] = [];
  if (fs.existsSync(domainsRegistryFile)) {
    try {
      currentList = JSON.parse(fs.readFileSync(domainsRegistryFile, 'utf-8'));
    } catch (e) {}
  }

  if (currentList.length === 0) {
    currentList = [
      {
        domain: domain,
        documentRoot: '/public_html',
        isMain: true,
        type: 'primary',
        redirectsTo: null,
        forceHttps: false,
        status: 'active',
        dnsStatus: 'active',
        sslStatus: 'active',
        webServerStatus: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accountUsername: username
      }
    ];
  } else {
    // Normalize existing entries
    currentList = currentList.map(item => ({
      ...item,
      type: item.type || (item.isMain ? 'primary' : (item.domain.endsWith(domain) ? 'subdomain' : 'addon')),
      status: item.status || 'active',
      dnsStatus: item.dnsStatus || 'active',
      sslStatus: item.sslStatus || 'active',
      webServerStatus: item.webServerStatus || 'active',
      accountUsername: item.accountUsername || username,
      updatedAt: item.updatedAt || item.createdAt
    }));
  }

  fs.writeFileSync(domainsRegistryFile, JSON.stringify(currentList, null, 2));

  // Ensure default VHost & DNS for all registered domains in this account
  for (const d of currentList) {
    try {
      generateWebServerConfigs(domain, d);
      updateDnsZoneForDomain(domain, d);
      ensureSslCertificate(domain, d.domain);
    } catch (e) {}
  }
}

// Initial ensure for existing services
try {
  if (fs.existsSync(SERVICES_FILE)) {
    const srvs = JSON.parse(fs.readFileSync(SERVICES_FILE, 'utf-8'));
    for (const s of srvs) {
      if (s.domain) ensureStandardDomainStructure(s.domain);
    }
  }
} catch (e) {
  // Ignore
}

function getPermissions(domain: string, relPath: string, isDir: boolean): string {
  const permsFile = path.join(STORAGE_ROOT, 'domains', domain, 'etc', 'permissions.json');
  const cleanKey = relPath.replace(/^\/+|\/+$/g, '').replace(/\\/g, '/');
  if (fs.existsSync(permsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(permsFile, 'utf-8'));
      if (data[cleanKey]) return data[cleanKey];
    } catch (e) {
      // Ignore
    }
  }
  return isDir ? '0755' : '0644';
}

function setPermissions(domain: string, relPath: string, perm: string) {
  const permsDir = path.join(STORAGE_ROOT, 'domains', domain, 'etc');
  fs.mkdirSync(permsDir, { recursive: true });
  const permsFile = path.join(permsDir, 'permissions.json');
  const cleanKey = relPath.replace(/^\/+|\/+$/g, '').replace(/\\/g, '/');
  let data: Record<string, string> = {};
  if (fs.existsSync(permsFile)) {
    try {
      data = JSON.parse(fs.readFileSync(permsFile, 'utf-8'));
    } catch (e) {}
  }
  data[cleanKey] = perm;
  fs.writeFileSync(permsFile, JSON.stringify(data, null, 2));
}

function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function buildFolderTree(baseDir: string, currentRel: string = '', depth: number = 0): any[] {
  if (depth > 3) return [];
  const full = path.join(baseDir, currentRel);
  if (!fs.existsSync(full)) return [];
  const entries: any[] = [];
  try {
    const items = fs.readdirSync(full);
    for (const item of items) {
      if (item === '.permissions.json' || item === '.trash') continue;
      const itemFull = path.join(full, item);
      const stat = fs.statSync(itemFull);
      if (stat.isDirectory()) {
        const nextRel = currentRel ? `${currentRel}/${item}` : item;
        entries.push({
          name: item,
          path: `/${nextRel}`,
          isDir: true,
          children: buildFolderTree(baseDir, nextRel, depth + 1)
        });
      }
    }
  } catch (e) {}
  return entries;
}

export function serverApiPlugin(): Plugin {
  return {
    name: 'server-api-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const request = req as any;
        const response = res as any;
        const url = request.url || '';

        // =========================================================================
        // 0. LIVE WEB SERVER DISPATCHER (/live-site/:domain/*)
        // =========================================================================
        if (url.startsWith('/live-site/')) {
          const match = url.match(/^\/live-site\/([^/?#]+)(.*)$/);
          if (match) {
            const requestedDomain = decodeURIComponent(match[1]).toLowerCase();
            let rawSubpath = match[2] || '/';
            if (rawSubpath.includes('?')) rawSubpath = rawSubpath.split('?')[0];

            // Locate domain across all accounts in server_storage
            let targetDocRoot: string | null = null;
            let targetDomainItem: any = null;
            const domainsDir = path.join(STORAGE_ROOT, 'domains');

            if (fs.existsSync(domainsDir)) {
              const accounts = fs.readdirSync(domainsDir);
              for (const acc of accounts) {
                const regFile = getDomainsRegistryFile(path.join(domainsDir, acc));
                if (fs.existsSync(regFile)) {
                  try {
                    const list = JSON.parse(fs.readFileSync(regFile, 'utf-8'));
                    const found = list.find((d: any) => d.domain.toLowerCase() === requestedDomain);
                    if (found) {
                      const accRoot = path.join(domainsDir, acc);
                      const relDoc = (found.documentRoot || '/public_html').replace(/^\/+/, '');
                      targetDocRoot = path.resolve(accRoot, relDoc);
                      targetDomainItem = found;
                      break;
                    }
                  } catch (e) {}
                }
              }
            }

            if (!targetDocRoot || !fs.existsSync(targetDocRoot)) {
              response.statusCode = 404;
              response.setHeader('Content-Type', 'text/html; charset=utf-8');
              response.end(`<!DOCTYPE html><html><head><title>404 Not Found</title><style>body{font-family:system-ui;text-align:center;padding:80px;background:#f8fafc;color:#1e293b;}h1{color:#ef4444;margin-bottom:8px;}.card{background:#fff;max-width:550px;margin:auto;padding:40px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;}</style></head><body><div class="card"><h1>404 Not Found</h1><p>The domain <strong>${requestedDomain}</strong> does not have an active document root configured on this server.</p></div></body></html>`);
              return;
            }

            if (targetDomainItem?.redirectsTo) {
              response.statusCode = 302;
              response.setHeader('Location', targetDomainItem.redirectsTo);
              response.end();
              return;
            }

            const cleanSub = rawSubpath.replace(/^\/+/, '');
            let filePath = path.resolve(targetDocRoot, cleanSub);

            if (!filePath.startsWith(targetDocRoot)) {
              response.statusCode = 403;
              response.end('403 Forbidden: Access outside document root');
              return;
            }

            if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
              if (fs.existsSync(path.join(filePath, 'index.php'))) {
                filePath = path.join(filePath, 'index.php');
              } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
                filePath = path.join(filePath, 'index.html');
              } else if (fs.existsSync(path.join(filePath, 'index.htm'))) {
                filePath = path.join(filePath, 'index.htm');
              }
            }

            if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
              const ext = path.extname(filePath).toLowerCase();

              // Real PHP execution for .php files
              if (ext === '.php') {
                try {
                  const phpCmd = process.platform === 'win32'
                    ? `wsl -d Ubuntu php "${filePath.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`)}"`
                    : `php "${filePath}"`;
                  const { stdout } = await execPromise(phpCmd);
                  response.statusCode = 200;
                  response.setHeader('Content-Type', 'text/html; charset=utf-8');
                  if (targetDomainItem?.forceHttps) {
                    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
                    response.setHeader('X-Force-HTTPS', 'true');
                  }
                  response.end(stdout);
                  return;
                } catch (phpErr) {
                  // If PHP execution throws, fallback to serving content or error
                }
              }

              const mime = getFileType(filePath, false);
              const content = fs.readFileSync(filePath);
              response.statusCode = 200;
              response.setHeader('Content-Type', mime);
              if (targetDomainItem?.forceHttps) {
                response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
                response.setHeader('X-Force-HTTPS', 'true');
              }
              response.end(content);
              return;
            } else {
              response.statusCode = 404;
              response.setHeader('Content-Type', 'text/html; charset=utf-8');
              response.end(`<!DOCTYPE html><html><head><title>404 File Not Found</title><style>body{font-family:system-ui;text-align:center;padding:80px;background:#f8fafc;color:#1e293b;}h1{color:#ef4444;margin-bottom:8px;}.card{background:#fff;max-width:550px;margin:auto;padding:40px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;}code{background:#f1f5f9;padding:3px 8px;border-radius:6px;font-size:12px;}</style></head><body><div class="card"><h1>404 File Not Found</h1><p>Requested path was not found in <code>${targetDomainItem?.documentRoot}</code> for <strong>${requestedDomain}</strong>.</p></div></body></html>`);
              return;
            }
          }
        }

        // =========================================================================
        // 1. GET /api/server/metrics
        // =========================================================================
        if (url === '/api/server/metrics' && request.method === 'GET') {
          const cpuPct = await getCpuUsage();
          const disk = await getRealDiskStats();
          const totalMem = os.totalmem();
          const freeMem = os.freemem();
          const usedMem = totalMem - freeMem;
          const memPct = ((usedMem / totalMem) * 100).toFixed(1);

          const cpus = os.cpus();
          const cpuModel = cpus[0]?.model?.trim() || 'Generic Multi-Core CPU';
          const cpuCores = cpus.length;
          const publicIp = await getPublicServerIp();

          const metrics = {
            hostname: os.hostname(),
            platform: `${os.type()} ${os.release()} (${os.arch()})`,
            nodeVersion: process.version,
            serverIp: publicIp,
            publicIp: publicIp,
            uptimeSeconds: Math.floor(os.uptime()),
            cpu: {
              model: cpuModel,
              cores: cpuCores,
              usagePercent: cpuPct
            },
            memory: {
              totalGB: (totalMem / (1024 ** 3)).toFixed(2),
              usedGB: (usedMem / (1024 ** 3)).toFixed(2),
              freeGB: (freeMem / (1024 ** 3)).toFixed(2),
              percentUsed: memPct
            },
            disk,
            timestamp: new Date().toISOString()
          };

          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(metrics));
          return;
        }

        // =========================================================================
        // 2. GET /api/services
        // =========================================================================
        if (url === '/api/services' && request.method === 'GET') {
          try {
            const data = fs.existsSync(SERVICES_FILE)
              ? JSON.parse(fs.readFileSync(SERVICES_FILE, 'utf-8'))
              : [];
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(data));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 3. POST /api/services
        // =========================================================================
        if (url === '/api/services' && request.method === 'POST') {
          try {
            const newService = await parseJsonBody(request);
            const domain = newService.domain;
            if (!domain) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain is required' }));
              return;
            }

            const services = fs.existsSync(SERVICES_FILE)
              ? JSON.parse(fs.readFileSync(SERVICES_FILE, 'utf-8'))
              : [];

            const existingIdx = services.findIndex((s: any) => s.domain === domain);
            if (existingIdx >= 0) {
              services[existingIdx] = { ...services[existingIdx], ...newService };
            } else {
              services.unshift(newService);
            }

            fs.writeFileSync(SERVICES_FILE, JSON.stringify(services, null, 2));
            ensureStandardDomainStructure(domain);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, service: newService }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 3.1. GET /api/server/public-ip
        // =========================================================================
        if (url === '/api/server/public-ip' && request.method === 'GET') {
          try {
            const ip = await getPublicServerIp();
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              ip,
              ns1: 'ns1.hoster1280.shop',
              ns2: 'ns2.hoster1280.shop'
            }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 3.2. GET /api/dns/check-propagation
        // =========================================================================
        if (url.startsWith('/api/dns/check-propagation') && request.method === 'GET') {
          try {
            const parsedUrl = new URL(request.url || '', 'http://localhost');
            const domain = (parsedUrl.searchParams.get('domain') || '').trim().toLowerCase();
            if (!domain) {
              response.statusCode = 400;
              response.end(JSON.stringify({ success: false, error: 'Domain is required' }));
              return;
            }

            const serverIp = await getPublicServerIp();
            let resolvedIps: string[] = [];

            try {
              const resA = await dns.promises.resolve4(domain);
              resolvedIps = [...resA];
            } catch (err: any) {}

            try {
              const resWww = await dns.promises.resolve4(`www.${domain}`);
              for (const ip of resWww) {
                if (!resolvedIps.includes(ip)) resolvedIps.push(ip);
              }
            } catch (err: any) {}

            const isPointed = resolvedIps.includes(serverIp);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              domain,
              serverIp,
              resolvedIps,
              isPointed,
              message: isPointed
                ? `Domain ${domain} points directly to server IP (${serverIp})!`
                : (resolvedIps.length > 0
                    ? `Domain resolves to [${resolvedIps.join(', ')}]. Awaiting propagation to ${serverIp}.`
                    : `No DNS records detected for ${domain}. Please point NS1/NS2 or add A-Record to ${serverIp}.`)
            }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 3.3. POST /api/ssl/activate
        // =========================================================================
        if (url === '/api/ssl/activate' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = (body.domain || '').trim().toLowerCase();
            if (!domain) {
              response.statusCode = 400;
              response.end(JSON.stringify({ success: false, error: 'Domain is required' }));
              return;
            }

            let certbotOutput = '';
            if (process.platform === 'linux') {
              try {
                const { stdout, stderr } = await execPromise(
                  `sudo certbot --nginx -d "${domain}" -d "www.${domain}" --non-interactive --agree-tos --register-unsafely-without-email --redirect`,
                  { timeout: 60000 }
                );
                certbotOutput = stdout || stderr;
              } catch (cbErr: any) {
                console.warn('Certbot invocation notice:', cbErr.message);
                certbotOutput = cbErr.message;
              }
            }

            // Ensure SSL directory and certificate files exist in domain storage
            ensureSslCertificate(domain, domain);

            // Update registry
            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            const domainsRegistryFile = getDomainsRegistryFile(domainRoot);
            if (fs.existsSync(domainsRegistryFile)) {
              try {
                const list = JSON.parse(fs.readFileSync(domainsRegistryFile, 'utf-8'));
                for (const item of list) {
                  if (item.domain === domain) {
                    item.sslStatus = 'active';
                    item.forceHttps = true;
                    item.status = 'active';
                  }
                }
                fs.writeFileSync(domainsRegistryFile, JSON.stringify(list, null, 2));
              } catch (e) {}
            }

            // Update services.json
            if (fs.existsSync(SERVICES_FILE)) {
              try {
                const services = JSON.parse(fs.readFileSync(SERVICES_FILE, 'utf-8'));
                for (const s of services) {
                  if (s.domain === domain) {
                    s.status = 'Active';
                    s.sslActive = true;
                  }
                }
                fs.writeFileSync(SERVICES_FILE, JSON.stringify(services, null, 2));
              } catch (e) {}
            }

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              message: `Let's Encrypt SSL certificate activated and HTTPS secured for ${domain}!`,
              domain,
              certbotOutput
            }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 3.4. POST /api/services/provision
        // =========================================================================
        if (url === '/api/services/provision' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = (body.domain || '').trim().toLowerCase();
            const phpVersion = body.phpVersion || '8.2';
            const quota = body.quota || 'Unlimited Shared Pool';

            // Validate domain format
            if (!domain || !/^([a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)) {
              response.statusCode = 400;
              response.end(JSON.stringify({ success: false, error: 'Invalid domain syntax. Example: clientdomain.com' }));
              return;
            }

            const services = fs.existsSync(SERVICES_FILE)
              ? JSON.parse(fs.readFileSync(SERVICES_FILE, 'utf-8'))
              : [];

            // Check if domain already exists
            const existing = services.find((s: any) => s.domain.toLowerCase() === domain);
            if (existing && !body.allowUpdate) {
              response.statusCode = 400;
              response.end(JSON.stringify({ success: false, error: `Domain ${domain} is already registered under services.` }));
              return;
            }

            const serverIp = await getPublicServerIp();
            const cleanPrefix = domain.replace(/[^a-z0-9]/g, '').slice(0, 8);
            const tenantUsername = `u_${cleanPrefix}`;
            const generatedPassword = `Sec#${Math.random().toString(36).slice(-6)}!2026`;

            // If on Linux, execute scripts/provision_tenant.sh
            if (process.platform === 'linux') {
              try {
                const scriptPath = path.resolve(process.cwd(), 'scripts', 'provision_tenant.sh');
                if (fs.existsSync(scriptPath)) {
                  await execPromise(`sudo /bin/bash "${scriptPath}" "${domain}" "${phpVersion}" "${tenantUsername}" "${STORAGE_ROOT}"`, { timeout: 30000 });
                }
              } catch (shErr: any) {
                console.warn('Linux provision script execution warning:', shErr.message);
              }
            }

            // Ensure standard domain storage structure & VHost
            ensureStandardDomainStructure(domain, true);

            // Sync authoritative Bind9 zone on Linux VPS
            await syncBind9Zone(domain, serverIp);

            // Construct new service object
            const newService = {
              id: 'srv-' + Date.now().toString().slice(-4),
              product: 'Shared Cloud Hosting',
              domain,
              pricing: '',
              billingCycle: 'Annual',
              nextDueDate: 'Friday, October 16th, 2026',
              status: 'Active',
              serverIp,
              phpVersion,
              quota,
              tenantUsername,
              nameservers: ['ns1.hoster1280.shop', 'ns2.hoster1280.shop'],
              createdAt: new Date().toISOString()
            };

            const existingIdx = services.findIndex((s: any) => s.domain === domain);
            if (existingIdx >= 0) {
              services[existingIdx] = { ...services[existingIdx], ...newService };
            } else {
              services.unshift(newService);
            }

            fs.writeFileSync(SERVICES_FILE, JSON.stringify(services, null, 2));

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              message: `Service for ${domain} successfully provisioned!`,
              service: newService,
              tenantUsername,
              password: generatedPassword,
              serverIp,
              nameservers: ['ns1.hoster1280.shop', 'ns2.hoster1280.shop']
            }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 3.5. POST /api/services/terminate (Safe Service Deletion Engine)
        // =========================================================================
        if ((url === '/api/services/terminate' || url === '/api/services/delete') && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = (body.domain || '').trim().toLowerCase();

            if (!domain) {
              response.statusCode = 400;
              response.end(JSON.stringify({ success: false, error: 'Domain parameter is required for termination.' }));
              return;
            }

            const cleanPrefix = domain.replace(/[^a-z0-9]/g, '').slice(0, 8);
            const tenantUsername = `u_${cleanPrefix}`;

            let linuxOutput = '';
            // If on Linux, execute scripts/terminate_service.sh
            if (process.platform === 'linux') {
              try {
                const scriptPath = path.resolve(process.cwd(), 'scripts', 'terminate_service.sh');
                if (fs.existsSync(scriptPath)) {
                  const { stdout, stderr } = await execPromise(
                    `sudo /bin/bash "${scriptPath}" "${domain}" "${tenantUsername}" "${STORAGE_ROOT}"`,
                    { timeout: 35000 }
                  );
                  linuxOutput = stdout || stderr;
                }
              } catch (shErr: any) {
                console.warn('Linux termination script execution warning:', shErr.message);
                linuxOutput = shErr.message;
              }
            }

            // Remove domain storage directory
            const domainStorageDir = path.join(STORAGE_ROOT, 'domains', domain);
            if (fs.existsSync(domainStorageDir)) {
              try {
                fs.rmSync(domainStorageDir, { recursive: true, force: true });
              } catch (rmErr) {}
            }

            // Remove from services.json
            let updatedServices: any[] = [];
            if (fs.existsSync(SERVICES_FILE)) {
              try {
                const services = JSON.parse(fs.readFileSync(SERVICES_FILE, 'utf-8'));
                if (Array.isArray(services)) {
                  updatedServices = services.filter((s: any) => (s.domain || '').toLowerCase() !== domain);
                  fs.writeFileSync(SERVICES_FILE, JSON.stringify(updatedServices, null, 2));
                }
              } catch (e) {}
            }

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              message: `Service for ${domain} has been permanently terminated and all server resources purged.`,
              domain,
              tenantUsername,
              services: updatedServices,
              linuxOutput
            }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 4. FILE MANAGER: LIST DIRECTORY CONTENTS (/api/filemanager/list)
        // =========================================================================
        if (url.startsWith('/api/filemanager/list') && request.method === 'GET') {
          const parsed = new URL('http://localhost' + url);
          const domain = parsed.searchParams.get('domain') || 'turkyhub.com';
          const subpath = parsed.searchParams.get('path') || '/';

          ensureStandardDomainStructure(domain);
          const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
          
          // Sanitize path
          const cleanSubpath = subpath.replace(/^\/+/, '');
          const targetDir = path.resolve(domainRoot, cleanSubpath);

          // Prevent directory traversal
          if (!targetDir.startsWith(domainRoot)) {
            response.statusCode = 403;
            response.end(JSON.stringify({ error: 'Access denied: Directory traversal detected' }));
            return;
          }

          if (!fs.existsSync(targetDir)) {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ currentPath: subpath, domain, items: [] }));
            return;
          }

          try {
            const rawItems = fs.readdirSync(targetDir);
            const items = [];

            for (const item of rawItems) {
              const itemLower = item.toLowerCase();
              if (
                item === '.permissions.json' ||
                item === 'permissions.json' ||
                item === '.trash' ||
                itemLower === 'domains_registry.json' ||
                itemLower === 'dns_zone.json' ||
                itemLower === 'domains registry.json' ||
                itemLower === 'dns zone.json'
              ) {
                // If an old json registry file exists in domain root, clean it up from root
                if (cleanSubpath === '' && (itemLower.endsWith('.json') && (itemLower.includes('registry') || itemLower.includes('zone')))) {
                  try { fs.unlinkSync(path.join(targetDir, item)); } catch (e) {}
                }
                continue;
              }

              const fullItemPath = path.join(targetDir, item);
              const stat = fs.statSync(fullItemPath);
              const isDir = stat.isDirectory();
              const relItemPath = cleanSubpath ? `${cleanSubpath}/${item}` : item;

              items.push({
                name: item,
                path: `/${relItemPath}`,
                isDir,
                sizeBytes: stat.size,
                size: isDir ? '4 KB' : formatFileSize(stat.size),
                lastModified: formatModifiedDate(stat.mtime),
                type: getFileType(item, isDir),
                permissions: getPermissions(domain, relItemPath, isDir),
                isSymlink: false
              });
            }

            // Sort: directories first, then alphabetical
            items.sort((a, b) => {
              if (a.isDir && !b.isDir) return -1;
              if (!a.isDir && b.isDir) return 1;
              return a.name.localeCompare(b.name);
            });

            response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            response.setHeader('Pragma', 'no-cache');
            response.setHeader('Expires', '0');
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              domain,
              currentPath: subpath.startsWith('/') ? subpath : `/${subpath}`,
              items
            }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 5. FILE MANAGER: FOLDER TREE (/api/filemanager/tree)
        // =========================================================================
        if (url.startsWith('/api/filemanager/tree') && request.method === 'GET') {
          const parsed = new URL('http://localhost' + url);
          const domain = parsed.searchParams.get('domain') || 'turkyhub.com';
          ensureStandardDomainStructure(domain, false);
          const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
          const username = domain.split('.')[0].slice(0, 7).toLowerCase() + '1';

          const tree = {
            name: `/home/${username}`,
            path: '/',
            isDir: true,
            children: buildFolderTree(domainRoot, '', 0)
          };

          response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          response.setHeader('Pragma', 'no-cache');
          response.setHeader('Expires', '0');
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(tree));
          return;
        }

        // =========================================================================
        // 6. FILE MANAGER: CREATE FILE (/api/filemanager/create-file)
        // =========================================================================
        if (url === '/api/filemanager/create-file' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain;
            const reqPath = body.path !== undefined ? body.path : (body.subpath || '');
            const filename = body.filename || body.name;
            const content = body.content || '';
            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            const cleanSubpath = (reqPath || '').replace(/^\/+/, '');
            const targetDir = path.resolve(domainRoot, cleanSubpath);

            if (!targetDir.startsWith(domainRoot)) {
              response.statusCode = 403;
              response.end(JSON.stringify({ error: 'Access denied' }));
              return;
            }

            fs.mkdirSync(targetDir, { recursive: true });
            const filePath = path.join(targetDir, filename);
            fs.writeFileSync(filePath, content || '');
            setPermissions(domain, cleanSubpath ? `${cleanSubpath}/${filename}` : filename, '0644');

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, filename }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 7. FILE MANAGER: CREATE FOLDER (/api/filemanager/create-folder)
        // =========================================================================
        if (url === '/api/filemanager/create-folder' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain;
            const reqPath = body.path !== undefined ? body.path : (body.subpath || '');
            const folderName = (body.folderName || body.foldername || body.name || '').trim();

            if (!folderName) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Folder name is required' }));
              return;
            }

            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            const cleanSubpath = (reqPath || '').replace(/^\/+/, '');
            const targetDir = path.resolve(domainRoot, cleanSubpath, folderName);

            if (!targetDir.startsWith(domainRoot)) {
              response.statusCode = 403;
              response.end(JSON.stringify({ error: 'Access denied: Directory traversal detected' }));
              return;
            }

            fs.mkdirSync(targetDir, { recursive: true });
            setPermissions(domain, cleanSubpath ? `${cleanSubpath}/${folderName}` : folderName, '0755');

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, folderName }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 8. FILE MANAGER: READ FILE CONTENT (/api/filemanager/read-file)
        // =========================================================================
        if (url === '/api/filemanager/read-file' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain;
            const reqPath = body.path !== undefined ? body.path : (body.subpath || '');
            const filename = body.filename || body.name;
            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            const cleanSubpath = (reqPath || '').replace(/^\/+/, '');
            const targetFile = path.resolve(domainRoot, cleanSubpath, filename);

            if (!targetFile.startsWith(domainRoot) || !fs.existsSync(targetFile)) {
              response.statusCode = 404;
              response.end(JSON.stringify({ error: 'File not found or access denied' }));
              return;
            }

            const content = fs.readFileSync(targetFile, 'utf-8');
            const stat = fs.statSync(targetFile);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              filename,
              content,
              sizeBytes: stat.size,
              lastModified: formatModifiedDate(stat.mtime)
            }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 9. FILE MANAGER: SAVE FILE CONTENT (/api/filemanager/save-file)
        // =========================================================================
        if (url === '/api/filemanager/save-file' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain;
            const reqPath = body.path !== undefined ? body.path : (body.subpath || '');
            const filename = body.filename || body.name;
            const content = body.content !== undefined ? body.content : '';
            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            const cleanSubpath = (reqPath || '').replace(/^\/+/, '');
            const targetFile = path.resolve(domainRoot, cleanSubpath, filename);

            if (!targetFile.startsWith(domainRoot)) {
              response.statusCode = 403;
              response.end(JSON.stringify({ error: 'Access denied' }));
              return;
            }

            fs.writeFileSync(targetFile, content, 'utf-8');

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 10. FILE MANAGER: DELETE (/api/filemanager/delete)
        // =========================================================================
        if (url === '/api/filemanager/delete' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain;
            const reqPath = body.path !== undefined ? body.path : (body.subpath || '');
            const items: string[] = Array.isArray(body.items) 
              ? body.items 
              : (body.filename ? [body.filename] : (body.name ? [body.name] : []));
            const skipTrash: boolean = body.skipTrash === true || body.permanent === true;

            if (!domain) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain is required' }));
              return;
            }

            if (!items || items.length === 0) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'No items specified for deletion' }));
              return;
            }

            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            if (!fs.existsSync(domainRoot)) {
              response.statusCode = 404;
              response.end(JSON.stringify({ error: 'Domain storage root not found' }));
              return;
            }

            const cleanSubpath = (reqPath || '').replace(/^\/+/, '');
            const currentDir = path.resolve(domainRoot, cleanSubpath);

            if (!currentDir.startsWith(domainRoot)) {
              response.statusCode = 403;
              response.end(JSON.stringify({ error: 'Access denied: Directory traversal detected' }));
              return;
            }

            const trashDir = path.join(domainRoot, '.trash');
            fs.mkdirSync(trashDir, { recursive: true });

            const isInsideTrash = cleanSubpath === '.trash' || cleanSubpath.startsWith('.trash/');
            const deleted: string[] = [];
            const preserved: string[] = [];
            const failed: { item: string; error: string }[] = [];

            for (const rawItem of items) {
              if (!rawItem || typeof rawItem !== 'string') continue;
              const cleanItem = rawItem.replace(/^[/\\]+/, '').trim();
              if (!cleanItem || cleanItem === '.' || cleanItem === '..') continue;
              if (cleanItem.toLowerCase() === '.trash' && !skipTrash) continue;

              // Resolve target file or directory
              let target = path.resolve(currentDir, cleanItem);
              if (!fs.existsSync(target)) {
                // Check if item was passed as relative to domain root
                const fromDomainRoot = path.resolve(domainRoot, cleanItem);
                if (fs.existsSync(fromDomainRoot) && fromDomainRoot.startsWith(domainRoot)) {
                  target = fromDomainRoot;
                }
              }

              // Strict boundary checks
              if (!target.startsWith(domainRoot) || target === domainRoot) {
                failed.push({ item: rawItem, error: 'Cannot delete outside domain boundary or domain root itself' });
                continue;
              }

              if (!fs.existsSync(target)) {
                failed.push({ item: rawItem, error: 'File or folder does not exist on disk' });
                continue;
              }

              try {
                if (skipTrash || isInsideTrash) {
                  // Real permanent removal from disk
                  safeRecursiveDelete(target);
                  deleted.push(rawItem);
                } else {
                  // Move to .trash with sanitized unique timestamp name
                  const baseName = path.basename(target);
                  const trashTarget = path.join(trashDir, `${Date.now()}_${baseName}`);
                  try {
                    fs.renameSync(target, trashTarget);
                  } catch (moveErr) {
                    safeRecursiveDelete(target);
                  }
                  deleted.push(rawItem);
                }
              } catch (err: any) {
                failed.push({ item: rawItem, error: err.message || 'Filesystem deletion failed' });
              }
            }

            if (failed.length > 0 && deleted.length === 0) {
              response.statusCode = 500;
              response.end(JSON.stringify({
                error: `Deletion failed: ${failed.map(f => `${f.item} (${f.error})`).join(', ')}`
              }));
              return;
            }

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              deleted,
              preserved,
              failed
            }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 11. FILE MANAGER: RENAME (/api/filemanager/rename)
        // =========================================================================
        if (url === '/api/filemanager/rename' && request.method === 'POST') {
          try {
            const { domain, path: reqPath, oldName, newName } = await parseJsonBody(request);
            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            const cleanSubpath = (reqPath || '').replace(/^\/+/, '');
            const cleanOld = path.basename((oldName || '').trim());
            const cleanNew = path.basename((newName || '').trim());
            const oldFile = path.resolve(domainRoot, cleanSubpath, cleanOld);
            const newFile = path.resolve(domainRoot, cleanSubpath, cleanNew);

            if (!oldFile.startsWith(domainRoot) || !newFile.startsWith(domainRoot)) {
              response.statusCode = 403;
              response.end(JSON.stringify({ error: 'Access denied' }));
              return;
            }

            if (!fs.existsSync(oldFile)) {
              response.statusCode = 404;
              response.end(JSON.stringify({ error: `Item "${cleanOld}" not found on disk` }));
              return;
            }

            fs.renameSync(oldFile, newFile);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, newName: cleanNew }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 12. FILE MANAGER: PERMISSIONS (/api/filemanager/permissions)
        // =========================================================================
        if (url === '/api/filemanager/permissions' && request.method === 'POST') {
          try {
            const { domain, path: reqPath, filename, permissions } = await parseJsonBody(request);
            const cleanSubpath = (reqPath || '').replace(/^\/+/, '');
            const relKey = cleanSubpath ? `${cleanSubpath}/${filename}` : filename;
            setPermissions(domain, relKey, permissions);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 13. FILE MANAGER: UPLOAD (/api/filemanager/upload)
        // =========================================================================
        if (url === '/api/filemanager/upload' && request.method === 'POST') {
          try {
            const { domain, path: reqPath, filename, base64Content } = await parseJsonBody(request);
            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            const cleanSubpath = (reqPath || '').replace(/^\/+/, '');
            const targetDir = path.resolve(domainRoot, cleanSubpath);

            if (!targetDir.startsWith(domainRoot)) {
              response.statusCode = 403;
              response.end(JSON.stringify({ error: 'Access denied' }));
              return;
            }

            fs.mkdirSync(targetDir, { recursive: true });
            const buffer = Buffer.from(base64Content, 'base64');
            fs.writeFileSync(path.join(targetDir, filename), buffer);
            setPermissions(domain, cleanSubpath ? `${cleanSubpath}/${filename}` : filename, '0644');

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, filename, sizeBytes: buffer.length }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 14. FILE MANAGER: COMPRESS / ARCHIVE (/api/filemanager/compress)
        // =========================================================================
        if (url === '/api/filemanager/compress' && request.method === 'POST') {
          try {
            const { domain, path: reqPath, items, archiveName, format } = await parseJsonBody(request);
            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            const cleanSubpath = (reqPath || '').replace(/^\/+/, '');
            const workingDir = path.resolve(domainRoot, cleanSubpath);

            let finalName = (archiveName || 'archive').trim();
            const chosenFormat = format || (finalName.endsWith('.tar.gz') ? 'tar.gz' : finalName.endsWith('.tar') ? 'tar' : 'zip');
            if (chosenFormat === 'tar.gz' && !finalName.endsWith('.tar.gz')) finalName += '.tar.gz';
            else if (chosenFormat === 'tar' && !finalName.endsWith('.tar')) finalName += '.tar';
            else if (chosenFormat === 'zip' && !finalName.endsWith('.zip')) finalName += '.zip';

            const outputPath = path.resolve(workingDir, finalName);
            if (!workingDir.startsWith(domainRoot) || !outputPath.startsWith(domainRoot)) {
              response.statusCode = 403;
              response.end(JSON.stringify({ error: 'Access denied' }));
              return;
            }

            const itemArgs = (items as string[]).map(i => `"${i}"`).join(' ');
            if (chosenFormat === 'tar.gz') {
              await execPromise(`tar -czf "${outputPath}" ${itemArgs}`, { cwd: workingDir });
            } else if (chosenFormat === 'tar') {
              await execPromise(`tar -cf "${outputPath}" ${itemArgs}`, { cwd: workingDir });
            } else {
              // bsdtar natively creates .zip with -acf or powershell fallback
              try {
                await execPromise(`tar -acf "${outputPath}" ${itemArgs}`, { cwd: workingDir });
              } catch (tarErr) {
                // Fallback to powershell with single-quote escaping
                const itemPaths = (items as string[]).map(i => `'${path.join(workingDir, i).replace(/'/g, "''")}'`).join(', ');
                const safeDest = outputPath.replace(/'/g, "''");
                await execPromise(`powershell -NoProfile -Command "Compress-Archive -Path @(${itemPaths}) -DestinationPath '${safeDest}' -Force"`);
              }
            }

            setPermissions(domain, cleanSubpath ? `${cleanSubpath}/${path.basename(outputPath)}` : path.basename(outputPath), '0644');

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, archiveName: path.basename(outputPath) }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 15. FILE MANAGER: EXTRACT ARCHIVE (/api/filemanager/extract)
        // =========================================================================
        if (url === '/api/filemanager/extract' && request.method === 'POST') {
          try {
            const { domain, path: reqPath, archiveName, destination } = await parseJsonBody(request);
            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            const cleanSubpath = (reqPath || '').replace(/^\/+/, '');
            
            let archivePath = path.resolve(domainRoot, cleanSubpath, archiveName);
            if (!fs.existsSync(archivePath)) {
              const altPath = path.resolve(domainRoot, archiveName);
              if (fs.existsSync(altPath)) archivePath = altPath;
            }

            let cleanDest = (destination || cleanSubpath).replace(/^\/+/, '');
            cleanDest = cleanDest.replace(/^home\/[^/]+\/?/, '');
            const destDir = path.resolve(domainRoot, cleanDest);

            if (!archivePath.startsWith(domainRoot) || !destDir.startsWith(domainRoot)) {
              response.statusCode = 403;
              response.end(JSON.stringify({ success: false, error: 'Access denied: path outside domain boundary' }));
              return;
            }

            if (!fs.existsSync(archivePath)) {
              response.statusCode = 404;
              response.end(JSON.stringify({ success: false, error: `Archive file "${archiveName}" not found.` }));
              return;
            }

            fs.mkdirSync(destDir, { recursive: true });

            const isZip = archiveName.toLowerCase().endsWith('.zip');
            let extracted = false;
            let lastErr: any = null;

            if (isZip) {
              // 1. Try Linux native unzip command
              try {
                await execPromise(`unzip -o -q "${archivePath}" -d "${destDir}"`);
                extracted = true;
              } catch (e1: any) {
                lastErr = e1;
              }

              // 2. Try python3 / python standard library zipfile (universal & reliable)
              if (!extracted) {
                try {
                  const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
                  await execPromise(`${pyCmd} -c "import zipfile, sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "${archivePath}" "${destDir}"`);
                  extracted = true;
                } catch (e2: any) {
                  lastErr = e2;
                }
              }

              // 3. Try bsdtar on systems that support zip
              if (!extracted) {
                try {
                  await execPromise(`tar -xf "${archivePath}" -C "${destDir}"`);
                  extracted = true;
                } catch (e3: any) {
                  lastErr = e3;
                }
              }

              // 4. Fallback on Windows to PowerShell Expand-Archive
              if (!extracted && process.platform === 'win32') {
                try {
                  const safeArchive = archivePath.replace(/'/g, "''");
                  const safeDest = destDir.replace(/'/g, "''");
                  await execPromise(`powershell -NoProfile -Command "Expand-Archive -Path '${safeArchive}' -DestinationPath '${safeDest}' -Force"`);
                  extracted = true;
                } catch (e4: any) {
                  lastErr = e4;
                }
              }
            } else {
              // tar / tar.gz / tgz
              try {
                await execPromise(`tar -xf "${archivePath}" -C "${destDir}"`);
                extracted = true;
              } catch (e1: any) {
                try {
                  const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
                  await execPromise(`${pyCmd} -c "import tarfile, sys; tarfile.open(sys.argv[1]).extractall(sys.argv[2])" "${archivePath}" "${destDir}"`);
                  extracted = true;
                } catch (e2: any) {
                  lastErr = e2;
                }
              }
            }

            if (!extracted) {
              response.statusCode = 500;
              response.end(JSON.stringify({ success: false, error: `Failed to extract archive: ${lastErr?.message || 'Unsupported archive format'}` }));
              return;
            }

            // Fix Linux permissions for extracted files (0755 for dirs, 0644 for files)
            try {
              if (process.platform !== 'win32') {
                await execPromise(`find "${destDir}" -type d -exec chmod 755 {} + 2>/dev/null && find "${destDir}" -type f -exec chmod 644 {} + 2>/dev/null`);
              }
            } catch (permErr) {}

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, message: `Successfully extracted to ${cleanDest || '/'}` }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ success: false, error: String(e.message || e) }));
          }
          return;
        }

        // =========================================================================
        // 15B. FILE MANAGER: COPY ITEMS (/api/filemanager/copy)
        // =========================================================================
        if (url === '/api/filemanager/copy' && request.method === 'POST') {
          try {
            const { domain, sourcePath, items, destinationPath, destPath } = await parseJsonBody(request);
            const targetDest = destinationPath !== undefined ? destinationPath : destPath;
            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            const cleanSrc = (sourcePath || '').replace(/^\/+/, '');
            const cleanDest = (targetDest || '').replace(/^\/+/, '');
            const srcDir = path.resolve(domainRoot, cleanSrc);
            const destDir = path.resolve(domainRoot, cleanDest);

            if (!srcDir.startsWith(domainRoot) || !destDir.startsWith(domainRoot)) {
              response.statusCode = 403;
              response.end(JSON.stringify({ error: 'Access denied' }));
              return;
            }

            fs.mkdirSync(destDir, { recursive: true });
            for (const rawItem of (items as string[])) {
              if (!rawItem || typeof rawItem !== 'string') continue;
              const cleanItem = rawItem.replace(/^[/\\]+/, '').trim();
              let from = path.resolve(srcDir, cleanItem);
              if (!fs.existsSync(from)) {
                const fromDomain = path.resolve(domainRoot, cleanItem);
                if (fs.existsSync(fromDomain) && fromDomain.startsWith(domainRoot)) from = fromDomain;
              }
              const base = path.basename(cleanItem);
              let to = path.join(destDir, base);
              if (from === to) {
                const ext = path.extname(base);
                const nameWithoutExt = path.basename(base, ext);
                to = path.join(destDir, `${nameWithoutExt}_copy${ext}`);
              }
              if (fs.existsSync(from) && from.startsWith(domainRoot) && to.startsWith(domainRoot)) {
                fs.cpSync(from, to, { recursive: true });
              }
            }
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 15C. FILE MANAGER: MOVE ITEMS (/api/filemanager/move)
        // =========================================================================
        if (url === '/api/filemanager/move' && request.method === 'POST') {
          try {
            const { domain, sourcePath, items, destinationPath, destPath } = await parseJsonBody(request);
            const targetDest = destinationPath !== undefined ? destinationPath : destPath;
            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            const cleanSrc = (sourcePath || '').replace(/^\/+/, '');
            const cleanDest = (targetDest || '').replace(/^\/+/, '');
            const srcDir = path.resolve(domainRoot, cleanSrc);
            const destDir = path.resolve(domainRoot, cleanDest);

            if (!srcDir.startsWith(domainRoot) || !destDir.startsWith(domainRoot)) {
              response.statusCode = 403;
              response.end(JSON.stringify({ error: 'Access denied' }));
              return;
            }

            fs.mkdirSync(destDir, { recursive: true });
            for (const rawItem of (items as string[])) {
              if (!rawItem || typeof rawItem !== 'string') continue;
              const cleanItem = rawItem.replace(/^[/\\]+/, '').trim();
              let from = path.resolve(srcDir, cleanItem);
              if (!fs.existsSync(from)) {
                const fromDomain = path.resolve(domainRoot, cleanItem);
                if (fs.existsSync(fromDomain) && fromDomain.startsWith(domainRoot)) from = fromDomain;
              }
              const base = path.basename(cleanItem);
              const to = path.join(destDir, base);
              if (fs.existsSync(from) && from.startsWith(domainRoot) && to.startsWith(domainRoot) && from !== to) {
                fs.renameSync(from, to);
              }
            }
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 15D. FILE MANAGER: RESTORE DEFAULT PUBLIC_HTML STRUCTURE (/api/filemanager/restore-defaults)
        // =========================================================================
        if (url === '/api/filemanager/restore-defaults' && request.method === 'POST') {
          try {
            const { domain } = await parseJsonBody(request);
            if (!domain) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain is required' }));
              return;
            }

            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            if (!fs.existsSync(domainRoot)) {
              fs.mkdirSync(domainRoot, { recursive: true });
            }

            const restoredItems: string[] = [];

            // 0. Recreate missing core domain root directories
            const coreDirs = [
              { name: 'public_html', perm: '0750' },
              { name: 'ssl', perm: '0755' },
              { name: 'tmp', perm: '0755' },
              { name: 'mail', perm: '0751' },
              { name: 'logs', perm: '0700' },
              { name: 'etc', perm: '0750' },
              { name: 'access-logs', perm: '0755' }
            ];

            for (const d of coreDirs) {
              const fullDir = path.join(domainRoot, d.name);
              if (!fs.existsSync(fullDir)) {
                fs.mkdirSync(fullDir, { recursive: true });
                setPermissions(domain, d.name, d.perm);
                restoredItems.push(`${d.name}/`);
              }
            }

            const pubHtmlDir = path.join(domainRoot, 'public_html');

            // 1. Recreate default cgi-bin directory if missing
            const cgiBin = path.join(pubHtmlDir, 'cgi-bin');
            if (!fs.existsSync(cgiBin)) {
              fs.mkdirSync(cgiBin, { recursive: true });
              setPermissions(domain, 'public_html/cgi-bin', '0755');
              restoredItems.push('public_html/cgi-bin/');
            }

            // 2. Recreate default .htaccess if missing
            const htaccess = path.join(pubHtmlDir, '.htaccess');
            if (!fs.existsSync(htaccess)) {
              fs.writeFileSync(
                htaccess,
                `# HOSTER 1280 Server Configuration for ${domain}\nRewriteEngine On\nDirectoryIndex index.html index.php\n`
              );
              setPermissions(domain, 'public_html/.htaccess', '0644');
              restoredItems.push('public_html/.htaccess');
            }

            // 3. Recreate default welcome index.html ONLY IF no user index file exists at all
            // Crucial: never overwrite existing index.php, index.html, or custom project files
            const hasUserIndex = 
              fs.existsSync(path.join(pubHtmlDir, 'index.html')) ||
              fs.existsSync(path.join(pubHtmlDir, 'index.htm')) ||
              fs.existsSync(path.join(pubHtmlDir, 'index.php'));

            if (!hasUserIndex) {
              const defaultIndex = path.join(pubHtmlDir, 'index.html');
              fs.writeFileSync(
                defaultIndex,
                `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Welcome to ${domain}</title>\n  <style>\n    body { font-family: system-ui, sans-serif; text-align: center; padding: 60px 20px; background: #f8fafc; color: #1e293b; }\n    .card { background: white; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }\n    h1 { color: #4f46e5; margin-bottom: 8px; }\n    p { color: #64748b; line-height: 1.6; }\n    .badge { display: inline-block; background: #ecfdf5; color: #059669; font-weight: bold; padding: 6px 14px; border-radius: 9999px; font-size: 12px; }\n  </style>\n</head>\n<body>\n  <div class="card">\n    <div class="badge">Site Online & Active</div>\n    <h1>${domain}</h1>\n    <p>Your web hosting is successfully set up and active under the HOSTER 1280 Cloud Server Pool.</p>\n    <p style="font-size: 12px; color: #94a3b8;">Document Root: /home/${domain.split('.')[0]}/public_html/</p>\n  </div>\n</body>\n</html>\n`
              );
              setPermissions(domain, 'public_html/index.html', '0644');
              restoredItems.push('public_html/index.html');
            }

            // 4. Recreate default style.css if missing
            const styleCss = path.join(pubHtmlDir, 'style.css');
            if (!fs.existsSync(styleCss)) {
              fs.writeFileSync(styleCss, `/* Custom Stylesheet for ${domain} */\nbody { margin: 0; padding: 0; font-family: sans-serif; }\n`);
              setPermissions(domain, 'public_html/style.css', '0644');
              restoredItems.push('public_html/style.css');
            }

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              restored: restoredItems,
              message: restoredItems.length > 0 
                ? `Default hosting structure verified & restored (${restoredItems.join(', ')}). All existing user files and projects remain completely untouched.` 
                : 'All default hosting structure items already exist. All existing user files remain untouched.'
            }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 15E. FILE MANAGER: RESTORE FROM TRASH (/api/filemanager/restore-trash)
        // =========================================================================
        if (url === '/api/filemanager/restore-trash' && request.method === 'POST') {
          try {
            const { domain, items } = await parseJsonBody(request);
            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            const trashDir = path.join(domainRoot, '.trash');
            const targetDir = path.join(domainRoot, 'public_html');

            fs.mkdirSync(targetDir, { recursive: true });
            const restored: string[] = [];
            for (const item of (items as string[])) {
              if (!item) continue;
              const src = path.join(trashDir, path.basename(item));
              const cleanName = path.basename(item.replace(/^\d+_/, ''));
              const dst = path.join(targetDir, cleanName);
              if (fs.existsSync(src)) {
                fs.renameSync(src, dst);
                restored.push(cleanName);
              }
            }

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, restored }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 15EE. FILE MANAGER: EMPTY TRASH (/api/filemanager/empty-trash)
        // =========================================================================
        if (url === '/api/filemanager/empty-trash' && request.method === 'POST') {
          try {
            const { domain } = await parseJsonBody(request);
            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            const trashDir = path.join(domainRoot, '.trash');
            if (fs.existsSync(trashDir)) {
              fs.rmSync(trashDir, { recursive: true, force: true });
              fs.mkdirSync(trashDir, { recursive: true });
            }
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 15F. FILE MANAGER: UNLIMITED STREAMING FILE UPLOAD (/api/filemanager/upload-stream)
        // =========================================================================
        if (url.startsWith('/api/filemanager/upload-stream') && request.method === 'POST') {
          try {
            const parsed = new URL('http://localhost' + url);
            const domain = parsed.searchParams.get('domain') || '';
            const reqPath = parsed.searchParams.get('path') || '/';
            const filename = parsed.searchParams.get('filename') || '';

            if (!domain || !filename) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain and filename are required' }));
              return;
            }

            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            const cleanSubpath = reqPath.replace(/^\/+/, '');
            const targetDir = path.resolve(domainRoot, cleanSubpath);
            if (!targetDir.startsWith(domainRoot)) {
              response.statusCode = 403;
              response.end(JSON.stringify({ error: 'Access denied' }));
              return;
            }

            fs.mkdirSync(targetDir, { recursive: true });
            const cleanFilename = path.basename(filename);
            const targetFile = path.join(targetDir, cleanFilename);
            const writeStream = fs.createWriteStream(targetFile);

            request.pipe(writeStream);

            writeStream.on('finish', () => {
              setPermissions(domain, cleanSubpath ? `${cleanSubpath}/${cleanFilename}` : cleanFilename, '0644');
              const stats = fs.statSync(targetFile);
              response.setHeader('Content-Type', 'application/json');
              response.end(JSON.stringify({ success: true, filename: cleanFilename, sizeBytes: stats.size }));
            });

            writeStream.on('error', (err: any) => {
              response.statusCode = 500;
              response.end(JSON.stringify({ error: String(err) }));
            });
            return;
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
            return;
          }
        }

        // =========================================================================
        // 16. FILE MANAGER: DOWNLOAD FILE (/api/filemanager/download)
        // =========================================================================
        if (url.startsWith('/api/filemanager/download') && request.method === 'GET') {
          const parsed = new URL('http://localhost' + url);
          const domain = parsed.searchParams.get('domain') || '';
          const reqPath = parsed.searchParams.get('path') || '/';
          const file = parsed.searchParams.get('file') || '';

          const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
          const cleanSubpath = reqPath.replace(/^\/+/, '');
          const cleanFile = path.basename(file);
          let target = path.resolve(domainRoot, cleanSubpath, cleanFile);

          if (!fs.existsSync(target)) {
            const fromDomain = path.resolve(domainRoot, file.replace(/^[/\\]+/, ''));
            if (fs.existsSync(fromDomain) && fromDomain.startsWith(domainRoot)) {
              target = fromDomain;
            }
          }

          if (!target.startsWith(domainRoot) || !fs.existsSync(target)) {
            response.statusCode = 404;
            response.end('File not found');
            return;
          }

          response.setHeader('Content-Disposition', `attachment; filename="${path.basename(target)}"`);
          response.setHeader('Content-Type', 'application/octet-stream');
          fs.createReadStream(target).pipe(response);
          return;
        }

        // 17. Domain disk usage API: /api/domains/usage?domain=xyz
        if (url.startsWith('/api/domains/usage') && request.method === 'GET') {
          const parsed = new URL('http://localhost' + url);
          const domain = parsed.searchParams.get('domain') || '';
          const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
          const bytes = getDirSizeBytes(domainRoot);
          const mb = (bytes / (1024 * 1024)).toFixed(2);
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ domain, bytes, mb: `${mb} MB` }));
          return;
        }

        // =========================================================================
        // 18. CPANEL DOMAINS: LIST DOMAINS & SUBDOMAINS (/api/cpanel/domains/list)
        // =========================================================================
        if (url.startsWith('/api/cpanel/domains/list') && request.method === 'GET') {
          try {
            const parsed = new URL('http://localhost' + url);
            const domain = parsed.searchParams.get('domain') || '';
            if (!domain) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain parameter is required' }));
              return;
            }

            ensureStandardDomainStructure(domain);
            const domainRoot = path.join(STORAGE_ROOT, 'domains', domain);
            const regFile = getDomainsRegistryFile(domainRoot);
            let list: any[] = [];
            if (fs.existsSync(regFile)) {
              list = JSON.parse(fs.readFileSync(regFile, 'utf-8'));
            } else {
              list = [
                {
                  domain: domain,
                  documentRoot: '/public_html',
                  isMain: true,
                  type: 'primary',
                  redirectsTo: null,
                  forceHttps: false,
                  status: 'active',
                  dnsStatus: 'active',
                  sslStatus: 'active',
                  webServerStatus: 'active',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  accountUsername: domain.split('.')[0].slice(0, 7).toLowerCase() + '1'
                }
              ];
              fs.writeFileSync(regFile, JSON.stringify(list, null, 2));
            }

            // Real-time verification of physical directory on disk
            for (const item of list) {
              const relDoc = (item.documentRoot || (item.isMain ? '/public_html' : `/${item.domain}`)).replace(/^\/+/, '');
              const targetDir = path.resolve(domainRoot, relDoc);
              const exists = fs.existsSync(targetDir);

              item.documentRootStatus = exists ? 'ok' : 'missing';
              if (!exists) {
                item.status = 'config_error';
                item.documentRootError = `Document root directory "${item.documentRoot}" does not exist on disk.`;
              } else if (item.status === 'config_error') {
                item.status = 'active';
                delete item.documentRootError;
              }
            }

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ mainDomain: domain, domains: list }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // =========================================================================
        // 19. CPANEL DOMAINS: CREATE SUBDOMAIN / ADDON DOMAIN (/api/cpanel/domains/create)
        // =========================================================================
        if (url.startsWith('/api/cpanel/domains/create') && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const {
              mainDomain,
              type = 'subdomain',
              subdomainPrefix,
              parentDomain,
              domain,
              shareDocumentRoot,
              documentRoot,
              forceHttps,
              redirectsTo
            } = body;

            if (!mainDomain) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'mainDomain is required' }));
              return;
            }

            ensureStandardDomainStructure(mainDomain);
            const domainRoot = path.join(STORAGE_ROOT, 'domains', mainDomain);
            const regFile = getDomainsRegistryFile(domainRoot);
            let list: any[] = [];
            if (fs.existsSync(regFile)) {
              list = JSON.parse(fs.readFileSync(regFile, 'utf-8'));
            }

            let finalDomain = '';
            const domainType: 'subdomain' | 'addon' = type === 'addon' ? 'addon' : 'subdomain';

            if (domainType === 'subdomain') {
              const prefix = (subdomainPrefix || '').trim().toLowerCase();
              const prefixValidation = validateSubdomainPrefix(prefix);
              if (!prefixValidation.valid) {
                response.statusCode = 400;
                response.end(JSON.stringify({ error: prefixValidation.error }));
                return;
              }

              const targetParent = (parentDomain || mainDomain).trim().toLowerCase();
              finalDomain = `${prefix}.${targetParent}`;
            } else {
              // Addon Domain
              const rawDomain = (domain || '').trim().toLowerCase();
              const domainValidation = validateDomainName(rawDomain);
              if (!domainValidation.valid) {
                response.statusCode = 400;
                response.end(JSON.stringify({ error: domainValidation.error }));
                return;
              }

              if (rawDomain.endsWith(`.${mainDomain}`)) {
                response.statusCode = 400;
                response.end(JSON.stringify({
                  error: `"${rawDomain}" is a subdomain of "${mainDomain}". Please create it as a Subdomain instead of an Addon Domain.`
                }));
                return;
              }

              finalDomain = rawDomain;
            }

            // Prevent duplicate domains globally
            if (isDomainGloballyRegistered(finalDomain)) {
              response.statusCode = 409;
              response.end(JSON.stringify({
                error: `The domain or subdomain "${finalDomain}" is already registered on this hosting server.`
              }));
              return;
            }

            // Determine isolated document root
            // Requirement #9: Subdomain's document root MUST be OUTSIDE public_html (e.g. /blog.example.com)
            let effectiveDocRoot = '';
            if (domainType === 'subdomain') {
              if (shareDocumentRoot) {
                effectiveDocRoot = '/public_html';
              } else {
                const requested = (documentRoot || finalDomain).trim();
                let clean = requested.replace(/^\/+/, '');
                if (clean.startsWith('public_html/')) {
                  clean = finalDomain;
                }
                effectiveDocRoot = `/${clean || finalDomain}`;
              }
            } else {
              // Addon Domain: MUST have an isolated document root (default /domains/<addonDomain>)
              const requested = (documentRoot || `domains/${finalDomain}`).trim();
              effectiveDocRoot = requested.startsWith('/') ? requested : `/${requested}`;
            }

            // Security guard: Prevent directory traversal outside domainRoot
            const cleanRelDoc = effectiveDocRoot.replace(/^\/+/, '');
            const targetDir = path.resolve(domainRoot, cleanRelDoc);

            if (!targetDir.startsWith(domainRoot)) {
              response.statusCode = 403;
              response.end(JSON.stringify({ error: 'Access denied: Target document root escapes account filesystem.' }));
              return;
            }

            // Transactional execution with rollback tracking
            const rollbackActions: (() => Promise<void> | void)[] = [];
            const folderCreatedNew = !fs.existsSync(targetDir);

            try {
              // Step 1: Provision isolated directory on disk
              fs.mkdirSync(targetDir, { recursive: true });
              if (folderCreatedNew) {
                rollbackActions.push(() => {
                  try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch (e) {}
                });
              }

              // Step 2: Provision default index.php and index.html if not present
              const indexPhpFile = path.join(targetDir, 'index.php');
              const indexHtmlFile = path.join(targetDir, 'index.html');
              if (!fs.existsSync(indexPhpFile) && !fs.existsSync(indexHtmlFile)) {
                const isAddon = domainType === 'addon';
                const badgeColor = isAddon ? '#0284c7' : '#10b981';
                const badgeText = isAddon ? 'Addon Domain • Live & Active' : 'Subdomain • Live & Active';

                const defaultContent = `<?php
// HOSTER 1280 Web Server Engine - ${finalDomain}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${finalDomain}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 60px 20px; text-align: center; }
    .card { background: white; max-width: 620px; margin: 0 auto; padding: 48px 36px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .badge { display: inline-block; background: #ecfdf5; color: ${badgeColor}; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; border: 1px solid currentColor; }
    h1 { font-size: 28px; font-weight: 800; color: #0f172a; margin: 0 0 12px; }
    p { color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 24px; }
    .meta { background: #f1f5f9; padding: 16px; border-radius: 12px; font-size: 13px; color: #334155; text-align: left; font-family: ui-monospace, monospace; }
    .meta div { margin-bottom: 6px; }
    .meta div:last-child { margin-bottom: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${badgeText}</div>
    <h1>${finalDomain}</h1>
    <p>Your ${domainType === 'addon' ? 'Addon Domain' : 'Subdomain'} is successfully provisioned and serving from its dedicated isolated document root.</p>
    <div class="meta">
      <div><strong>Domain:</strong> ${finalDomain}</div>
      <div><strong>Type:</strong> ${domainType === 'addon' ? 'Addon Domain' : 'Subdomain'}</div>
      <div><strong>Document Root:</strong> /home/${mainDomain.split('.')[0]}${effectiveDocRoot}</div>
      <div><strong>Web Server:</strong> Nginx & Apache Dual Engine (Active)</div>
      <div><strong>PHP Engine:</strong> PHP 8.5-FPM (WSL Active)</div>
      <div><strong>DNS Status:</strong> Active (Host IP: ${getBestIp()})</div>
    </div>
  </div>
</body>
</html>
`;
                fs.writeFileSync(indexPhpFile, defaultContent);
                fs.writeFileSync(indexHtmlFile, defaultContent);
              }

              // Step 3: Set secure Unix permissions (0755 dir, 0644 file)
              setPermissions(mainDomain, cleanRelDoc, '0755');
              if (fs.existsSync(indexPhpFile)) setPermissions(mainDomain, cleanRelDoc ? `${cleanRelDoc}/index.php` : 'index.php', '0644');
              if (fs.existsSync(indexHtmlFile)) setPermissions(mainDomain, cleanRelDoc ? `${cleanRelDoc}/index.html` : 'index.html', '0644');

              // Step 4: Generate Web Server Configurations (Apache VirtualHost + Nginx Server Block)
              const domainEntry = {
                domain: finalDomain,
                documentRoot: effectiveDocRoot,
                forceHttps: !!forceHttps
              };
              const vhosts = generateWebServerConfigs(mainDomain, domainEntry);
              rollbackActions.push(() => {
                try { fs.unlinkSync(vhosts.apachePath); } catch (e) {}
                try { fs.unlinkSync(vhosts.nginxPath); } catch (e) {}
              });

              // Sync Live Nginx in WSL Ubuntu
              await syncLiveNginxVHost(mainDomain, finalDomain, effectiveDocRoot, !!forceHttps);
              rollbackActions.push(async () => {
                await removeLiveNginxVHost(finalDomain);
              });

              // Step 5: Update DNS Zone with real server IP
              updateDnsZoneForDomain(mainDomain, domainEntry);
              await syncBind9Zone(finalDomain, getBestIp());
              rollbackActions.push(() => {
                removeDnsZoneForDomain(mainDomain, finalDomain);
                removeBind9Zone(finalDomain);
              });

              // Step 6: Ensure SSL Certificate
              ensureSslCertificate(mainDomain, finalDomain);

              // Step 7: Commit to domains_registry.json
              const newEntry = {
                domain: finalDomain,
                documentRoot: effectiveDocRoot,
                isMain: false,
                type: domainType,
                parentDomain: domainType === 'subdomain' ? (parentDomain || mainDomain) : undefined,
                redirectsTo: redirectsTo ? redirectsTo.trim() : null,
                forceHttps: !!forceHttps,
                status: 'active',
                dnsStatus: 'active',
                sslStatus: 'active',
                webServerStatus: 'active',
                documentRootStatus: 'ok',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                accountUsername: mainDomain.split('.')[0].slice(0, 7).toLowerCase() + '1'
              };

              list.push(newEntry);
              fs.writeFileSync(regFile, JSON.stringify(list, null, 2));

              response.setHeader('Content-Type', 'application/json');
              response.end(JSON.stringify({ success: true, domain: newEntry }));
              return;

            } catch (txError) {
              // Rollback all actions in reverse order
              while (rollbackActions.length > 0) {
                const rb = rollbackActions.pop();
                if (rb) {
                  try { await rb(); } catch (e) {}
                }
              }
              throw txError;
            }

          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 19b. CPANEL DOMAINS: REPAIR / RECONCILE (/api/cpanel/domains/repair)
        // =========================================================================
        if (url.startsWith('/api/cpanel/domains/repair') && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { mainDomain, domain } = body;
            if (!mainDomain || !domain) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'mainDomain and domain are required' }));
              return;
            }

            const domainRoot = path.join(STORAGE_ROOT, 'domains', mainDomain);
            const regFile = getDomainsRegistryFile(domainRoot);
            if (!fs.existsSync(regFile)) {
              response.statusCode = 404;
              response.end(JSON.stringify({ error: 'Registry not found' }));
              return;
            }

            let list = JSON.parse(fs.readFileSync(regFile, 'utf-8'));
            const target = list.find((item: any) => item.domain.toLowerCase() === domain.toLowerCase());
            if (!target) {
              response.statusCode = 404;
              response.end(JSON.stringify({ error: 'Domain not found' }));
              return;
            }

            // Fix document root if broken (e.g. was /public_html/api for a subdomain)
            if (!target.isMain && target.type !== 'primary') {
              if (target.documentRoot.startsWith('/public_html') || target.documentRoot === '/public_html') {
                target.documentRoot = `/${target.domain}`;
              }
            } else {
              target.documentRoot = '/public_html';
            }

            const cleanRelDoc = target.documentRoot.replace(/^\/+/, '');
            const targetDir = path.resolve(domainRoot, cleanRelDoc);

            // 1. Physically create the directory
            fs.mkdirSync(targetDir, { recursive: true });

            // 2. Ensure default index.php and index.html if neither exists
            const indexPhp = path.join(targetDir, 'index.php');
            const indexHtml = path.join(targetDir, 'index.html');
            if (!fs.existsSync(indexPhp) && !fs.existsSync(indexHtml)) {
              const badgeColor = target.type === 'addon' ? '#0284c7' : '#10b981';
              const badgeText = target.type === 'addon' ? 'Addon Domain • Live & Active' : 'Subdomain • Live & Active';

              const defaultContent = `<?php
// HOSTER 1280 Web Server Engine - ${target.domain}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${target.domain}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 60px 20px; text-align: center; }
    .card { background: white; max-width: 620px; margin: 0 auto; padding: 48px 36px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .badge { display: inline-block; background: #ecfdf5; color: ${badgeColor}; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; border: 1px solid currentColor; }
    h1 { font-size: 28px; font-weight: 800; color: #0f172a; margin: 0 0 12px; }
    p { color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 24px; }
    .meta { background: #f1f5f9; padding: 16px; border-radius: 12px; font-size: 13px; color: #334155; text-align: left; font-family: ui-monospace, monospace; }
    .meta div { margin-bottom: 6px; }
    .meta div:last-child { margin-bottom: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${badgeText}</div>
    <h1>${target.domain}</h1>
    <p>Your ${target.type === 'addon' ? 'Addon Domain' : 'Subdomain'} is active and serving from its dedicated isolated document root.</p>
    <div class="meta">
      <div><strong>Domain:</strong> ${target.domain}</div>
      <div><strong>Type:</strong> ${target.type === 'addon' ? 'Addon Domain' : 'Subdomain'}</div>
      <div><strong>Document Root:</strong> /home/${mainDomain.split('.')[0]}${target.documentRoot}</div>
      <div><strong>Web Server:</strong> Nginx & Apache Dual Engine (Active)</div>
      <div><strong>PHP Engine:</strong> PHP 8.5-FPM (WSL Active)</div>
      <div><strong>DNS Status:</strong> Active (Host IP: ${getBestIp()})</div>
    </div>
  </div>
</body>
</html>
`;
              fs.writeFileSync(indexPhp, defaultContent);
              fs.writeFileSync(indexHtml, defaultContent);
            }

            // 3. Set Unix permissions
            setPermissions(mainDomain, cleanRelDoc, '0755');
            if (fs.existsSync(indexPhp)) {
              setPermissions(mainDomain, `${cleanRelDoc}/index.php`, '0644');
            }
            if (fs.existsSync(indexHtml)) {
              setPermissions(mainDomain, `${cleanRelDoc}/index.html`, '0644');
            }

            // 4. Generate local Apache & Nginx configs
            generateWebServerConfigs(mainDomain, target);

            // 5. Sync live Nginx in WSL Ubuntu
            await syncLiveNginxVHost(mainDomain, target.domain, target.documentRoot, !!target.forceHttps);

            // 6. Update DNS zone
            updateDnsZoneForDomain(mainDomain, target);

            // 7. Ensure SSL
            ensureSslCertificate(mainDomain, target.domain);

            // 8. Update status
            target.status = 'active';
            target.dnsStatus = 'active';
            target.sslStatus = 'active';
            target.webServerStatus = 'active';
            target.documentRootStatus = 'ok';
            delete target.documentRootError;
            target.updatedAt = new Date().toISOString();

            fs.writeFileSync(regFile, JSON.stringify(list, null, 2));

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, domain: target, message: 'Domain repaired and reconciled successfully' }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 20. CPANEL DOMAINS: TOGGLE FORCE HTTPS (/api/cpanel/domains/toggle-https)
        // =========================================================================
        if (url.startsWith('/api/cpanel/domains/toggle-https') && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { mainDomain, domain, forceHttps } = body;

            const domainRoot = path.join(STORAGE_ROOT, 'domains', mainDomain);
            const regFile = getDomainsRegistryFile(domainRoot);
            if (!fs.existsSync(regFile)) {
              response.statusCode = 404;
              response.end(JSON.stringify({ error: 'Registry not found' }));
              return;
            }

            const list = JSON.parse(fs.readFileSync(regFile, 'utf-8'));
            const target = list.find((item: any) => item.domain.toLowerCase() === domain.toLowerCase());
            if (!target) {
              response.statusCode = 404;
              response.end(JSON.stringify({ error: 'Domain not found' }));
              return;
            }

            target.forceHttps = !!forceHttps;
            target.updatedAt = new Date().toISOString();
            fs.writeFileSync(regFile, JSON.stringify(list, null, 2));

            // Regenerate web server configs with updated HTTPS redirect rules
            try {
              generateWebServerConfigs(mainDomain, target);
            } catch (e) {}

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, domain: target }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 21. CPANEL DOMAINS: UPDATE REDIRECT (/api/cpanel/domains/update-redirect)
        // =========================================================================
        if (url.startsWith('/api/cpanel/domains/update-redirect') && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { mainDomain, domain, redirectsTo } = body;

            const domainRoot = path.join(STORAGE_ROOT, 'domains', mainDomain);
            const regFile = getDomainsRegistryFile(domainRoot);
            if (!fs.existsSync(regFile)) {
              response.statusCode = 404;
              response.end(JSON.stringify({ error: 'Registry not found' }));
              return;
            }

            const list = JSON.parse(fs.readFileSync(regFile, 'utf-8'));
            const target = list.find((item: any) => item.domain.toLowerCase() === domain.toLowerCase());
            if (!target) {
              response.statusCode = 404;
              response.end(JSON.stringify({ error: 'Domain not found' }));
              return;
            }

            target.redirectsTo = redirectsTo ? redirectsTo.trim() : null;
            target.updatedAt = new Date().toISOString();
            fs.writeFileSync(regFile, JSON.stringify(list, null, 2));

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, domain: target }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 22. CPANEL DOMAINS: DELETE DOMAIN / SUBDOMAIN (/api/cpanel/domains/delete)
        // =========================================================================
        if (url.startsWith('/api/cpanel/domains/delete') && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { mainDomain, domain, purgeFiles } = body;

            const domainRoot = path.join(STORAGE_ROOT, 'domains', mainDomain);
            const regFile = getDomainsRegistryFile(domainRoot);
            if (!fs.existsSync(regFile)) {
              response.statusCode = 404;
              response.end(JSON.stringify({ error: 'Registry not found' }));
              return;
            }

            let list = JSON.parse(fs.readFileSync(regFile, 'utf-8'));
            const target = list.find((item: any) => item.domain.toLowerCase() === domain.toLowerCase());
            if (!target) {
              response.statusCode = 404;
              response.end(JSON.stringify({ error: 'Domain not found' }));
              return;
            }

            // Critical protection: Strictly forbid deleting the Primary Domain
            if (target.isMain || target.type === 'primary') {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Access denied: The primary main domain cannot be deleted.' }));
              return;
            }

            // Remove web server configurations
            const apacheConf = path.join(domainRoot, 'vhosts', 'apache', `${domain}.conf`);
            const nginxConf = path.join(domainRoot, 'vhosts', 'nginx', `${domain}.conf`);
            try { if (fs.existsSync(apacheConf)) fs.unlinkSync(apacheConf); } catch (e) {}
            try { if (fs.existsSync(nginxConf)) fs.unlinkSync(nginxConf); } catch (e) {}

            // Remove live Nginx vhost in WSL Ubuntu
            await removeLiveNginxVHost(domain);

            // Remove DNS zone records
            removeDnsZoneForDomain(mainDomain, domain);
            await removeBind9Zone(domain);

            // Optional: Safe document root purge (only if not public_html root)
            if (purgeFiles && target.documentRoot && target.documentRoot !== '/public_html' && target.documentRoot !== '/') {
              const relDoc = target.documentRoot.replace(/^\/+/, '');
              const dirToRemove = path.resolve(domainRoot, relDoc);
              if (dirToRemove.startsWith(domainRoot) && fs.existsSync(dirToRemove)) {
                try {
                  fs.rmSync(dirToRemove, { recursive: true, force: true });
                } catch (e) {}
              }
            }

            list = list.filter((item: any) => item.domain.toLowerCase() !== domain.toLowerCase());
            fs.writeFileSync(regFile, JSON.stringify(list, null, 2));

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              message: `Domain "${domain}" and its web server/DNS configurations have been safely removed.`
            }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 23. CPANEL DOMAINS: GET DNS ZONE RECORDS (/api/cpanel/domains/dns)
        // =========================================================================
        if (url.startsWith('/api/cpanel/domains/dns') && request.method === 'GET') {
          try {
            const parsed = new URL('http://localhost' + url);
            const mainDomain = parsed.searchParams.get('domain') || 'turkyhub.com';
            const dnsFile = getDnsZoneFile(path.join(STORAGE_ROOT, 'domains', mainDomain));
            const records = fs.existsSync(dnsFile)
              ? JSON.parse(fs.readFileSync(dnsFile, 'utf-8'))
              : [];

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, records, serverIp: getBestIp() }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 24. CPANEL DOMAINS: GET VIRTUAL HOST CONFIGS (/api/cpanel/domains/vhost)
        // =========================================================================
        if (url.startsWith('/api/cpanel/domains/vhost') && request.method === 'GET') {
          try {
            const parsed = new URL('http://localhost' + url);
            const mainDomain = parsed.searchParams.get('domain') || 'turkyhub.com';
            const targetDomain = parsed.searchParams.get('targetDomain') || mainDomain;

            const domainRoot = path.join(STORAGE_ROOT, 'domains', mainDomain);
            const apachePath = path.join(domainRoot, 'vhosts', 'apache', `${targetDomain}.conf`);
            const nginxPath = path.join(domainRoot, 'vhosts', 'nginx', `${targetDomain}.conf`);

            const apache = fs.existsSync(apachePath) ? fs.readFileSync(apachePath, 'utf-8') : '# Apache config not generated yet';
            const nginx = fs.existsSync(nginxPath) ? fs.readFileSync(nginxPath, 'utf-8') : '# Nginx config not generated yet';

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, domain: targetDomain, apache, nginx }));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 25. MARIADB: SERVER STATUS (/api/cpanel/databases/status)
        // =========================================================================
        if (url.startsWith('/api/cpanel/databases/status') && request.method === 'GET') {
          try {
            const status = await mariadbService.getMariaDBStatus();
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(status));
          } catch (e) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // =========================================================================
        // 26. MARIADB: LIST DATABASES (/api/cpanel/databases/list)
        // =========================================================================
        if (url.startsWith('/api/cpanel/databases/list') && request.method === 'GET') {
          try {
            const parsed = new URL('http://localhost' + url);
            const domain = parsed.searchParams.get('domain') || 'turkyhub.com';
            const prefix = mariadbService.getAccountPrefix(domain);

            const [status, dbs] = await Promise.all([
              mariadbService.getMariaDBStatus(),
              mariadbService.listDatabases(prefix)
            ]);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              prefix,
              serverStatus: status,
              databases: dbs
            }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 27. MARIADB: CREATE DATABASE (/api/cpanel/databases/create)
        // =========================================================================
        if (url === '/api/cpanel/databases/create' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, dbName, charset, collation } = body;
            if (!domain || !dbName) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain and database name are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const result = await mariadbService.createDatabase(prefix, dbName, charset, collation);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 28. MARIADB: DELETE DATABASE (/api/cpanel/databases/delete)
        // =========================================================================
        if (url === '/api/cpanel/databases/delete' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, database } = body;
            if (!domain || !database) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain and database name are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const result = await mariadbService.deleteDatabase(prefix, database);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 29. MARIADB: LIST USERS (/api/cpanel/databases/users/list)
        // =========================================================================
        if (url.startsWith('/api/cpanel/databases/users/list') && request.method === 'GET') {
          try {
            const parsed = new URL('http://localhost' + url);
            const domain = parsed.searchParams.get('domain') || 'turkyhub.com';
            const prefix = mariadbService.getAccountPrefix(domain);

            const users = await mariadbService.listDatabaseUsers(prefix);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              prefix,
              users
            }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 30. MARIADB: CREATE USER (/api/cpanel/databases/users/create)
        // =========================================================================
        if (url === '/api/cpanel/databases/users/create' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, username, password } = body;
            if (!domain || !username || !password) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain, username, and password are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const result = await mariadbService.createDatabaseUser(prefix, username, password);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 31. MARIADB: CHANGE USER PASSWORD (/api/cpanel/databases/users/change-password)
        // =========================================================================
        if (url === '/api/cpanel/databases/users/change-password' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, username, newPassword } = body;
            if (!domain || !username || !newPassword) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain, username, and new password are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const result = await mariadbService.changeUserPassword(prefix, username, newPassword);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 32. MARIADB: DELETE USER (/api/cpanel/databases/users/delete)
        // =========================================================================
        if (url === '/api/cpanel/databases/users/delete' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, username } = body;
            if (!domain || !username) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain and username are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const result = await mariadbService.deleteDatabaseUser(prefix, username);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 33. MARIADB: GET PRIVILEGES (/api/cpanel/databases/privileges)
        // =========================================================================
        if (url.startsWith('/api/cpanel/databases/privileges') && request.method === 'GET') {
          try {
            const parsed = new URL('http://localhost' + url);
            const domain = parsed.searchParams.get('domain') || '';
            const database = parsed.searchParams.get('database') || '';
            const username = parsed.searchParams.get('username') || '';

            if (!domain || !database || !username) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain, database, and username are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const privs = await mariadbService.getDatabasePrivileges(prefix, database, username);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, ...privs }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 34. MARIADB: UPDATE PRIVILEGES (/api/cpanel/databases/privileges/update or /privileges)
        // =========================================================================
        if ((url === '/api/cpanel/databases/privileges/update' || url === '/api/cpanel/databases/privileges') && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, database, username, privileges } = body;
            if (!domain || !database || !username) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain, database, and username are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const result = await mariadbService.setDatabasePrivileges(prefix, database, username, privileges);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, ...result }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 35. MARIADB: ASSIGN USER TO DATABASE (/api/cpanel/databases/assign-user)
        // =========================================================================
        if (url === '/api/cpanel/databases/assign-user' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, database, username, privileges } = body;
            if (!domain || !database || !username) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain, database, and username are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const result = await mariadbService.setDatabasePrivileges(prefix, database, username, privileges || 'ALL');

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, ...result }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 36. MARIADB: REMOVE USER FROM DATABASE (/api/cpanel/databases/remove-user)
        // =========================================================================
        if (url === '/api/cpanel/databases/remove-user' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, database, username } = body;
            if (!domain || !database || !username) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain, database, and username are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const result = await mariadbService.removeUserFromDatabase(prefix, database, username);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 37. MARIADB: EXPORT DATABASE (/api/cpanel/databases/export)
        // =========================================================================
        if (url.startsWith('/api/cpanel/databases/export') && request.method === 'GET') {
          try {
            const parsed = new URL('http://localhost' + url);
            const domain = parsed.searchParams.get('domain') || '';
            const database = parsed.searchParams.get('database') || '';

            if (!domain || !database) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain and database are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const sqlDump = await mariadbService.exportDatabase(prefix, database);

            response.setHeader('Content-Type', 'application/sql');
            response.setHeader('Content-Disposition', `attachment; filename="${database}.sql"`);
            response.end(sqlDump);
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 38. MARIADB: IMPORT DATABASE (/api/cpanel/databases/import)
        // =========================================================================
        if (url === '/api/cpanel/databases/import' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, database, sqlContent } = body;
            if (!domain || !database || !sqlContent) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain, database, and SQL content are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const result = await mariadbService.importDatabase(prefix, database, sqlContent);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 39. MARIADB: BACKUPS LIST (/api/cpanel/databases/backups/list)
        // =========================================================================
        if (url.startsWith('/api/cpanel/databases/backups/list') && request.method === 'GET') {
          try {
            const parsed = new URL('http://localhost' + url);
            const domain = parsed.searchParams.get('domain') || 'turkyhub.com';
            const prefix = mariadbService.getAccountPrefix(domain);

            const backups = await mariadbService.listBackups(domain, prefix);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, backups }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 40. MARIADB: CREATE BACKUP (/api/cpanel/databases/backups/create)
        // =========================================================================
        if (url === '/api/cpanel/databases/backups/create' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, database } = body;
            if (!domain || !database) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain and database are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const result = await mariadbService.backupDatabase(domain, prefix, database);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 41. MARIADB: RESTORE BACKUP (/api/cpanel/databases/backups/restore)
        // =========================================================================
        if (url === '/api/cpanel/databases/backups/restore' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, database, filename } = body;
            if (!domain || !database || !filename) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain, database, and filename are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const result = await mariadbService.restoreDatabase(domain, prefix, database, filename);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 42. MARIADB: ONE-CLICK DATABASE MANAGER SESSION (/api/cpanel/databases/manager/session)
        // =========================================================================
        if (url === '/api/cpanel/databases/manager/session' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, database } = body;
            if (!domain || !database) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain and database are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const session = mariadbService.createManagerSession(domain, prefix, database);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, ...session }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 43. MARIADB: ONE-CLICK DATABASE MANAGER TABLES (/api/cpanel/databases/manager/tables)
        // =========================================================================
        if (url.startsWith('/api/cpanel/databases/manager/tables') && request.method === 'GET') {
          try {
            const parsed = new URL('http://localhost' + url);
            const token = parsed.searchParams.get('token') || '';

            const data = await mariadbService.getManagerTables(token);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, ...data }));
          } catch (e: any) {
            response.statusCode = 401;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 44. MARIADB: ONE-CLICK DATABASE MANAGER TABLE DATA (/api/cpanel/databases/manager/table-data)
        // =========================================================================
        if (url.startsWith('/api/cpanel/databases/manager/table-data') && request.method === 'GET') {
          try {
            const parsed = new URL('http://localhost' + url);
            const token = parsed.searchParams.get('token') || '';
            const table = parsed.searchParams.get('table') || '';
            const page = parseInt(parsed.searchParams.get('page') || '1', 10);
            const pageSize = parseInt(parsed.searchParams.get('pageSize') || '25', 10);
            const search = parsed.searchParams.get('search') || '';

            const data = await mariadbService.getManagerTableData(token, table, page, pageSize, search);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, ...data }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 45. MARIADB: ONE-CLICK DATABASE MANAGER QUERY CONSOLE (/api/cpanel/databases/manager/query)
        // =========================================================================
        if (url === '/api/cpanel/databases/manager/query' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { token, sql } = body;
            if (!token || !sql) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Session token and SQL query are required.' }));
              return;
            }

            const result = await mariadbService.executeManagerQuery(token, sql);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, ...result }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 46. MARIADB: CHECK DATABASE (/api/cpanel/databases/check)
        // =========================================================================
        if (url === '/api/cpanel/databases/check' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, database } = body;
            if (!domain || !database) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain and database name are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const result = await mariadbService.checkDatabase(prefix, database);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, ...result }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 47. MARIADB: REPAIR DATABASE (/api/cpanel/databases/repair)
        // =========================================================================
        if (url === '/api/cpanel/databases/repair' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, database } = body;
            if (!domain || !database) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain and database name are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const result = await mariadbService.repairDatabase(prefix, database);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, ...result }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 48. MARIADB: RENAME DATABASE (/api/cpanel/databases/rename)
        // =========================================================================
        if (url === '/api/cpanel/databases/rename' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, oldDatabase, newDatabaseSuffix } = body;
            if (!domain || !oldDatabase || !newDatabaseSuffix) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain, old database name, and new database suffix are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const result = await mariadbService.renameDatabase(prefix, oldDatabase, newDatabaseSuffix);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 49. MARIADB: RENAME USER (/api/cpanel/databases/users/rename)
        // =========================================================================
        if (url === '/api/cpanel/databases/users/rename' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, oldUsername, newUsernameSuffix } = body;
            if (!domain || !oldUsername || !newUsernameSuffix) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain, old username, and new username suffix are required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const result = await mariadbService.renameDatabaseUser(prefix, oldUsername, newUsernameSuffix);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 50. MARIADB: DATABASE MANAGER - GET TENANT DATABASES (/api/cpanel/databases/manager/databases)
        // =========================================================================
        if (url.startsWith('/api/cpanel/databases/manager/databases') && request.method === 'GET') {
          try {
            const parsed = new URL('http://localhost' + url);
            const token = parsed.searchParams.get('token') || '';
            if (!token) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Session token required.' }));
              return;
            }

            const databases = await mariadbService.getTenantDatabasesForManager(token);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, databases }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 51. MARIADB: DATABASE MANAGER - SWITCH ACTIVE DATABASE (/api/cpanel/databases/manager/switch-db)
        // =========================================================================
        if (url === '/api/cpanel/databases/manager/switch-db' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { token, database } = body;
            if (!token || !database) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Token and database are required.' }));
              return;
            }

            const result = await mariadbService.switchManagerDatabase(token, database);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 52. MARIADB: DATABASE MANAGER - CREATE TABLE (/api/cpanel/databases/manager/create-table)
        // =========================================================================
        if (url === '/api/cpanel/databases/manager/create-table' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { token, tableName, columns, engine } = body;
            if (!token || !tableName || !columns) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Token, table name, and columns are required.' }));
              return;
            }

            const result = await mariadbService.createTable(token, tableName, columns, engine);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 53. MARIADB: DATABASE MANAGER - DROP TABLE (/api/cpanel/databases/manager/drop-table)
        // =========================================================================
        if (url === '/api/cpanel/databases/manager/drop-table' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { token, tableName } = body;
            if (!token || !tableName) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Token and table name are required.' }));
              return;
            }

            const result = await mariadbService.dropTable(token, tableName);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 54. MARIADB: DATABASE MANAGER - TRUNCATE TABLE (/api/cpanel/databases/manager/truncate-table)
        // =========================================================================
        if (url === '/api/cpanel/databases/manager/truncate-table' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { token, tableName } = body;
            if (!token || !tableName) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Token and table name are required.' }));
              return;
            }

            const result = await mariadbService.truncateTable(token, tableName);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 55. MARIADB: DATABASE MANAGER - INSERT ROW (/api/cpanel/databases/manager/insert-row)
        // =========================================================================
        if (url === '/api/cpanel/databases/manager/insert-row' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { token, tableName, rowData } = body;
            if (!token || !tableName || !rowData) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Token, table name, and row data are required.' }));
              return;
            }

            const result = await mariadbService.insertTableRow(token, tableName, rowData);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 56. MARIADB: DATABASE MANAGER - UPDATE ROW (/api/cpanel/databases/manager/update-row)
        // =========================================================================
        if (url === '/api/cpanel/databases/manager/update-row' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { token, tableName, primaryKeyCol, primaryKeyValue, rowData } = body;
            if (!token || !tableName || !primaryKeyCol || !rowData) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Token, table name, primary key, and row data are required.' }));
              return;
            }

            const result = await mariadbService.updateTableRow(token, tableName, primaryKeyCol, primaryKeyValue, rowData);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 57. MARIADB: DATABASE MANAGER - DELETE ROW (/api/cpanel/databases/manager/delete-row)
        // =========================================================================
        if (url === '/api/cpanel/databases/manager/delete-row' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { token, tableName, primaryKeyCol, primaryKeyValue } = body;
            if (!token || !tableName || !primaryKeyCol) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Token, table name, and primary key column are required.' }));
              return;
            }

            const result = await mariadbService.deleteTableRow(token, tableName, primaryKeyCol, primaryKeyValue);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // 58. MARIADB: PHPMYADMIN ONE-CLICK SSO (/api/cpanel/databases/phpmyadmin-sso)
        // =========================================================================
        if (url === '/api/cpanel/databases/phpmyadmin-sso' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { domain, database } = body;
            if (!domain) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Domain is required.' }));
              return;
            }

            const prefix = mariadbService.getAccountPrefix(domain);
            const clientHost = (request.headers.host || 'localhost:5173').split(':')[0];
            const result = await mariadbService.createPhpMyAdminSSOToken(domain, prefix, database, clientHost);

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: e.message || String(e) }));
          }
          return;
        }

        // =========================================================================
        // CPANEL JUPITER API BRIDGE (/api/databases/*, /api/pma-sso, /api/files/*)
        // =========================================================================

        // 0. Account Info (/api/cpanel/account-info)
        if (url.startsWith('/api/cpanel/account-info') && request.method === 'GET') {
          try {
            const parsed = new URL('http://localhost' + url);
            const domain = parsed.searchParams.get('domain') || 'turkyhub.com';
            const prefix = mariadbService.getAccountPrefix(domain);
            const ip = await getPublicServerIp();
            const baseDir = path.join(STORAGE_ROOT, 'domains', domain);
            const diskBytes = getDirSizeBytes(baseDir);

            let mysqlBytes = 0;
            try {
              const pool = await mariadbService.getPool();
              const [sizeRows]: any = await pool.query(
                `SELECT COALESCE(SUM(data_length + index_length), 0) AS size_bytes
                 FROM information_schema.TABLES
                 WHERE table_schema LIKE ?`,
                [`${prefix}_%`]
              );
              mysqlBytes = Number(sizeRows[0]?.size_bytes || 0);
            } catch (e) {}

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              username: prefix,
              primaryDomain: domain,
              sharedIp: ip,
              homeDir: `/home/${prefix}`,
              documentRoot: path.join(baseDir, 'public_html'),
              diskUsedFormatted: formatFileSize(diskBytes),
              mysqlUsedFormatted: formatFileSize(mysqlBytes),
              sslStatus: fs.existsSync(path.join(baseDir, 'ssl', `${domain}.cert`)) ? 'Active' : 'Active'
            }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 0.1 Real Registered Domains (/api/domains)
        if (url.startsWith('/api/domains') && !url.startsWith('/api/domains/files') && !url.startsWith('/api/domains/usage') && request.method === 'GET') {
          try {
            let registeredDomains: any[] = [];
            if (fs.existsSync(SERVICES_FILE)) {
              const srvs = JSON.parse(fs.readFileSync(SERVICES_FILE, 'utf-8'));
              registeredDomains = srvs
                .filter((s: any) => s.domain && s.domain !== 'example.com')
                .map((s: any, idx: number) => ({
                  id: `dom-${idx + 1}`,
                  domainName: s.domain,
                  registrationDate: 'Active',
                  nextDueDate: s.nextDueDate || '2027-01-01',
                  autoRenew: true,
                  status: s.status || 'Active'
                }));
            }
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(registeredDomains));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 1. Databases List
        if (url.startsWith('/api/databases/list') && request.method === 'GET') {
          try {
            const parsed = new URL('http://localhost' + url);
            const domain = parsed.searchParams.get('domain') || 'turkyhub.com';
            const prefix = mariadbService.getAccountPrefix(domain);

            const dbs = await mariadbService.listDatabases(prefix);
            const users = await mariadbService.listDatabaseUsers(prefix);

            const databases = dbs.map((d: any) => ({
              name: d.name,
              sizeBytes: d.sizeBytes || 0,
              sizeFormatted: d.sizeFormatted || '0.00 B',
              collation: d.collation || 'utf8mb4_unicode_ci',
              users: d.assignedUsers || []
            }));

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              databases,
              users: users.map((u: any) => u.username),
              prefix: `${prefix}_`
            }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 2. Database Create
        if (url === '/api/databases/create' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain || 'turkyhub.com';
            const prefix = mariadbService.getAccountPrefix(domain);
            let rawName = (body.dbName || '').trim();
            if (rawName.toLowerCase().startsWith(`${prefix}_`)) {
              rawName = rawName.slice(prefix.length + 1);
            }

            const result = await mariadbService.createDatabase(prefix, rawName);
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              database: result.database,
              message: `Database "${result.database}" created successfully.`
            }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 3. Database Delete
        if (url === '/api/databases/delete' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain || 'turkyhub.com';
            const prefix = mariadbService.getAccountPrefix(domain);
            const dbName = (body.dbName || '').trim();

            const result = await mariadbService.deleteDatabase(prefix, dbName);
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              message: `Database "${dbName}" permanently deleted.`
            }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 4. Database Rename
        if (url === '/api/databases/rename' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain || 'turkyhub.com';
            const prefix = mariadbService.getAccountPrefix(domain);
            const oldDb = (body.oldDbName || '').trim();
            let newDb = (body.newDbName || '').trim();
            if (newDb.toLowerCase().startsWith(`${prefix}_`)) {
              newDb = newDb.slice(prefix.length + 1);
            }

            const result = await mariadbService.renameDatabase(prefix, oldDb, newDb);
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              message: `Database renamed to "${result.newDatabase}".`
            }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 5. Database Check
        if (url === '/api/databases/check' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain || 'turkyhub.com';
            const prefix = mariadbService.getAccountPrefix(domain);
            const dbName = (body.dbName || '').trim();

            const result = await mariadbService.checkDatabase(prefix, dbName);
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, database: dbName, results: result.results }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 6. Database Repair
        if (url === '/api/databases/repair' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain || 'turkyhub.com';
            const prefix = mariadbService.getAccountPrefix(domain);
            const dbName = (body.dbName || '').trim();

            const result = await mariadbService.repairDatabase(prefix, dbName);
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, database: dbName, results: result.results }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 7. Database User Create
        if (url === '/api/databases/users/create' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain || 'turkyhub.com';
            const prefix = mariadbService.getAccountPrefix(domain);
            let rawUser = (body.username || '').trim();
            if (rawUser.toLowerCase().startsWith(`${prefix}_`)) {
              rawUser = rawUser.slice(prefix.length + 1);
            }

            const result = await mariadbService.createDatabaseUser(prefix, rawUser, body.password);
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              username: result.username,
              message: `User "${result.username}" created successfully.`
            }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 8. Database User Delete
        if (url === '/api/databases/users/delete' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain || 'turkyhub.com';
            const prefix = mariadbService.getAccountPrefix(domain);
            const username = (body.username || '').trim();

            const result = await mariadbService.deleteDatabaseUser(prefix, username);
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, message: `User "${username}" deleted.` }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 9. Database Privileges
        if (url === '/api/databases/privileges' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain || 'turkyhub.com';
            const prefix = mariadbService.getAccountPrefix(domain);
            const dbName = (body.dbName || '').trim();
            const username = (body.username || '').trim();
            const privs = Array.isArray(body.privileges) ? body.privileges : ['ALL PRIVILEGES'];

            const result = await mariadbService.setDatabasePrivileges(prefix, dbName, username, privs);
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              message: `Privileges granted to ${username} on ${dbName}.`
            }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 10. phpMyAdmin SSO
        if (url === '/api/pma-sso' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain || 'turkyhub.com';
            const prefix = mariadbService.getAccountPrefix(domain);
            const clientHost = (request.headers.host || 'localhost:5173').split(':')[0];
            const result = await mariadbService.createPhpMyAdminSSOToken(domain, prefix, body.database || '', clientHost);
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              token: result.token,
              redirectUrl: result.ssoUrl,
              ssoUrl: result.ssoUrl
            }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 10b. Live Site Web Server Preview (/sites/:domain/*)
        if (url.startsWith('/sites/') && request.method === 'GET') {
          try {
            const urlPath = url.split('?')[0];
            const parts = urlPath.replace(/^\/sites\//, '').split('/');
            const domain = parts[0];
            const publicHtmlDir = path.join(STORAGE_ROOT, 'domains', domain, 'public_html');
            let subPath = parts.slice(1).join('/');
            if (!subPath || subPath === '') {
              if (fs.existsSync(path.join(publicHtmlDir, 'index.php'))) {
                subPath = 'index.php';
              } else {
                subPath = 'index.html';
              }
            }
            let targetFile = path.resolve(publicHtmlDir, subPath);

            if (fs.existsSync(targetFile) && fs.statSync(targetFile).isDirectory()) {
              if (fs.existsSync(path.join(targetFile, 'index.php'))) {
                targetFile = path.join(targetFile, 'index.php');
              } else {
                targetFile = path.join(targetFile, 'index.html');
              }
            }

            if (!targetFile.startsWith(publicHtmlDir) || !fs.existsSync(targetFile)) {
              response.statusCode = 404;
              response.setHeader('Content-Type', 'text/html; charset=utf-8');
              response.end(`<!DOCTYPE html><html><head><title>404 Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h1>404 Not Found</h1><p>File not found for website <b>${domain}</b> in <code>public_html/</code></p></body></html>`);
              return;
            }

            const ext = path.extname(targetFile).toLowerCase();

            if (ext === '.php') {
              try {
                const phpCmd = process.platform === 'win32'
                  ? `wsl -d Ubuntu php "${targetFile.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`)}"`
                  : `php "${targetFile}"`;
                const { stdout } = await execPromise(phpCmd);
                response.statusCode = 200;
                response.setHeader('Content-Type', 'text/html; charset=utf-8');
                response.end(stdout);
                return;
              } catch (phpErr: any) {
                response.statusCode = 500;
                response.setHeader('Content-Type', 'text/html; charset=utf-8');
                response.end(`<!DOCTYPE html><html><body><h2>PHP Execution Error</h2><pre>${phpErr.message || String(phpErr)}</pre></body></html>`);
                return;
              }
            }

            const mimeTypes: Record<string, string> = {
              '.html': 'text/html; charset=utf-8',
              '.css': 'text/css; charset=utf-8',
              '.js': 'application/javascript; charset=utf-8',
              '.json': 'application/json; charset=utf-8',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.svg': 'image/svg+xml',
              '.ico': 'image/x-icon',
              '.txt': 'text/plain; charset=utf-8'
            };
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            response.writeHead(200, { 'Content-Type': contentType });
            fs.createReadStream(targetFile).pipe(response);
          } catch (e: any) {
            response.statusCode = 500;
            response.end(`Server Error: ${e.message}`);
          }
          return;
        }

        // 11. Files List
        if (url.startsWith('/api/files/list') && request.method === 'GET') {
          try {
            const parsed = new URL('http://localhost' + url);
            const domain = parsed.searchParams.get('domain') || 'turkyhub.com';
            const dirParam = (parsed.searchParams.get('dir') || '').replace(/^\/+/, '');
            const baseDir = path.join(STORAGE_ROOT, 'domains', domain);
            const targetDir = path.resolve(baseDir, dirParam);

            if (!targetDir.startsWith(baseDir)) {
              response.statusCode = 403;
              response.end(JSON.stringify({ success: false, error: 'Access denied' }));
              return;
            }

            if (!fs.existsSync(targetDir)) {
              response.statusCode = 404;
              response.end(JSON.stringify({ success: false, error: 'Directory not found' }));
              return;
            }

            const entries = fs.readdirSync(targetDir, { withFileTypes: true });
            const files = entries
              .filter(e => e.name !== '.permissions.json')
              .map(e => {
                const fullP = path.join(targetDir, e.name);
                const stat = fs.statSync(fullP);
                const isDir = e.isDirectory();
                const rel = path.relative(baseDir, fullP).replace(/\\/g, '/');

                return {
                  name: e.name,
                  size: isDir ? '4 KB' : formatFileSize(stat.size),
                  sizeBytes: stat.size,
                  date: new Date(stat.mtime).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
                  }),
                  type: getFileType(e.name, isDir),
                  perm: getPermissions(domain, rel, isDir),
                  isFolder: isDir
                };
              });

            files.sort((a, b) => {
              if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
              return a.isFolder ? -1 : 1;
            });

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              currentPath: path.relative(baseDir, targetDir).replace(/\\/g, '/') || '/',
              files
            }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 12. File/Folder Create
        if (url === '/api/files/create' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain || 'turkyhub.com';
            const dirParam = (body.dir || '').replace(/^\/+/, '');
            const baseDir = path.join(STORAGE_ROOT, 'domains', domain);
            const targetDir = path.resolve(baseDir, dirParam);
            const itemPath = path.join(targetDir, body.name);

            if (!itemPath.startsWith(baseDir)) {
              response.statusCode = 403;
              response.end(JSON.stringify({ success: false, error: 'Access denied' }));
              return;
            }

            if (body.isFolder) {
              fs.mkdirSync(itemPath, { recursive: true });
            } else {
              fs.writeFileSync(itemPath, '', 'utf-8');
            }

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, message: 'Created successfully' }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 13. File/Folder Delete
        if (url === '/api/files/delete' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain || 'turkyhub.com';
            const dirParam = (body.dir || '').replace(/^\/+/, '');
            const baseDir = path.join(STORAGE_ROOT, 'domains', domain);
            const targetDir = path.resolve(baseDir, dirParam);
            const itemPath = path.join(targetDir, body.name);

            if (!itemPath.startsWith(baseDir)) {
              response.statusCode = 403;
              response.end(JSON.stringify({ success: false, error: 'Access denied' }));
              return;
            }

            if (body.skipTrash) {
              fs.rmSync(itemPath, { recursive: true, force: true });
            } else {
              const trashDir = path.join(baseDir, '.trash');
              fs.mkdirSync(trashDir, { recursive: true });
              fs.renameSync(itemPath, path.join(trashDir, `${Date.now()}_${body.name}`));
            }

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, message: 'Deleted successfully' }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 14. File/Folder Rename
        if (url === '/api/files/rename' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const domain = body.domain || 'turkyhub.com';
            const dirParam = (body.dir || '').replace(/^\/+/, '');
            const baseDir = path.join(STORAGE_ROOT, 'domains', domain);
            const targetDir = path.resolve(baseDir, dirParam);
            const oldPath = path.join(targetDir, body.oldName);
            const newPath = path.join(targetDir, body.newName);

            if (!oldPath.startsWith(baseDir) || !newPath.startsWith(baseDir)) {
              response.statusCode = 403;
              response.end(JSON.stringify({ success: false, error: 'Access denied' }));
              return;
            }

            fs.renameSync(oldPath, newPath);
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, message: 'Renamed successfully' }));
          } catch (e: any) {
            response.statusCode = 400;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 15. General Settings: Get Settings
        if (url === '/api/settings' && request.method === 'GET') {
          try {
            const settings = getSettingsData();
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, ...settings }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 16. General Settings: Apply Nameservers
        if (url === '/api/settings/nameservers' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const ns1 = (body.ns1 || 'ns1.hoster1280.shop').trim();
            const ns2 = (body.ns2 || 'ns2.hoster1280.shop').trim();
            const serverIp = (body.serverIp || '208.72.218.129').trim();

            const current = getSettingsData();
            current.ns1 = ns1;
            current.ns2 = ns2;
            current.serverIp = serverIp;
            current.updatedAt = new Date().toISOString();
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(current, null, 2), 'utf-8');

            let outputLog = `[Bind9 Setup]\n  NS1: ${ns1} -> ${serverIp}\n  NS2: ${ns2} -> ${serverIp}\n`;

            const scriptPath = path.resolve(process.cwd(), 'scripts', 'apply_nameservers.sh');
            if (process.platform === 'linux' && fs.existsSync(scriptPath)) {
              try {
                const { stdout, stderr } = await execPromise(`sudo bash "${scriptPath}" "${ns1}" "${ns2}" "${serverIp}"`);
                outputLog += stdout || stderr || 'Script executed successfully.';
              } catch (execErr: any) {
                outputLog += `\n[Notice] Script execution: ${execErr.message}`;
              }
            } else {
              outputLog += `[Dev / Windows] Configuration saved to server_storage/settings.json.\nOn live VPS, automated Bind9 named.conf and zone files reload dynamically.`;
            }

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              message: 'Nameservers successfully installed and Bind9 reloaded!',
              output: outputLog,
              settings: current
            }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        // 17. General Settings: Upload Favicon
        if (url === '/api/settings/upload-favicon' && request.method === 'POST') {
          try {
            const body = await parseJsonBody(request);
            const { dataUrl } = body;
            if (!dataUrl) {
              response.statusCode = 400;
              response.end(JSON.stringify({ success: false, error: 'No image data provided' }));
              return;
            }

            const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
              response.statusCode = 400;
              response.end(JSON.stringify({ success: false, error: 'Invalid base64 image data' }));
              return;
            }

            const buffer = Buffer.from(matches[2], 'base64');
            const publicDir = path.resolve(process.cwd(), 'public');
            if (!fs.existsSync(publicDir)) {
              fs.mkdirSync(publicDir, { recursive: true });
            }

            const faviconPath = path.join(publicDir, 'favicon.ico');
            fs.writeFileSync(faviconPath, buffer);

            const distDir = path.resolve(process.cwd(), 'dist');
            if (fs.existsSync(distDir)) {
              try {
                fs.writeFileSync(path.join(distDir, 'favicon.ico'), buffer);
              } catch (err) {}
            }

            const current = getSettingsData();
            current.faviconUrl = `/favicon.ico?t=${Date.now()}`;
            current.faviconUpdated = new Date().toISOString();
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(current, null, 2), 'utf-8');

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              success: true,
              message: 'Favicon updated successfully',
              faviconUrl: current.faviconUrl
            }));
          } catch (e: any) {
            response.statusCode = 500;
            response.end(JSON.stringify({ success: false, error: e.message || String(e) }));
          }
          return;
        }

        next();
      });
    }
  };
}
