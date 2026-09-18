#!/bin/bash
# ==============================================================================
# Multi-Tenant Linux Service Termination & Server Purge Engine
# Platform: hoster1280.shop
# ==============================================================================
# Usage:
#   sudo ./terminate_service.sh <domain> [tenant_username] [storage_root]
# ==============================================================================

set -e

DOMAIN="${1:-}"
STORAGE_ROOT="${3:-/home/ubuntu/cpanel-1/server_storage}"

if [ -z "$DOMAIN" ]; then
  echo '{"success": false, "error": "Domain parameter is required for termination."}' >&2
  exit 1
fi

# Sanitize domain
DOMAIN=$(echo "$DOMAIN" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9.-')

# Derive tenant username if not provided (e.g. u_topup1280)
if [ -z "${2:-}" ]; then
  CLEAN_PREFIX=$(echo "$DOMAIN" | tr -cd 'a-z0-9' | cut -c1-8)
  TENANT="u_${CLEAN_PREFIX}"
else
  TENANT=$(echo "$2" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_')
fi

echo "=== Starting Service Termination for: ${DOMAIN} (Tenant: ${TENANT}) ===" >&2

PURGE_LOG=()

# ------------------------------------------------------------------------------
# STEP 1: Delete Webroot & Linux System User
# ------------------------------------------------------------------------------
echo "[1/7] Purging Webroot and Linux user..." >&2

# Kill any active processes running under this tenant user
if id "$TENANT" >/dev/null 2>&1; then
  pkill -u "$TENANT" 2>/dev/null || true
  sleep 1
  userdel -r -f "$TENANT" 2>/dev/null || true
  PURGE_LOG+=("Linux user '${TENANT}' deleted.")
else
  PURGE_LOG+=("Linux user '${TENANT}' not found, skipping userdel.")
fi

# Explicitly ensure /home/{tenant} directory is wiped
if [ -d "/home/${TENANT}" ]; then
  rm -rf "/home/${TENANT}"
  PURGE_LOG+=("Directory /home/${TENANT} removed.")
fi

# Remove storage folder in server_storage
DOMAIN_STORAGE="${STORAGE_ROOT}/domains/${DOMAIN}"
if [ -d "$DOMAIN_STORAGE" ]; then
  rm -rf "$DOMAIN_STORAGE"
  PURGE_LOG+=("Storage directory '${DOMAIN_STORAGE}' purged.")
fi

# ------------------------------------------------------------------------------
# STEP 2: Drop All Tenant MariaDB Databases & MySQL Users
# ------------------------------------------------------------------------------
echo "[2/7] Dropping MySQL databases and tenant user..." >&2
if command -v mysql >/dev/null 2>&1; then
  # Find and drop any database matching tenant prefix
  DB_LIST=$(mysql -NBe "SHOW DATABASES LIKE '${TENANT}%';" 2>/dev/null || true)
  if [ -n "$DB_LIST" ]; then
    for db in $DB_LIST; do
      mysql -e "DROP DATABASE IF EXISTS \`${db}\`;" 2>/dev/null || true
      PURGE_LOG+=("Dropped database '${db}'.")
    done
  fi

  # Drop tenant MySQL users
  mysql -e "DROP USER IF EXISTS '${TENANT}'@'localhost';" 2>/dev/null || true
  mysql -e "DROP USER IF EXISTS '${TENANT}'@'127.0.0.1';" 2>/dev/null || true
  mysql -e "DROP USER IF EXISTS '${TENANT}'@'%';" 2>/dev/null || true
  mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true
  PURGE_LOG+=("MySQL user '${TENANT}' dropped.")
else
  PURGE_LOG+=("MySQL CLI not detected, skipping DB purge.")
fi

# ------------------------------------------------------------------------------
# STEP 3: Remove Nginx / Webserver VirtualHost
# ------------------------------------------------------------------------------
echo "[3/7] Removing Nginx VirtualHost..." >&2
NGINX_AVAIL="/etc/nginx/sites-available/${DOMAIN}.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}.conf"

if [ -f "$NGINX_ENABLED" ]; then
  rm -f "$NGINX_ENABLED"
  PURGE_LOG+=("Removed '${NGINX_ENABLED}'.")
fi

if [ -f "$NGINX_AVAIL" ]; then
  rm -f "$NGINX_AVAIL"
  PURGE_LOG+=("Removed '${NGINX_AVAIL}'.")
fi

# Remove Nginx log files
rm -f /var/log/nginx/${DOMAIN}_access.log /var/log/nginx/${DOMAIN}_error.log 2>/dev/null || true

# Test & reload Nginx
if command -v nginx >/dev/null 2>&1; then
  if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx 2>/dev/null || true
    PURGE_LOG+=("Nginx reloaded gracefully.")
  fi
fi

# ------------------------------------------------------------------------------
# STEP 4: Remove Dedicated PHP-FPM Pool
# ------------------------------------------------------------------------------
echo "[4/7] Removing PHP-FPM Pool for ${TENANT}..." >&2
# Search across all installed PHP version pool directories
POOL_FOUND=0
for pool_dir in /etc/php/*/fpm/pool.d; do
  if [ -d "$pool_dir" ] && [ -f "${pool_dir}/${TENANT}.conf" ]; then
    rm -f "${pool_dir}/${TENANT}.conf"
    POOL_FOUND=1
    PURGE_LOG+=("Removed PHP pool config in '${pool_dir}'.")
  fi
done

# Reload all active php-fpm services
if [ $POOL_FOUND -eq 1 ]; then
  for svc in $(systemctl list-unit-files 2>/dev/null | grep -E '^php[0-9.]+-fpm\.service' | awk '{print $1}'); do
    systemctl reload "$svc" 2>/dev/null || true
  done
  PURGE_LOG+=("PHP-FPM reloaded.")
fi

# Remove unix socket if left over
rm -f /run/php/php*-fpm-${TENANT}.sock 2>/dev/null || true

# ------------------------------------------------------------------------------
# STEP 5: Remove Bind9 DNS Zone
# ------------------------------------------------------------------------------
echo "[5/7] Removing Bind9 DNS Zone..." >&2
ZONE_FILE="/etc/bind/zones/db.${DOMAIN}"
BIND_LOCAL_CONF="/etc/bind/named.conf.local"

if [ -f "$ZONE_FILE" ]; then
  rm -f "$ZONE_FILE"
  PURGE_LOG+=("Removed DNS zone file '${ZONE_FILE}'.")
fi

if [ -f "$BIND_LOCAL_CONF" ] && grep -q "zone \"${DOMAIN}\"" "$BIND_LOCAL_CONF"; then
  # Remove zone block cleanly using python
  python3 -c "
import sys, re
conf_file = '${BIND_LOCAL_CONF}'
domain = '${DOMAIN}'
try:
    with open(conf_file, 'r') as f:
        content = f.read()
    pattern = r'zone\s+\"' + re.escape(domain) + r'\"\s*\{[^}]*\};\s*'
    new_content = re.sub(pattern, '', content)
    with open(conf_file, 'w') as f:
        f.write(new_content)
except Exception as e:
    sys.stderr.write(f'Zone cleanup warning: {e}\n')
" 2>/dev/null || true
  PURGE_LOG+=("Removed zone '${DOMAIN}' block from '${BIND_LOCAL_CONF}'.")

  # Reload Bind9
  rndc reload 2>/dev/null || systemctl reload bind9 2>/dev/null || true
fi

# ------------------------------------------------------------------------------
# STEP 6: Revoke & Delete SSL Certificates
# ------------------------------------------------------------------------------
echo "[6/7] Revoking & Deleting Certbot SSL Certificate..." >&2
if command -v certbot >/dev/null 2>&1; then
  certbot delete --cert-name "$DOMAIN" --non-interactive 2>/dev/null || true
  PURGE_LOG+=("Certbot certificate for '${DOMAIN}' deleted.")
fi

# ------------------------------------------------------------------------------
# STEP 7: Database / JSON Record Deletion
# ------------------------------------------------------------------------------
echo "[7/7] Updating services.json registry..." >&2
SERVICES_FILE="${STORAGE_ROOT}/services.json"
if [ -f "$SERVICES_FILE" ]; then
  python3 -c "
import json
services_file = '${SERVICES_FILE}'
domain = '${DOMAIN}'
try:
    with open(services_file, 'r') as f:
        data = json.load(f)
    if isinstance(data, list):
        new_data = [s for s in data if s.get('domain', '').lower() != domain.lower()]
        with open(services_file, 'w') as f:
            json.dump(new_data, f, indent=2)
except Exception as e:
    pass
" 2>/dev/null || true
  PURGE_LOG+=("Domain '${DOMAIN}' removed from services.json.")
fi

echo "=== Service ${DOMAIN} Completely Terminated and Purged ===" >&2

# Output JSON result
cat <<EOF
{
  "success": true,
  "message": "Service for ${DOMAIN} completely terminated and all server resources purged.",
  "domain": "${DOMAIN}",
  "tenantUsername": "${TENANT}"
}
EOF
exit 0
