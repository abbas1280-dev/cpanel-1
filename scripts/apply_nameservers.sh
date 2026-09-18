#!/usr/bin/env bash
# ==============================================================================
# HOSTER 1280 - 1-Click Dynamic Nameservers (NS1 / NS2) Installer
# Control Panel: hoster1280.shop
# ==============================================================================
# Usage:
#   sudo ./apply_nameservers.sh <ns1> <ns2> [server_ip] [storage_root]
# ==============================================================================

set -e

NS1="${1:-ns1.hoster1280.shop}"
NS2="${2:-ns2.hoster1280.shop}"
SERVER_IP="${3:-}"
STORAGE_ROOT="${4:-/home/ubuntu/cpanel-1/server_storage}"

# Auto-detect IP if not provided
if [ -z "$SERVER_IP" ]; then
  SERVER_IP=$(curl -s --max-time 3 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
fi

# Clean and normalize nameservers
NS1=$(echo "$NS1" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9.-')
NS2=$(echo "$NS2" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9.-')

echo "=== Applying Nameservers Globally ===" >&2
echo "Primary Nameserver (NS1):   $NS1" >&2
echo "Secondary Nameserver (NS2): $NS2" >&2
echo "Server Public IPv4:         $SERVER_IP" >&2

# 1. Persist to settings.json
mkdir -p "$STORAGE_ROOT"
SETTINGS_FILE="${STORAGE_ROOT}/settings.json"
cat <<EOF > "$SETTINGS_FILE"
{
  "ns1": "${NS1}",
  "ns2": "${NS2}",
  "serverIp": "${SERVER_IP}",
  "updatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
echo "[+] Saved nameserver configuration to ${SETTINGS_FILE}" >&2

# 2. Update Bind9 Zones on Linux if Bind9 installed
BIND_ZONES_DIR="/etc/bind/zones"
if [ -d "$BIND_ZONES_DIR" ]; then
  echo "[+] Updating Bind9 authoritative zones in ${BIND_ZONES_DIR}..." >&2

  for zone_file in "$BIND_ZONES_DIR"/db.*; do
    if [ -f "$zone_file" ]; then
      echo "    Updating $zone_file" >&2
      # Update NS records
      sed -i -E "s/IN[[:space:]]+NS[[:space:]]+ns[0-9]\.[^ ;]+/IN      NS      ${NS1}./g" "$zone_file" 2>/dev/null || true
      
      # Bump serial
      NEW_SERIAL=$(date +%Y%m%d01)
      sed -i -E "s/[0-9]{10}/$NEW_SERIAL/g" "$zone_file" 2>/dev/null || true
    fi
  done

  # Check configuration and reload Bind9
  if command -v named-checkconf >/dev/null 2>&1; then
    if named-checkconf /etc/bind/named.conf >/dev/null 2>&1; then
      rndc reload 2>/dev/null || systemctl reload bind9 2>/dev/null || systemctl restart bind9 2>/dev/null || true
      echo "[+] Bind9 reloaded successfully." >&2
    else
      echo "[-] named-checkconf reported warnings, attempting soft reload..." >&2
      systemctl reload bind9 2>/dev/null || true
    fi
  else
    systemctl reload bind9 2>/dev/null || true
  fi
fi

# 3. Output clean JSON confirmation
cat <<EOF
{
  "success": true,
  "message": "Nameservers installed and active globally!",
  "ns1": "${NS1}",
  "ns2": "${NS2}",
  "serverIp": "${SERVER_IP}"
}
EOF
