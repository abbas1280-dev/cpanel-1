#!/bin/bash
# ==============================================================================
# HOSTER 1280 - MASTER PRODUCTION SYSTEM SYNC AND ARCHITECTURE HARMONIZATION
# ==============================================================================
# Canonical Webroot: /var/www/vhosts/{domain}/public_html
# Public VPS IP: 208.72.218.129
# ==============================================================================

set -e

echo "================================================================================"
echo "    HOSTER 1280 - MASTER PRODUCTION SYSTEM SYNC AND CANONICAL ARCHITECTURE      "
echo "================================================================================"

if [ "$EUID" -ne 0 ]; then
  echo "[!] This script must be run as root or with sudo." >&2
  exit 1
fi

PUBLIC_IP="208.72.218.129"
APP_DIR="/home/ubuntu/cpanel-1"
STORAGE_DIR="${APP_DIR}/server_storage"
VHOST_BASE="/var/www/vhosts"

echo "[1/7] Ensuring Canonical Base Directories and Permissions..."
mkdir -p "$VHOST_BASE"
chmod 755 "$VHOST_BASE"
chmod 755 /home/ubuntu 2>/dev/null || true

# Detect active PHP-FPM socket
PHP_SOCK=$(find /run/php/ -name "php*-fpm.sock" 2>/dev/null | head -n 1)
if [ -z "$PHP_SOCK" ]; then
  PHP_SOCK="/run/php/php8.3-fpm.sock"
fi
echo "[+] Detected PHP-FPM Socket: ${PHP_SOCK}"

# Ensure default SSL certificates
mkdir -p /etc/ssl/certs /etc/ssl/private
if [ ! -f /etc/ssl/certs/ssl-cert-snakeoil.pem ] || [ ! -f /etc/ssl/private/ssl-cert-snakeoil.key ]; then
  echo "[+] Generating default Snakeoil SSL certificate..."
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/ssl/private/ssl-cert-snakeoil.key \
    -out /etc/ssl/certs/ssl-cert-snakeoil.pem \
    -subj "/C=US/ST=Cloud/L=Server/O=HOSTER1280/CN=hoster1280.shop" 2>/dev/null || true
  chmod 640 /etc/ssl/private/ssl-cert-snakeoil.key 2>/dev/null || true
  chmod 644 /etc/ssl/certs/ssl-cert-snakeoil.pem 2>/dev/null || true
fi

echo "[2/7] Discovering Domains across Services and Storage..."
DOMAINS=()

# Extract from services.json
if [ -f "${STORAGE_DIR}/services.json" ]; then
  while IFS= read -r dom; do
    if [ -n "$dom" ] && [ "$dom" != "null" ]; then
      DOMAINS+=("$dom")
    fi
  done < <(grep -o '"domain": *"[^"]*"' "${STORAGE_DIR}/services.json" | cut -d'"' -f4 | tr '[:upper:]' '[:lower:]' | sort -u)
fi

# Extract from server_storage/domains
if [ -d "${STORAGE_DIR}/domains" ]; then
  for d in "${STORAGE_DIR}/domains"/*; do
    if [ -d "$d" ] || [ -L "$d" ]; then
      dom=$(basename "$d" | tr '[:upper:]' '[:lower:]')
      DOMAINS+=("$dom")
    fi
  done
fi

# Always include core domains
DOMAINS+=("hoster1280.shop")
DOMAINS+=("turkyhub.com")

# Unique list
UNIQUE_DOMAINS=($(printf "%s
" "${DOMAINS[@]}" | sort -u))

echo "[+] Discovered Domains: ${UNIQUE_DOMAINS[*]}"

echo "[3/7] Harmonizing Canonical Paths under /var/www/vhosts/..."
for DOMAIN in "${UNIQUE_DOMAINS[@]}"; do
  [ -z "$DOMAIN" ] && continue
  
  VHOST_DIR="${VHOST_BASE}/${DOMAIN}"
  WEBROOT="${VHOST_DIR}/public_html"
  mkdir -p "$WEBROOT"
  mkdir -p "$WEBROOT/cgi-bin"
  mkdir -p "${VHOST_DIR}/logs"
  mkdir -p "${VHOST_DIR}/etc"
  mkdir -p "${VHOST_DIR}/ssl"
  mkdir -p "${VHOST_DIR}/tmp"
  mkdir -p "${VHOST_DIR}/mail"
  mkdir -p "${VHOST_DIR}/public_ftp"

  # Migrate files from server_storage/domains if it was a physical dir
  STORAGE_DOMAIN="${STORAGE_DIR}/domains/${DOMAIN}"
  if [ -d "$STORAGE_DOMAIN" ] && [ ! -L "$STORAGE_DOMAIN" ]; then
    echo "    -> Migrating data from ${STORAGE_DOMAIN} to ${VHOST_DIR}..."
    cp -rn "$STORAGE_DOMAIN/"* "$VHOST_DIR/" 2>/dev/null || true
    rm -rf "$STORAGE_DOMAIN"
  fi
  # Ensure symlink from server_storage to vhost
  if [ -d "${STORAGE_DIR}/domains" ]; then
    ln -sfn "$VHOST_DIR" "$STORAGE_DOMAIN" 2>/dev/null || true
  fi

  # Link tenant user home if tenant user exists
  CLEAN_PREFIX=$(echo "$DOMAIN" | tr -cd 'a-z0-9' | cut -c1-7)
  TENANT="${CLEAN_PREFIX}1"
  if id "$TENANT" >/dev/null 2>&1; then
    mkdir -p "/home/${TENANT}"
    ln -sfn "$WEBROOT" "/home/${TENANT}/public_html" 2>/dev/null || true
    chown -R "${TENANT}:www-data" "/home/${TENANT}" 2>/dev/null || true
  fi

  # Create default welcome index.html if empty
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
    <div class="badge">&#10003; VirtualHost Active</div>
    <h1>${DOMAIN}</h1>
    <p>Your web hosting service is successfully provisioned and active on HOSTER 1280 cloud cluster.</p>
    <div class="meta-box">
      <div class="meta-row"><span class="meta-label">Domain:</span><span class="meta-val">${DOMAIN}</span></div>
      <div class="meta-row"><span class="meta-label">Document Root:</span><span class="meta-val">${WEBROOT}</span></div>
      <div class="meta-row"><span class="meta-label">Server IP:</span><span class="meta-val">${PUBLIC_IP}</span></div>
    </div>
    <div class="footer-note">Upload your files into <code>public_html</code> via cPanel File Manager to replace this page.</div>
  </div>
</body>
</html>
EOF
  fi

  # Set robust web server permissions
  chown -R www-data:www-data "$VHOST_DIR"
  chmod 755 "$VHOST_DIR"
  chmod 755 "$WEBROOT"
  find "$WEBROOT" -type d -exec chmod 755 {} + 2>/dev/null || true
  find "$WEBROOT" -type f -exec chmod 644 {} + 2>/dev/null || true
done

echo "[4/7] Configuring Nginx VirtualHosts for All Domains..."
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

for DOMAIN in "${UNIQUE_DOMAINS[@]}"; do
  [ -z "$DOMAIN" ] && continue
  
  VHOST_DIR="${VHOST_BASE}/${DOMAIN}"
  WEBROOT="${VHOST_DIR}/public_html"
  CONF_PATH="/etc/nginx/sites-available/${DOMAIN}.conf"

  # SSL Certificate check
  SSL_CERT="/etc/ssl/certs/ssl-cert-snakeoil.pem"
  SSL_KEY="/etc/ssl/private/ssl-cert-snakeoil.key"
  if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" ]; then
    SSL_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
    SSL_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
  fi

  if [ "$DOMAIN" = "hoster1280.shop" ]; then
    # Main cPanel control panel reverse proxy
    cat <<EOF > "$CONF_PATH"
# ==============================================================================
# HOSTER 1280 - PRIMARY CONTROL PANEL VIRTUALHOST
# ==============================================================================
server {
    listen 80;
    listen [::]:80;
    server_name hoster1280.shop www.hoster1280.shop;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name hoster1280.shop www.hoster1280.shop;

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 512M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }
}
EOF
  else
    # Customer multi-tenant domain virtualhost
    cat <<EOF > "$CONF_PATH"
# ==============================================================================
# VirtualHost for ${DOMAIN}
# Canonical DocRoot: ${WEBROOT}
# ==============================================================================
server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${DOMAIN} www.${DOMAIN};

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root ${WEBROOT};
    index index.php index.html index.htm;

    access_log /var/log/nginx/${DOMAIN}_access.log;
    error_log /var/log/nginx/${DOMAIN}_error.log;

    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Frame-Options SAMEORIGIN;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:${PHP_SOCK};
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_read_timeout 180;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }

    location ~ /\.ht {
        deny all;
    }
}
EOF
  fi

  ln -sfn "$CONF_PATH" "/etc/nginx/sites-enabled/${DOMAIN}.conf"
done

# Remove default Nginx welcome page if present
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

echo "[5/7] Testing and Reloading Nginx..."
nginx -t
systemctl reload nginx || systemctl restart nginx
echo "[+] Nginx successfully reloaded!"

echo "[6/7] Ensuring Bind9 Authoritative DNS Zones..."
if command -v named >/dev/null 2>&1; then
  cat <<EOF > /etc/bind/named.conf.options
options {
    directory "/var/cache/bind";
    listen-on { any; };
    listen-on-v6 { any; };
    allow-query { any; };
    recursion no;
    dnssec-validation auto;
    auth-nxdomain no;
};
EOF

  NAMED_LOCAL="/etc/bind/named.conf.local"
  touch "$NAMED_LOCAL"

  for DOMAIN in "${UNIQUE_DOMAINS[@]}"; do
    [ -z "$DOMAIN" ] && continue
    ZONE_FILE="/etc/bind/db.${DOMAIN}"
    
    if ! grep -q "zone \"${DOMAIN}\"" "$NAMED_LOCAL"; then
      cat <<EOF >> "$NAMED_LOCAL"

zone "${DOMAIN}" {
    type master;
    file "/etc/bind/db.${DOMAIN}";
};
EOF
    fi

    SERIAL=$(date +%Y%m%d%H)
    # Write zone file
    cat <<EOF > "$ZONE_FILE"
$TTL 86400
@   IN  SOA ns1.hoster1280.shop. hostmaster.hoster1280.shop. (
            ${SERIAL} ; Serial
            3600       ; Refresh
            1800       ; Retry
            604800     ; Expire
            86400 )    ; Minimum TTL

@       IN  NS      ns1.hoster1280.shop.
@       IN  NS      ns2.hoster1280.shop.

@       IN  A       ${PUBLIC_IP}
www     IN  A       ${PUBLIC_IP}
cpanel  IN  A       ${PUBLIC_IP}
mail    IN  A       ${PUBLIC_IP}
ftp     IN  A       ${PUBLIC_IP}
ns1     IN  A       ${PUBLIC_IP}
ns2     IN  A       ${PUBLIC_IP}
@       IN  MX  10  mail.${DOMAIN}.
@       IN  TXT     "v=spf1 a mx ip4:${PUBLIC_IP} ~all"
EOF
  done

  named-checkconf || true
  systemctl restart bind9 || systemctl restart named || true
  echo "[+] Bind9 Authoritative DNS Zones active and reloaded!"
fi

echo "[7/7] Restarting PM2 Application Services..."
if command -v pm2 >/dev/null 2>&1; then
  sudo -u ubuntu pm2 restart all || pm2 restart all || true
  echo "[+] PM2 restarted successfully!"
fi

echo "================================================================================"
echo "                 PRODUCTION SYSTEM HARMONIZATION COMPLETE!                      "
echo "================================================================================"
echo "Active Domains:"
for DOMAIN in "${UNIQUE_DOMAINS[@]}"; do
  echo "  - https://${DOMAIN} -> /var/www/vhosts/${DOMAIN}/public_html"
done
echo "================================================================================"
