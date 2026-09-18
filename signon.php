<?php
/**
 * phpMyAdmin Single Sign-On (SSO) Bridge Handler
 * Location: /usr/share/phpmyadmin/signon.php
 */

session_name('SitechaiPmaSSO');
session_start();

$token = isset($_GET['token']) ? preg_replace('/[^a-f0-9]/', '', $_GET['token']) : '';

if (empty($token)) {
    http_response_code(400);
    die('Single Sign-On Error: Missing or invalid token.');
}

$tokenFile = '/tmp/cpanel_pma_sso/' . $token . '.json';

if (!file_exists($tokenFile)) {
    http_response_code(403);
    die('Single Sign-On Error: Token not found or already consumed.');
}

$data = json_decode(file_get_contents($tokenFile), true);

// One-time token consumption
unlink($tokenFile);

if (!$data || !isset($data['expiresAt']) || $data['expiresAt'] < (time() * 1000)) {
    http_response_code(401);
    die('Single Sign-On Error: Token expired.');
}

// Populate phpMyAdmin Signon session variables
$_SESSION['PMA_single_signon_user'] = $data['dbUser'] ?? 'root';
$_SESSION['PMA_single_signon_password'] = $data['dbPass'] ?? '';
$_SESSION['PMA_single_signon_host'] = '127.0.0.1';
$_SESSION['PMA_single_signon_port'] = 3306;

// Persist session and redirect into phpMyAdmin main interface
session_write_close();
header('Location: ./index.php');
exit;
