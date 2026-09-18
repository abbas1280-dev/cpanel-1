export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  address: string;
  city: string;
  country: string;
  avatarUrl: string;
  twoFactorEnabled: boolean;
}

export type ActiveTab = 'dashboard' | 'services' | 'domains' | 'profile' | 'cpanel' | 'filemanager' | 'cpanel_domains' | 'cpanel_databases' | 'settings';

export type DomainType = 'primary' | 'subdomain' | 'addon' | 'alias';
export type DomainStatus = 'active' | 'pending' | 'dns_pending' | 'ssl_pending' | 'config_error' | 'suspended';
export type DnsStatus = 'active' | 'pending' | 'cloudflare';
export type SslStatus = 'active' | 'self_signed' | 'pending' | 'error';
export type WebServerStatus = 'active' | 'configured' | 'error';

export type DomainSubTab = 'domains' | 'subdomains' | 'addon' | 'aliases' | 'redirects' | 'zone_editor' | 'ddns';

export interface RedirectItem {
  id: string;
  domain: string;
  directory: string;
  redirectUrl: string;
  type: 'permanent' | 'temporary'; // 301 or 302
  matchType: 'all' | 'exact' | 'wildcard';
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface DnsRecordItem {
  id: string;
  domain: string;
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'NS' | 'SOA';
  ttl: number;
  record: string;
  priority?: number;
  weight?: number;
  port?: number;
}

export interface DdnsTokenItem {
  id: string;
  domain: string;
  subdomain: string;
  token: string;
  fullDomain: string;
  currentIp: string;
  lastUpdated: string;
  createdAt: string;
}

export interface PingDiagnosticResult {
  domain: string;
  ip: string;
  resolved: boolean;
  dnsLookupTimeMs: number;
  pingLatencyMs: number | null;
  pingSuccess: boolean;
  httpStatusCode: number | null;
  httpOk: boolean;
  nginxConfigValid: boolean;
  documentRootExists: boolean;
  documentRootPath: string;
  checkedAt: string;
}

export interface CPanelDomainItem {
  domain: string;
  documentRoot: string;
  isMain: boolean;
  type: DomainType;
  parentDomain?: string;
  redirectsTo: string | null;
  forceHttps: boolean;
  status: DomainStatus;
  dnsStatus: DnsStatus;
  sslStatus: SslStatus;
  webServerStatus: WebServerStatus;
  documentRootStatus?: 'ok' | 'missing';
  documentRootError?: string;
  createdAt: string;
  updatedAt?: string;
  accountUsername?: string;
}


export interface ServiceItem {
  id: string;
  product: string;
  domain: string;
  pricing: string;
  billingCycle: string;
  nextDueDate: string;
  status: 'Active' | 'Suspended' | 'Pending' | 'Terminated' | 'Cancelled';
  serverIp: string;
  phpVersion?: string;
  quota?: string;
  tenantUsername?: string;
  nameservers?: string[];
  sslActive?: boolean;
  createdAt?: string;
}

export interface DomainItem {
  id: string;
  domainName: string;
  registrationDate: string;
  nextDueDate: string;
  autoRenew: boolean;
  status: 'Active' | 'Expiring Soon' | 'Expired';
}

export interface ServerMetrics {
  hostname: string;
  platform: string;
  nodeVersion: string;
  serverIp: string;
  publicIp?: string;
  uptimeSeconds: number;
  cpu: {
    model: string;
    cores: number;
    usagePercent: number;
  };
  memory: {
    totalGB: string;
    usedGB: string;
    freeGB: string;
    percentUsed: string;
  };
  disk: {
    totalGB: string;
    freeGB: string;
    usedGB: string;
    percentUsed: string;
  };
  timestamp: string;
}

