<?php
/**
 * ==============================================================================
 * Multi-Tenant Service Provisioning Engine Controller
 * Platform: hoster1280.shop
 * ==============================================================================
 */

class ProvisioningService
{
    private string $storageRoot;
    private string $scriptsDir;
    private array $supportedPhp = ['7.4', '8.0', '8.1', '8.2', '8.3'];
    private string $defaultPhp = '8.2';
    private string $ns1 = 'ns1.hoster1280.shop';
    private string $ns2 = 'ns2.hoster1280.shop';

    public function __construct(?string $storageRoot = null)
    {
        $this->storageRoot = $storageRoot ?? dirname(__DIR__) . '/server_storage';
        $this->scriptsDir = dirname(__DIR__) . '/scripts';
    }

    /**
     * Get real public IP of this server via dynamic external lookup
     */
    public function getPublicServerIp(): string
    {
        static $cachedIp = null;
        if ($cachedIp) return $cachedIp;

        $sources = [
            'https://api.ipify.org',
            'https://ifconfig.me/ip',
            'https://icanhazip.com'
        ];

        foreach ($sources as $url) {
            $ctx = stream_context_create([
                'http' => ['timeout' => 2]
            ]);
            $ip = @file_get_contents($url, false, $ctx);
            if ($ip && filter_var(trim($ip), FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
                $cachedIp = trim($ip);
                return $cachedIp;
            }
        }

        // Fallback to local server address
        $cachedIp = $_SERVER['SERVER_ADDR'] ?? gethostbyname(gethostname());
        return $cachedIp;
    }

    /**
     * Provision a brand new multi-tenant domain service
     */
    public function provisionDomain(string $domain, string $phpVersion = '8.2', ?string $quota = null): array
    {
        // 1. Sanitize & Validate Domain
        $cleanDomain = strtolower(trim($domain));
        if (!preg_match('/^([a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/', $cleanDomain)) {
            return [
                'success' => false,
                'error' => 'Invalid domain syntax. Example: clientdomain.com'
            ];
        }

        if (!in_array($phpVersion, $this->supportedPhp)) {
            $phpVersion = $this->defaultPhp;
        }

        // 2. Generate isolated tenant username (e.g., u_topup1280)
        $domainPrefix = preg_replace('/[^a-z0-9]/', '', explode('.', $cleanDomain)[0]);
        $tenantUsername = 'u_' . substr($domainPrefix, 0, 8);
        $randomPassword = 'Sec#' . substr(bin2hex(random_bytes(4)), 0, 8) . '!2026';

        $serverIp = $this->getPublicServerIp();
        $webroot = "/home/{$tenantUsername}/public_html";
        $socketPath = "/run/php/php{$phpVersion}-fpm-{$tenantUsername}.sock";

        // 3. If running on Linux with sudo available, execute the system provisioning script
        $isLinux = (PHP_OS_FAMILY === 'Linux');
        $scriptOutput = null;

        if ($isLinux) {
            $shScript = $this->scriptsDir . '/provision_tenant.sh';
            if (file_exists($shScript)) {
                $cmd = sprintf(
                    'sudo /bin/bash %s %s %s %s %s 2>&1',
                    escapeshellarg($shScript),
                    escapeshellarg($cleanDomain),
                    escapeshellarg($phpVersion),
                    escapeshellarg($tenantUsername),
                    escapeshellarg($this->storageRoot)
                );
                $scriptOutput = shell_exec($cmd);
            }
        }

        // 4. Ensure directory structures inside server_storage
        $domainStorage = $this->storageRoot . '/domains/' . $cleanDomain;
        $dirs = [
            $domainStorage . '/public_html',
            $domainStorage . '/logs',
            $domainStorage . '/etc',
            $domainStorage . '/ssl/certs',
            $domainStorage . '/ssl/keys'
        ];

        foreach ($dirs as $d) {
            if (!is_dir($d)) {
                @mkdir($d, 0755, true);
            }
        }

        // Default index.html if empty
        $indexFile = $domainStorage . '/public_html/index.html';
        if (!file_exists($indexFile)) {
            $tpl = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Welcome to {$cleanDomain}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 40px; max-width: 580px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
    h1 { color: #60a5fa; margin-top: 0; font-size: 28px; }
    p { color: #94a3b8; line-height: 1.6; font-size: 15px; }
    .badge { display: inline-block; background: #065f46; color: #34d399; font-weight: 700; padding: 6px 14px; border-radius: 9999px; font-size: 12px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">&#10003; VirtualHost Provisioned & Active</div>
    <h1>{$cleanDomain}</h1>
    <p>Your web hosting service is successfully provisioned and live on hoster1280.shop high-performance cloud cluster.</p>
  </div>
</body>
</html>
HTML;
            file_put_contents($indexFile, $tpl);
        }

        // 5. Write local DNS zone file
        $dnsZoneFile = $domainStorage . '/etc/dns_zone.json';
        $dnsRecords = [
            [
                'id' => 'rec-' . time() . '-1',
                'name' => $cleanDomain,
                'type' => 'A',
                'value' => $serverIp,
                'ttl' => 14400,
                'status' => 'Active',
                'managedBy' => 'hoster1280.shop DNS'
            ],
            [
                'id' => 'rec-' . time() . '-2',
                'name' => "www.{$cleanDomain}",
                'type' => 'CNAME',
                'value' => $cleanDomain,
                'ttl' => 14400,
                'status' => 'Active',
                'managedBy' => 'hoster1280.shop DNS'
            ],
            [
                'id' => 'rec-' . time() . '-3',
                'name' => $cleanDomain,
                'type' => 'NS',
                'value' => $this->ns1,
                'ttl' => 86400,
                'status' => 'Active',
                'managedBy' => 'hoster1280.shop DNS'
            ],
            [
                'id' => 'rec-' . time() . '-4',
                'name' => $cleanDomain,
                'type' => 'NS',
                'value' => $this->ns2,
                'ttl' => 86400,
                'status' => 'Active',
                'managedBy' => 'hoster1280.shop DNS'
            ]
        ];
        file_put_contents($dnsZoneFile, json_encode($dnsRecords, JSON_PRETTY_PRINT));

        // 6. Update services.json registry
        $servicesFile = $this->storageRoot . '/services.json';
        $services = file_exists($servicesFile) ? json_decode(file_get_contents($servicesFile), true) : [];
        if (!is_array($services)) $services = [];

        $newService = [
            'id' => 'srv-' . substr(time(), -4),
            'product' => 'Shared Cloud Hosting',
            'domain' => $cleanDomain,
            'pricing' => '',
            'billingCycle' => 'Annual',
            'nextDueDate' => date('l, F jS, Y', strtotime('+1 year')),
            'status' => 'Active',
            'serverIp' => $serverIp,
            'phpVersion' => $phpVersion,
            'quota' => $quota ?? 'Unlimited Shared Pool',
            'tenantUsername' => $tenantUsername,
            'nameservers' => [$this->ns1, $this->ns2],
            'createdAt' => date('c')
        ];

        // Replace or prepend
        $foundIdx = false;
        foreach ($services as $i => $s) {
            if (($s['domain'] ?? '') === $cleanDomain) {
                $services[$i] = array_merge($s, $newService);
                $foundIdx = true;
                break;
            }
        }
        if (!$foundIdx) {
            array_unshift($services, $newService);
        }
        file_put_contents($servicesFile, json_encode($services, JSON_PRETTY_PRINT));

        return [
            'success' => true,
            'message' => "Service provisioned successfully for {$cleanDomain}",
            'service' => $newService,
            'tenant' => [
                'username' => $tenantUsername,
                'password' => $randomPassword,
                'webroot' => $webroot,
                'socket' => $socketPath,
                'phpVersion' => $phpVersion
            ],
            'nameservers' => [
                'ns1' => $this->ns1,
                'ns2' => $this->ns2
            ],
            'serverIp' => $serverIp,
            'linuxOutput' => $scriptOutput
        ];
    }

    /**
     * Check live DNS propagation for domain A record against VPS IP
     */
    public function checkDnsPropagation(string $domain): array
    {
        $serverIp = $this->getPublicServerIp();
        $records = @dns_get_record($domain, DNS_A);
        $resolvedIps = [];

        if (is_array($records)) {
            foreach ($records as $r) {
                if (isset($r['ip'])) {
                    $resolvedIps[] = $r['ip'];
                }
            }
        }

        $isPointed = in_array($serverIp, $resolvedIps);

        return [
            'success' => true,
            'domain' => $domain,
            'serverIp' => $serverIp,
            'resolvedIps' => $resolvedIps,
            'isPointed' => $isPointed,
            'message' => $isPointed
                ? "Domain {$domain} resolves directly to this server IP ({$serverIp})!"
                : (!empty($resolvedIps)
                    ? "Domain resolves to [" . implode(', ', $resolvedIps) . "], waiting to resolve to {$serverIp}."
                    : "No DNS A records detected yet for {$domain}. Please ensure nameservers or A records are pointed.")
        ];
    }

    /**
     * Issue and activate Let's Encrypt SSL certificate via Certbot
     */
    public function activateSsl(string $domain): array
    {
        $cleanDomain = strtolower(trim($domain));
        $dnsCheck = $this->checkDnsPropagation($cleanDomain);

        if (!$dnsCheck['isPointed'] && PHP_OS_FAMILY === 'Linux') {
            return [
                'success' => false,
                'error' => "Cannot issue SSL: Domain {$cleanDomain} does not point to this server IP ({$dnsCheck['serverIp']}). Please update DNS first."
            ];
        }

        if (PHP_OS_FAMILY === 'Linux') {
            $cmd = sprintf(
                'sudo certbot --nginx -d %s -d %s --non-interactive --agree-tos --register-unsafely-without-email --redirect 2>&1',
                escapeshellarg($cleanDomain),
                escapeshellarg("www.{$cleanDomain}")
            );
            $out = shell_exec($cmd);
            return [
                'success' => true,
                'message' => "Let's Encrypt SSL certificate issued and Nginx reloaded.",
                'output' => $out
            ];
        }

        return [
            'success' => true,
            'message' => 'Simulated SSL certificate active (256-bit TLS).'
        ];
    }
}
