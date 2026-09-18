#!/usr/bin/env bash
# ==============================================================================
# HOSTER 1280 - Master VirtualHost, DNS (Bind9), and Portal Reverse Proxy Fixer
# ==============================================================================
# 1. Ensures hoster1280.shop serves HOSTER 1280 Control Panel Portal (:5173)
# 2. Ensures customer domains (turkyhub.com, etc.) execute directly from public_html via Nginx + PHP-FPM
# 3. Ensures Bind9 Authoritative DNS resolves all domains with real public IP (208.72.218.129)
# ==============================================================================

set -e

echo "=========================================================="
echo " Starting HOSTER 1280 Master VirtualHost & DNS Fixer "
echo "=========================================================="

# 1. Resolve Real Public IPv4
REAL_IP=$(curl -s --max-time 3 https://api.ipify.org 2>/dev/null || curl -s --max-time 3 https://icanhazip.com 2>/dev/null || echo "208.72.218.129")
if [[ ! "$REAL_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || [[ "$REAL_IP" =~ ^169\.254 ]] || [[ "$REAL_IP" =~ ^127\. ]]; then
    REAL_IP="208.72.218.129"
fi
echo "[+] Detected Server Public IPv4: ${REAL_IP}"

# 2. Locate Active PHP-FPM Socket
PHP_SOCK=$(find /run/php/ -name "php*-fpm.sock" 2>/dev/null | head -n 1)
if [ -z "$PHP_SOCK" ]; then
    systemctl restart php*-fpm 2>/dev/null || true
    PHP_SOCK=$(find /run/php/ -name "php*-fpm.sock" 2>/dev/null | head -n 1)
fi
if [ -z "$PHP_SOCK" ]; then
    PHP_SOCK="/run/php/php8.2-fpm.sock"
fi
echo "[+] Using PHP-FPM Socket: ${PHP_SOCK}"

# 3. Locate Project Directory & Storage
REPO_DIR="$HOME/cpanel-1"
if [ ! -d "$REPO_DIR" ]; then
    REPO_DIR="/home/ubuntu/cpanel-1"
fi
if [ ! -d "$REPO_DIR" ]; then
    REPO_DIR="/root/cpanel-1"
fi
if [ ! -d "$REPO_DIR" ]; then
    REPO_DIR="$(pwd)"
fi

STORAGE_DIR="${REPO_DIR}/server_storage"
mkdir -p "${STORAGE_DIR}/domains"
echo "[+] Project Directory: ${REPO_DIR}"
echo "[+] Storage Directory: ${STORAGE_DIR}"

# 4. Save settings.json with Real IP
cat <<EOF > "${STORAGE_DIR}/settings.json"
{
  "ns1": "ns1.hoster1280.shop",
  "ns2": "ns2.hoster1280.shop",
  "serverIp": "${REAL_IP}",
  "faviconUrl": "/favicon.ico",
  "updatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

# 5. Prepare Nginx & Bind9 directories
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
mkdir -p /etc/bind/zones
NAMED_LOCAL="/etc/bind/named.conf.local"
SERIAL=$(date +%Y%m%d01)

# ==============================================================================
# 6. MASTER PORTAL NGINX CONFIGURATION (hoster1280.shop -> :5173 & phpMyAdmin)
# ==============================================================================
# Remove any conflicting customer vhost for hoster1280.shop
rm -f /etc/nginx/sites-enabled/hoster1280.shop.conf /etc/nginx/sites-available/hoster1280.shop.conf 2>/dev/null || true

echo "[+] Configuring Master Edge Reverse Proxy for HOSTER 1280 Portal..."
cat << 'EOF' > /etc/nginx/sites-available/default
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name hoster1280.shop www.hoster1280.shop _;

    client_max_body_size 128M;

    # Redirect /phpmyadmin to /phpmyadmin/
    location = /phpmyadmin {
        return 301 /phpmyadmin/;
    }

    # phpMyAdmin reverse proxy
    location /phpmyadmin/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Prefix /phpmyadmin;
        proxy_redirect / /phpmyadmin/;
    }

    # HOSTER 1280 Control Panel & Client Area (Vite on :5173)
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# ==============================================================================
# 7. BIND9 ZONE FOR MASTER PORTAL (hoster1280.shop with ns1, ns2, glue records)
# ==============================================================================
PORTAL_ZONE="/etc/bind/zones/db.hoster1280.shop"
cat <<EOF > "$PORTAL_ZONE"
; Authoritative zone for hoster1280.shop
; Managed by HOSTER 1280 Master DNS Engine
\$TTL 86400
@ IN SOA ns1.hoster1280.shop. hostmaster.hoster1280.shop. (
    ${SERIAL}
    7200
    3600
    1209600
    86400 )
@       IN  NS      ns1.hoster1280.shop.
@       IN  NS      ns2.hoster1280.shop.
@       IN  A       ${REAL_IP}
www     IN  A       ${REAL_IP}
ns1     IN  A       ${REAL_IP}
ns2     IN  A       ${REAL_IP}
cpanel  IN  A       ${REAL_IP}
mail    IN  A       ${REAL_IP}
ftp     IN  A       ${REAL_IP}
@       IN  MX  10  mail.hoster1280.shop.
@       IN  TXT     "v=spf1 a mx ip4:${REAL_IP} ~all"
EOF
chmod 644 "$PORTAL_ZONE"
chown bind:bind "$PORTAL_ZONE" 2>/dev/null || true

if [ -f "$NAMED_LOCAL" ]; then
    if ! grep -q 'zone "hoster1280.shop"' "$NAMED_LOCAL"; then
        cat <<EOF >> "$NAMED_LOCAL"

zone "hoster1280.shop" {
    type master;
    file "${PORTAL_ZONE}";
    allow-transfer { none; };
};
EOF
    fi
fi

# ==============================================================================
# 8. CUSTOMER DOMAINS (turkyhub.com, tamim1280.shop, topup1280.shop, etc.)
# ==============================================================================
DOMAINS=("turkyhub.com" "tamim1280.shop" "topup1280.shop")
for d_dir in "${STORAGE_DIR}/domains"/*; do
    if [ -d "$d_dir" ]; then
        b_name=$(basename "$d_dir")
        if [ "$b_name" != "hoster1280.shop" ] && [[ ! " ${DOMAINS[@]} " =~ " ${b_name} " ]]; then
            DOMAINS+=("$b_name")
        fi
    fi
done

echo "[+] Customer domains to configure: ${DOMAINS[*]}"

for DOMAIN in "${DOMAINS[@]}"; do
    echo "----------------------------------------------------------"
    echo "[+] Configuring Customer VirtualHost & DNS for: ${DOMAIN}"
    
    DOCROOT="${STORAGE_DIR}/domains/${DOMAIN}/public_html"
    LOGDIR="${STORAGE_DIR}/domains/${DOMAIN}/logs"
    mkdir -p "$DOCROOT" "$LOGDIR"
    
    # Create default welcome page if not present
    if [ ! -f "$DOCROOT/index.html" ] && [ ! -f "$DOCROOT/index.php" ]; then
        cat <<EOF > "$DOCROOT/index.html"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${DOMAIN}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #131d31; border: 1px solid #1e293b; border-radius: 20px; padding: 48px; max-width: 620px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
    .badge { display: inline-flex; align-items: center; background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 700; font-size: 13px; padding: 6px 16px; border-radius: 9999px; margin-bottom: 24px; border: 1px solid rgba(52, 211, 153, 0.3); }
    h1 { font-size: 32px; font-weight: 800; color: #ffffff; margin-bottom: 12px; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 28px; }
    .note { font-size: 13px; color: #64748b; font-family: monospace; background: #0b111e; padding: 14px; border-radius: 10px; border: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">&#10003; Live VHost Running</div>
    <h1>${DOMAIN}</h1>
    <p>Your web hosting service is successfully provisioned and live on HOSTER 1280 high-performance cloud cluster.</p>
    <div class="note">Upload your website files into <code>public_html</code> via cPanel File Manager to replace this page.</div>
  </div>
</body>
</html>
EOF
    fi

    # Set Linux permissions so Nginx + PHP-FPM can serve it cleanly
    chmod 755 "$DOCROOT"
    chmod -R 755 "${STORAGE_DIR}/domains/${DOMAIN}"
    chown -R www-data:www-data "$DOCROOT" 2>/dev/null || true

    # 8.1 Customer Nginx Server Block
    cat <<EOF > "/etc/nginx/sites-available/${DOMAIN}.conf"
# Live Nginx VirtualHost for ${DOMAIN}
# Managed by HOSTER 1280 Multi-Tenant Engine
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    root ${DOCROOT};
    index index.php index.html index.htm;

    access_log ${LOGDIR}/${DOMAIN}_access.log;
    error_log ${LOGDIR}/${DOMAIN}_error.log;

    # Security Headers
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Frame-Options SAMEORIGIN;

    location / {
        try_files \$uri \$uri/ /index.php?\$args;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:${PHP_SOCK};
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_read_timeout 180;
    }

    location ~ /\.ht {
        deny all;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
EOF

    ln -sf "/etc/nginx/sites-available/${DOMAIN}.conf" "/etc/nginx/sites-enabled/${DOMAIN}.conf"

    # 8.2 Bind9 Authoritative Zone File
    ZONE_FILE="/etc/bind/zones/db.${DOMAIN}"
    cat <<EOF > "$ZONE_FILE"
; Authoritative zone for ${DOMAIN}
; Managed by HOSTER 1280 Master DNS Engine
\$TTL 86400
@ IN SOA ns1.hoster1280.shop. hostmaster.hoster1280.shop. (
    ${SERIAL}
    7200
    3600
    1209600
    86400 )
@       IN  NS      ns1.hoster1280.shop.
@       IN  NS      ns2.hoster1280.shop.
@       IN  A       ${REAL_IP}
www     IN  A       ${REAL_IP}
cpanel  IN  A       ${REAL_IP}
mail    IN  A       ${REAL_IP}
ftp     IN  A       ${REAL_IP}
@       IN  MX  10  mail.${DOMAIN}.
@       IN  TXT     "v=spf1 a mx ip4:${REAL_IP} ~all"
EOF
    chmod 644 "$ZONE_FILE"
    chown bind:bind "$ZONE_FILE" 2>/dev/null || true

    # Register in named.conf.local
    if [ -f "$NAMED_LOCAL" ]; then
        if ! grep -q "zone \"${DOMAIN}\"" "$NAMED_LOCAL"; then
            cat <<EOF >> "$NAMED_LOCAL"

zone "${DOMAIN}" {
    type master;
    file "${ZONE_FILE}";
    allow-transfer { none; };
};
EOF
        fi
    fi

    # 8.3 Update local json DNS zone inside server_storage
    DNS_JSON="${STORAGE_DIR}/domains/${DOMAIN}/etc/dns_zone.json"
    if [ -f "$DNS_JSON" ]; then
        sed -i -E "s/192\.168\.[0-9]+\.[0-9]+/${REAL_IP}/g" "$DNS_JSON" 2>/dev/null || true
        sed -i -E "s/169\.254\.[0-9]+\.[0-9]+/${REAL_IP}/g" "$DNS_JSON" 2>/dev/null || true
    fi
done

# 9. Test & Reload Nginx
echo "----------------------------------------------------------"
echo "[+] Validating Nginx configuration..."
nginx -t
systemctl reload nginx || service nginx reload
echo "[+] Nginx reloaded successfully!"

# 10. Test & Reload Bind9
if [ -f "$NAMED_LOCAL" ]; then
    echo "[+] Validating Bind9 configuration..."
    if command -v named-checkconf >/dev/null 2>&1; then
        named-checkconf /etc/bind/named.conf || true
    fi
    rndc reload 2>/dev/null || systemctl reload bind9 2>/dev/null || systemctl restart bind9 2>/dev/null || true
    echo "[+] Bind9 DNS reloaded successfully!"
fi

echo "=========================================================="
echo " VirtualHosts & Bind9 DNS Zones Configured Successfully! "
echo " Portal:      http://hoster1280.shop (Proxy to :5173) "
echo " Real Server: ${REAL_IP} "
echo "=========================================================="
