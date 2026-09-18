<?php
/**
 * HOSTER 1280 Cloud Single Sign-On Configuration
 */
$cfg['Servers'][1]['auth_type'] = 'signon';
$cfg['Servers'][1]['SignonSession'] = 'SignonSession';
$cfg['Servers'][1]['SignonURL'] = 'sso.php';
$cfg['Servers'][1]['host'] = '127.0.0.1';
$cfg['Servers'][1]['port'] = 3306;
$cfg['Servers'][1]['connect_type'] = 'tcp';
$cfg['Servers'][1]['compress'] = false;
$cfg['Servers'][1]['AllowNoPassword'] = false;

// Support reverse proxy subpath (/phpmyadmin/)
if (!empty($_SERVER['HTTP_X_FORWARDED_PREFIX'])) {
    $cfg['PmaAbsoluteUri'] = $_SERVER['HTTP_X_FORWARDED_PREFIX'] . '/';
} elseif (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], '/phpmyadmin') !== false) {
    $cfg['PmaAbsoluteUri'] = '/phpmyadmin/';
}
