<?php
/**
 * phpMyAdmin Signon SSO Configuration
 * Path: /etc/phpmyadmin/config.inc.php or /usr/share/phpmyadmin/config.inc.php
 */

declare(strict_types=1);

$cfg['blowfish_secret'] = 'sitechai_cpanel_sso_secure_secret_key_32bytes_long!';

$i = 0;
$i++;

/* Authentication type: Signon */
$cfg['Servers'][$i]['auth_type'] = 'signon';
$cfg['Servers'][$i]['host'] = '127.0.0.1';
$cfg['Servers'][$i]['port'] = '3306';
$cfg['Servers'][$i]['connect_type'] = 'tcp';
$cfg['Servers'][$i]['compress'] = false;
$cfg['Servers'][$i]['AllowNoPassword'] = true;

/* SSO Session Parameters */
$cfg['Servers'][$i]['SignonSession'] = 'SitechaiPmaSSO';
$cfg['Servers'][$i]['SignonURL'] = '/phpmyadmin/signon.php';
$cfg['Servers'][$i]['LogoutURL'] = '/';

/* Directory for saving temporary files */
$cfg['TempDir'] = '/tmp';
$cfg['SendErrorReports'] = 'never';
$cfg['ShowPhpInfo'] = false;
$cfg['ShowChgPwd'] = true;
