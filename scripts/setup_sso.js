import fs from 'fs';
import { execSync } from 'child_process';

const ssoPhp = `<?php
declare(strict_types=1);

ini_set('session.use_cookies', '1');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'domain' => '',
    'secure' => false,
    'httponly' => true,
    'samesite' => 'Lax'
]);
session_name('SignonSession');
@session_start();

$token = isset($_GET['token']) ? preg_replace('/[^a-f0-9]/', '', $_GET['token']) : '';
$db = isset($_GET['db']) ? preg_replace('/[^a-zA-Z0-9_]/', '', $_GET['db']) : '';

if (!empty($token)) {
    $tokenFile = '/tmp/pma_sso_' . $token . '.json';
    if (file_exists($tokenFile)) {
        $content = file_get_contents($tokenFile);
        @unlink($tokenFile); // One-time token: immediately invalidate

        $ticket = json_decode($content, true);
        if ($ticket && isset($ticket['user'], $ticket['password'], $ticket['expiresAt'])) {
            if ($ticket['expiresAt'] > time() * 1000) {
                $_SESSION['PMA_single_signon_user'] = $ticket['user'];
                $_SESSION['PMA_single_signon_password'] = $ticket['password'];
                $_SESSION['PMA_single_signon_host'] = '127.0.0.1';
                $_SESSION['PMA_single_signon_port'] = 3306;
                $_SESSION['PMA_single_signon_HMAC_secret'] = hash('sha1', uniqid((string)random_int(0, 9999999), true));

                $targetDb = !empty($db) ? $db : ($ticket['database'] ?? '');
                @session_write_close();

                $redirect = 'index.php?server=1' . (!empty($targetDb) ? '&db=' . urlencode($targetDb) : '');
                header('Location: ' . $redirect);
                exit;
            }
        }
    }
}

// Expired or invalid token fallback screen
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>phpMyAdmin Single Sign-On</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
        .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 2.5rem; max-width: 440px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        h2 { color: #0f172a; margin-top: 0; font-size: 1.25rem; }
        p { color: #64748b; font-size: 0.875rem; line-height: 1.5; }
        .btn { display: inline-block; margin-top: 1.25rem; background: #2563eb; color: #ffffff; padding: 0.5rem 1.25rem; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 0.875rem; }
        .btn:hover { background: #1d4ed8; }
    </style>
</head>
<body>
    <div class="card">
        <h2>SSO Session Expired</h2>
        <p>Your single sign-on security ticket has expired or already been utilized. Please return to the Database Management panel and click phpMyAdmin again.</p>
        <a href="javascript:window.close()" class="btn">Close Window</a>
    </div>
</body>
</html>
`;

const ssoConfig = `<?php
/**
 * Sitechai Cloud Single Sign-On Configuration
 */
$cfg['Servers'][1]['auth_type'] = 'signon';
$cfg['Servers'][1]['SignonSession'] = 'SignonSession';
$cfg['Servers'][1]['SignonURL'] = 'sso.php';
$cfg['Servers'][1]['host'] = '127.0.0.1';
$cfg['Servers'][1]['port'] = 3306;
$cfg['Servers'][1]['connect_type'] = 'tcp';
$cfg['Servers'][1]['compress'] = false;
$cfg['Servers'][1]['AllowNoPassword'] = false;
`;

fs.writeFileSync('./scripts/sso.php', ssoPhp, 'utf-8');
fs.writeFileSync('./scripts/01-sso.php', ssoConfig, 'utf-8');

try {
  execSync('wsl -d Ubuntu -u root cp ./scripts/sso.php /usr/share/phpmyadmin/sso.php', { stdio: 'inherit' });
  execSync('wsl -d Ubuntu -u root chmod 644 /usr/share/phpmyadmin/sso.php', { stdio: 'inherit' });
  execSync('wsl -d Ubuntu -u root cp ./scripts/01-sso.php /etc/phpmyadmin/conf.d/01-sso.php', { stdio: 'inherit' });
  execSync('wsl -d Ubuntu -u root chmod 644 /etc/phpmyadmin/conf.d/01-sso.php', { stdio: 'inherit' });
  execSync('wsl -d Ubuntu -u root systemctl reload nginx', { stdio: 'inherit' });
  console.log('phpMyAdmin SSO deployed successfully!');
} catch (e) {
  console.error('Failed to deploy SSO files:', e);
}
