<?php
/**
 * ==============================================================================
 * HOSTER 1280 - Settings & Branding Controller
 * Platform: hoster1280.shop
 * ==============================================================================
 */

header('Content-Type: application/json');

class SettingsController
{
    private string $storageRoot;
    private string $scriptsDir;
    private string $publicDir;

    public function __construct(?string $storageRoot = null)
    {
        $this->storageRoot = $storageRoot ?? dirname(__DIR__) . '/server_storage';
        $this->scriptsDir = dirname(__DIR__) . '/scripts';
        $this->publicDir = dirname(__DIR__) . '/public';
    }

    /**
     * Get current server and nameserver settings
     */
    public function getSettings(): array
    {
        $settingsFile = $this->storageRoot . '/settings.json';
        if (file_exists($settingsFile)) {
            $data = json_decode(file_get_contents($settingsFile), true);
            if (is_array($data)) {
                return array_merge(['success' => true], $data);
            }
        }

        return [
            'success' => true,
            'ns1' => 'ns1.hoster1280.shop',
            'ns2' => 'ns2.hoster1280.shop',
            'serverIp' => '208.72.218.129',
            'faviconUrl' => '/favicon.ico'
        ];
    }

    /**
     * 1-Click Apply and Install Nameservers globally
     */
    public function applyNameservers(string $ns1, string $ns2, ?string $serverIp = null): array
    {
        $ns1Clean = strtolower(trim($ns1));
        $ns2Clean = strtolower(trim($ns2));
        $ip = trim($serverIp ?? '');

        if (empty($ns1Clean) || empty($ns2Clean)) {
            return [
                'success' => false,
                'error' => 'Primary (NS1) and Secondary (NS2) nameservers are required.'
            ];
        }

        // Fallback IP detection
        if (empty($ip)) {
            $ip = trim((string)@file_get_contents('https://api.ipify.org'));
            if (empty($ip)) {
                $ip = $_SERVER['SERVER_ADDR'] ?? '208.72.218.129';
            }
        }

        // Save to settings.json
        if (!is_dir($this->storageRoot)) {
            mkdir($this->storageRoot, 0755, true);
        }

        $settingsFile = $this->storageRoot . '/settings.json';
        $current = file_exists($settingsFile) ? json_decode(file_get_contents($settingsFile), true) : [];
        if (!is_array($current)) {
            $current = [];
        }

        $current['ns1'] = $ns1Clean;
        $current['ns2'] = $ns2Clean;
        $current['serverIp'] = $ip;
        $current['updatedAt'] = date('c');

        file_put_contents($settingsFile, json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        // Execute shell script on Linux
        $isLinux = (PHP_OS_FAMILY === 'Linux');
        if ($isLinux) {
            $script = $this->scriptsDir . '/apply_nameservers.sh';
            if (file_exists($script)) {
                $cmd = sprintf(
                    'sudo /bin/bash %s %s %s %s %s 2>&1',
                    escapeshellarg($script),
                    escapeshellarg($ns1Clean),
                    escapeshellarg($ns2Clean),
                    escapeshellarg($ip),
                    escapeshellarg($this->storageRoot)
                );
                @exec($cmd, $output, $returnCode);
            }
        }

        return [
            'success' => true,
            'message' => 'Nameservers installed and active globally!',
            'ns1' => $ns1Clean,
            'ns2' => $ns2Clean,
            'serverIp' => $ip
        ];
    }
}

// Direct routing if accessed via HTTP
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    $controller = new SettingsController();
    $action = $_GET['action'] ?? ($_POST['action'] ?? 'get');

    if ($action === 'apply' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        echo json_encode($controller->applyNameservers($input['ns1'] ?? '', $input['ns2'] ?? '', $input['serverIp'] ?? null));
        exit;
    }

    echo json_encode($controller->getSettings());
    exit;
}
