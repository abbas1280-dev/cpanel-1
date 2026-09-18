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

export type ActiveTab = 'dashboard' | 'services' | 'domains' | 'profile' | 'cpanel' | 'filemanager' | 'cpanel_domains' | 'cpanel_databases';

export type DomainType = 'primary' | 'subdomain' | 'addon';
export type DomainStatus = 'active' | 'pending' | 'dns_pending' | 'ssl_pending' | 'config_error' | 'suspended';
export type DnsStatus = 'active' | 'pending' | 'cloudflare';
export type SslStatus = 'active' | 'self_signed' | 'pending' | 'error';
export type WebServerStatus = 'active' | 'configured' | 'error';

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

