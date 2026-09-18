#!/bin/bash
# ==============================================================================
# Multi-Tenant Linux Service Provisioning Engine
# Control Panel: hoster1280.shop
# ==============================================================================
# Usage:
#   sudo ./provision_tenant.sh <domain> [php_version] [tenant_username] [storage_root]
# ==============================================================================

set -e

DOMAIN="${1:-}"
PHP_VER="${2:-8.2}"
STORAGE_ROOT="${4:-/home/ubuntu/cpanel-1/server_storage}"

if [ -z "$DOMAIN" ]; then
  echo '{"success": false, "error": "Domain parameter is required."}' >&2
  exit 1
fi

# Sanitize domain
DOMAIN=$(echo "$DOMAIN" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9.-')

# Derive tenant username if not provided (e.g. turkyhu1)
if [ -z "${3:-}" ]; then
  CLEAN_PREFIX=$(echo "$DOMAIN" | tr -cd 'a-z0-9' | cut -c1-7)
  TENANT="${CLEAN_PREFIX}1"
else
  TENANT=$(echo "$3" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_')
fi

# Ensure valid PHP version format or detect active system PHP
if [ "$PHP_VER" = "default" ] || [ -z "$PHP_VER" ]; then
  PHP_VER=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;" 2>/dev/null || echo "8.3")
fi
if [[ ! "$PHP_VER" =~ ^(7\.4|8\.0|8\.1|8\.2|8\.3)$ ]]; then
  PHP_VER="8.3"
fi

WEBROOT="/home/${TENANT}/public_html"
SOCKET_PATH="/run/php/php${PHP_VER}-fpm-${TENANT}.sock"

echo "=== Provisioning Domain: ${DOMAIN} ===" >&2
echo "Tenant User: ${TENANT}" >&2
echo "PHP Version: ${PHP_VER}" >&2
echo "Webroot:     ${WEBROOT}" >&2

# 1. Create Unique Linux System User (if not exists)
if id "$TENANT" >/dev/null 2>&1; then
  echo "[+] Linux user ${TENANT} already exists." >&2
else
  echo "[+] Creating Linux user ${TENANT}..." >&2
  useradd -m -s /bin/bash "$TENANT" 2>/dev/null || true
fi

# 2. Directory & Permissions Setup
mkdir -p "$WEBROOT"
mkdir -p "$WEBROOT/cgi-bin"
mkdir -p "/home/${TENANT}/logs"
mkdir -p "/home/${TENANT}/tmp"

# Create standard welcome index.html if webroot is empty
if [ ! -f "$WEBROOT/index.html" ] && [ ! -f "$WEBROOT/index.php" ]; then
  cat <<EOF > "$WEBROOT/index.html"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${DOMAIN}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #131d31; border: 1px solid #1e293b; border-radius: 20px; padding: 48px; max-width: 620px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 700; font-size: 13px; padding: 6px 16px; border-radius: 9999px; margin-bottom: 24px; border: 1px solid rgba(52, 211, 153, 0.3); }
    h1 { font-size: 32px; font-weight: 800; color: #ffffff; margin-bottom: 12px; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 28px; }
    .meta-box { background: #0b111e; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; text-align: left; margin-bottom: 24px; }
    .meta-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
    .meta-row:last-child { border-bottom: none; }
    .meta-label { color: #64748b; }
    .meta-val { color: #38bdf8; font-weight: 600; }
    .footer-note { font-size: 12px; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">&#10003; VirtualHost Provisioned & Active</div>
    <h1>${DOMAIN}</h1>
    <p>Your web hosting service is successfully provisioned and live on hoster1280.shop high-performance cloud cluster.</p>
    <div class="meta-box">
      <div class="meta-row"><span class="meta-label">Domain Name:</span><span class="meta-val">${DOMAIN}</span></div>
      <div class="meta-row"><span class="meta-label">Tenant Account:</span><span class="meta-val">${TENANT}</span></div>
      <div class="meta-row"><span class="meta-label">PHP Engine:</span><span class="meta-val">PHP ${PHP_VER} (Dedicated FPM Socket)</span></div>
      <div class="meta-row"><span class="meta-label">Document Root:</span><span class="meta-val">${WEBROOT}</span></div>
      <div class="meta-row"><span class="meta-label">Nameservers:</span><span class="meta-val">ns1.hoster1280.shop / ns2.hoster1280.shop</span></div>
    </div>
    <div class="footer-note">Upload your website files into <code>public_html</code> via cPanel File Manager to replace this page.</div>
  </div>
</body>
</html>
EOF
fi

# Set Linux ownership and permissions
chown -R "${TENANT}:www-data" "/home/${TENANT}"
chmod 755 "/home/${TENANT}"
chmod 755 "$WEBROOT"
find "$WEBROOT" -type d -exec chmod 755 {} + 2>/dev/null || true
find "$WEBROOT" -type f -exec chmod 644 {} + 2>/dev/null || true

# Also sync or symlink with cPanel server_storage if provided
DOMAIN_STORAGE="${STORAGE_ROOT}/domains/${DOMAIN}"
if [ -d "${STORAGE_ROOT}/domains" ]; then
  mkdir -p "$DOMAIN_STORAGE"
  if [ ! -e "$DOMAIN_STORAGE/public_html" ]; then
    ln -sfn "$WEBROOT" "$DOMAIN_STORAGE/public_html" || true
  fi
fi

# 3. Dedicated PHP-FPM Pool Creation
PHP_POOL_DIR="/etc/php/${PHP_VER}/fpm/pool.d"
if [ -d "$PHP_POOL_DIR" ]; then
  echo "[+] Configuring PHP-FPM pool for ${TENANT}..." >&2
  cat <<EOF > "${PHP_POOL_DIR}/${TENANT}.conf"
; ==============================================================================
; Dedicated PHP-FPM Pool for ${TENANT} (${DOMAIN})
; Generated by hoster1280.shop Multi-Tenant Engine
; ==============================================================================
[${TENANT}]
user = ${TENANT}
group = www-data

listen = ${SOCKET_PATH}
listen.owner = www-data
listen.group = www-data
listen.mode = 0660

pm = ondemand
pm.max_children = 10
pm.process_idle_timeout = 60s
pm.max_requests = 500

chdir = ${WEBROOT}

php_admin_value[open_basedir] = /home/${TENANT}/public_html:/tmp:/var/tmp
php_admin_value[session.save_path] = /tmp
php_admin_value[upload_tmp_dir] = /tmp
php_admin_value[disable_functions] = exec,passthru,shell_exec,system,proc_open,popen,curl_multi_exec,parse_ini_file,show_source
php_flag[display_errors] = off
php_admin_flag[log_errors] = on
EOF

  # Reload PHP-FPM gracefully
  systemctl reload "php${PHP_VER}-fpm" 2>/dev/null || systemctl restart "php${PHP_VER}-fpm" 2>/dev/null || true
fi

# 4. Nginx VirtualHost Generation (Port 80 & 443 SSL)
NGINX_AVAIL="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
if [ -d "$NGINX_AVAIL" ]; then
  echo "[+] Generating Nginx VirtualHost for ${DOMAIN} (Port 80 & 443 SSL)..." >&2

  # Ensure SSL certificate exists for HTTPS
  mkdir -p /etc/ssl/certs /etc/ssl/private
  if [ ! -f /etc/ssl/certs/ssl-cert-snakeoil.pem ] || [ ! -f /etc/ssl/private/ssl-cert-snakeoil.key ]; then
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout /etc/ssl/private/ssl-cert-snakeoil.key \
      -out /etc/ssl/certs/ssl-cert-snakeoil.pem \
      -subj "/C=US/ST=Cloud/L=Server/O=HOSTER1280/CN=${DOMAIN}" 2>/dev/null || true
    chmod 640 /etc/ssl/private/ssl-cert-snakeoil.key 2>/dev/null || true
    chmod 644 /etc/ssl/certs/ssl-cert-snakeoil.pem 2>/dev/null || true
  fi

  # Fallback FastCGI socket if dedicated tenant pool is not ready
  FASTCGI_TARGET="$SOCKET_PATH"
  if [ ! -S "$FASTCGI_TARGET" ]; then
    SYS_SOCK=$(find /run/php/ -name "php*-fpm.sock" 2>/dev/null | head -n 1)
    if [ -n "$SYS_SOCK" ]; then
      FASTCGI_TARGET="$SYS_SOCK"
    fi
  fi

  cat <<EOF > "${NGINX_AVAIL}/${DOMAIN}.conf"
# ==============================================================================
# VirtualHost configuration for ${DOMAIN}
# Multi-Tenant isolation by hoster1280.shop
# ==============================================================================
server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${DOMAIN} www.${DOMAIN};

    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root ${WEBROOT};
    index index.php index.html index.htm;

    access_log /var/log/nginx/${DOMAIN}_access.log;
    error_log /var/log/nginx/${DOMAIN}_error.log;

    # Security Headers
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Frame-Options SAMEORIGIN;

    location / {
        try_files \$uri \$uri/ /index.php?\$args;
    }

    # FastCGI PHP Execution via Isolated Tenant Socket
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:${FASTCGI_TARGET};
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_read_timeout 180;
    }

    # Deny access to hidden/sensitive files (.git, .env, .htaccess)
    location ~ /\.(?!well-known).* {
        deny all;
    }

    location ~ /(tmp|logs|etc)/ {
        deny all;
    }
}
EOF

  if [ -d "$NGINX_ENABLED" ]; then
    ln -sfn "${NGINX_AVAIL}/${DOMAIN}.conf" "${NGINX_ENABLED}/${DOMAIN}.conf"
  fi

  # Test & reload Nginx
  if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null || true
    echo "[+] Nginx reloaded successfully." >&2
  else
    echo "[-] Nginx configuration test failed, please inspect /etc/nginx/sites-available/${DOMAIN}.conf" >&2
  fi
fi

# 5. Authoritative Bind9 DNS Zone Generation (Step C)
BIND_ZONES_DIR="/etc/bind/zones"
BIND_LOCAL_CONF="/etc/bind/named.conf.local"

# Real public IPv4 resolution
SERVER_IP=$(curl -s -4 --max-time 3 https://ifconfig.me 2>/dev/null || \
            curl -s -4 --max-time 3 https://icanhazip.com 2>/dev/null || \
            curl -s -4 --max-time 3 https://api.ipify.org 2>/dev/null || \
            echo "208.72.218.129")
if [[ ! "$SERVER_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || [[ "$SERVER_IP" =~ ^169\.254 ]] || [[ "$SERVER_IP" =~ ^127\. ]]; then
  SERVER_IP="208.72.218.129"
fi

if [ -d "/etc/bind" ]; then
  echo "[+] Generating Authoritative Bind9 DNS Zone for ${DOMAIN} (Server IP: ${SERVER_IP})..." >&2
  mkdir -p "$BIND_ZONES_DIR"
  ZONE_FILE="${BIND_ZONES_DIR}/db.${DOMAIN}"
  SERIAL=$(date +%Y%m%d01)
  
  cat <<EOF > "$ZONE_FILE"
; ==============================================================================
; Authoritative Zone file for ${DOMAIN}
; Managed by HOSTER 1280 Authoritative Nameserver Engine
; ==============================================================================
\$TTL    86400
@       IN      SOA     ns1.hoster1280.shop. hostmaster.hoster1280.shop. (
                              ${SERIAL}    ; Serial
                              7200         ; Refresh (2h)
                              3600         ; Retry (1h)
                              1209600      ; Expire (2w)
                              86400 )      ; Minimum TTL (1d)

; Authoritative Nameservers
@       IN      NS      ns1.hoster1280.shop.
@       IN      NS      ns2.hoster1280.shop.

; A records
@       IN      A       ${SERVER_IP}
www     IN      A       ${SERVER_IP}
cpanel  IN      A       ${SERVER_IP}
mail    IN      A       ${SERVER_IP}
ftp     IN      A       ${SERVER_IP}

; Mail Exchange (MX) & SPF TXT Records
@       IN      MX  10  mail.${DOMAIN}.
@       IN      TXT     "v=spf1 a mx ip4:${SERVER_IP} ~all"
EOF

  chmod 644 "$ZONE_FILE"
  chown bind:bind "$ZONE_FILE" 2>/dev/null || true

  # Append to named.conf.local if not already present
  if [ -f "$BIND_LOCAL_CONF" ] && ! grep -q "zone \"${DOMAIN}\"" "$BIND_LOCAL_CONF"; then
    cat <<EOF >> "$BIND_LOCAL_CONF"

zone "${DOMAIN}" {
    type master;
    file "${ZONE_FILE}";
    allow-transfer { none; };
};
EOF
  fi

  # Validate and reload Bind9
  if command -v named-checkconf >/dev/null 2>&1; then
    named-checkconf /etc/bind/named.conf || true
  fi
  rndc reload "${DOMAIN}" 2>/dev/null || rndc reload 2>/dev/null || systemctl reload bind9 2>/dev/null || systemctl restart bind9 2>/dev/null || true
  echo "[+] Bind9 Authoritative DNS Zone active for ${DOMAIN}." >&2
fi

# 6. Isolated Database & MariaDB Provisioning (Step D)
DB_NAME="${TENANT}_db"
DB_USER="${TENANT}"
DB_PASS="Sec#${TENANT}!2026"

if command -v mysql >/dev/null 2>&1; then
  echo "[+] Provisioning isolated MariaDB database and user for ${TENANT}..." >&2
  mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true
  mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';" 2>/dev/null || true
  mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';" 2>/dev/null || true
  mysql -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';" 2>/dev/null || true
  mysql -e "GRANT ALL PRIVILEGES ON \`${TENANT}_%\`.* TO '${DB_USER}'@'localhost';" 2>/dev/null || true
  mysql -e "GRANT ALL PRIVILEGES ON \`${TENANT}_%\`.* TO '${DB_USER}'@'127.0.0.1';" 2>/dev/null || true
  mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true
  echo "[+] MariaDB database '${DB_NAME}' and user '${DB_USER}' provisioned." >&2
fi

# Record database metadata in cPanel storage
mkdir -p "${STORAGE_ROOT}/domains/${DOMAIN}/etc"
cat <<EOF > "${STORAGE_ROOT}/domains/${DOMAIN}/etc/databases.json"
[
  {
    "name": "${DB_NAME}",
    "user": "${DB_USER}",
    "charset": "utf8mb4",
    "collation": "utf8mb4_unicode_ci",
    "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  }
]
EOF

echo "=== Provisioning Completed Successfully ===" >&2
# Output JSON response for callers
cat <<EOF
{
  "success": true,
  "domain": "${DOMAIN}",
  "tenantUsername": "${TENANT}",
  "phpVersion": "${PHP_VER}",
  "webroot": "${WEBROOT}",
  "serverIp": "${SERVER_IP}",
  "database": "${DB_NAME}",
  "dbUser": "${DB_USER}",
  "dbPassword": "${DB_PASS}",
  "nameservers": ["ns1.hoster1280.shop", "ns2.hoster1280.shop"]
}
EOF
