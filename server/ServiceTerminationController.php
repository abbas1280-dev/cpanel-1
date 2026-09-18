<?php
/**
 * ==============================================================================
 * Multi-Tenant Service Termination & Server Purge Controller
 * Platform: hoster1280.shop
 * ==============================================================================
 */

header('Content-Type: application/json');

class ServiceTerminationController
{
    private string $storageRoot;
    private string $scriptsDir;

    public function __construct(?string $storageRoot = null)
    {
        $this->storageRoot = $storageRoot ?? dirname(__DIR__) . '/server_storage';
        $this->scriptsDir = dirname(__DIR__) . '/scripts';
    }

    /**
     * Terminate service and purge all Linux, Web, DB, DNS, and SSL configurations
     */
    public function terminate(string $domain): array
    {
        $cleanDomain = strtolower(trim($domain));
        if (!preg_match('/^([a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/', $cleanDomain)) {
            return [
                'success' => false,
                'error' => 'Invalid domain syntax for termination.'
            ];
        }

        $domainPrefix = preg_replace('/[^a-z0-9]/', '', explode('.', $cleanDomain)[0]);
        $tenantUsername = 'u_' . substr($domainPrefix, 0, 8);

        $isLinux = (PHP_OS_FAMILY === 'Linux');
        $scriptOutput = null;

        // Execute 7-step purge shell script if on Linux
        if ($isLinux) {
            $shScript = $this->scriptsDir . '/terminate_service.sh';
            if (file_exists($shScript)) {
                $cmd = sprintf(
                    'sudo /bin/bash %s %s %s %s 2>&1',
                    escapeshellarg($shScript),
                    escapeshellarg($cleanDomain),
                    escapeshellarg($tenantUsername),
                    escapeshellarg($this->storageRoot)
                );
                $scriptOutput = shell_exec($cmd);
            }
        }

        // Clean local domain folder in storage
        $domainStorage = $this->storageRoot . '/domains/' . $cleanDomain;
        if (is_dir($domainStorage)) {
            $this->recursiveDelete($domainStorage);
        }

        // Clean from services.json
        $servicesFile = $this->storageRoot . '/services.json';
        if (file_exists($servicesFile)) {
            $services = json_decode(file_get_contents($servicesFile), true);
            if (is_array($services)) {
                $services = array_values(array_filter($services, function ($s) use ($cleanDomain) {
                    return strtolower($s['domain'] ?? '') !== $cleanDomain;
                }));
                file_put_contents($servicesFile, json_encode($services, JSON_PRETTY_PRINT));
            }
        }

        return [
            'success' => true,
            'message' => "Service for {$cleanDomain} has been permanently terminated and all server resources purged.",
            'domain' => $cleanDomain,
            'tenantUsername' => $tenantUsername,
            'linuxOutput' => $scriptOutput
        ];
    }

    private function recursiveDelete(string $dir): bool
    {
        if (!file_exists($dir)) return true;
        if (!is_dir($dir)) return @unlink($dir);

        foreach (scandir($dir) as $item) {
            if ($item === '.' || $item === '..') continue;
            if (!$this->recursiveDelete($dir . DIRECTORY_SEPARATOR . $item)) return false;
        }
        return @rmdir($dir);
    }
}

// If invoked directly via HTTP POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $domain = $input['domain'] ?? $_POST['domain'] ?? null;

    if (!$domain) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Domain parameter is required.']);
        exit;
    }

    $controller = new ServiceTerminationController();
    $result = $controller->terminate($domain);
    if (!$result['success']) {
        http_response_code(400);
    }
    echo json_encode($result);
    exit;
}
