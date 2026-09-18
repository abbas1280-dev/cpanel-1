<?php
declare(strict_types=1);

/**
 * HOSTER 1280 cPanel Jupiter - Production phpMyAdmin SSO Configuration
 */

// Fix HTTPS mismatch when behind Cloudflare / Freestyle Edge Reverse Proxy
if ((isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ||
    (isset($_SERVER['HTTP_CF_VISITOR']) && strpos($_SERVER['HTTP_CF_VISITOR'], 'https') !== false)) {
    $_SERVER['HTTPS'] = 'on';
}

$cfg['blowfish_secret'] = 'sitechai_cpanel_jupiter_super_secret_blowfish_key_2026_32bytes';

$i = 0;
$i++;

/* Authentication type: signon for seamless cPanel SSO */
$cfg['Servers'][$i]['auth_type'] = 'signon';
$cfg['Servers'][$i]['SignonSession'] = 'SignonSession';
$cfg['Servers'][$i]['SignonURL'] = 'sso.php';
$cfg['Servers'][$i]['host'] = '127.0.0.1';
$cfg['Servers'][$i]['port'] = '3306';
$cfg['Servers'][$i]['connect_type'] = 'tcp';
$cfg['Servers'][$i]['compress'] = false;
$cfg['Servers'][$i]['AllowNoPassword'] = false;

/* Reverse proxy subpath support */
if (!empty($_SERVER['HTTP_X_FORWARDED_PREFIX'])) {
    $cfg['PmaAbsoluteUri'] = $_SERVER['HTTP_X_FORWARDED_PREFIX'] . '/';
} elseif (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], '/phpmyadmin') !== false) {
    $cfg['PmaAbsoluteUri'] = '/phpmyadmin/';
}

/* Allow loading in cPanel iframe if needed */
$cfg['AllowThirdPartyFraming'] = true;
