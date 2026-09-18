#!/bin/bash
# ==============================================================================
# Nameserver (NS1 / NS2) Automated Deployment & Setup Script for Ubuntu VPS
# Nameservers: ns1.hoster1280.shop / ns2.hoster1280.shop
# ==============================================================================

set -e

echo "=== Installing and Configuring Bind9 Nameservers on hoster1280.shop ==="

# 1. Detect Real Public IPv4
PUBLIC_IP=$(curl -s --max-time 3 https://api.ipify.org || hostname -I | awk '{print $1}')
echo "[*] Server Public IP detected: ${PUBLIC_IP}"

# 2. Install Bind9 packages
echo "[*] Installing Bind9 packages..."
apt-get update -y
apt-get install -y bind9 bind9utils bind9-doc dnsutils

# 3. Configure named.conf.options
echo "[*] Writing /etc/bind/named.conf.options..."
cat <<EOF > /etc/bind/named.conf.options
options {
    directory "/var/cache/bind";

    // Listen on port 53 on all IPv4 interfaces
    listen-on port 53 { any; };
    listen-on-v6 { any; };

    // Allow queries from anywhere globally
    allow-query { any; };

    // Upstream DNS forwarders (Google & Cloudflare)
    forwarders {
        8.8.8.8;
        1.1.1.1;
    };

    recursion no;
    dnssec-validation auto;

    auth-nxdomain no;    # conform to RFC1035
};
EOF

# 4. Create Master Zone for hoster1280.shop
mkdir -p /etc/bind/zones
ZONE_FILE="/etc/bind/zones/db.hoster1280.shop"

echo "[*] Writing Master Zone File: ${ZONE_FILE}..."
cat <<EOF > "${ZONE_FILE}"
; ==============================================================================
; Primary Zone File for hoster1280.shop
; Authoritative for ns1.hoster1280.shop and ns2.hoster1280.shop
; ==============================================================================
\$TTL    86400
@       IN      SOA     ns1.hoster1280.shop. hostmaster.hoster1280.shop. (
                              $(date +%Y%m%d01) ; Serial
                              7200         ; Refresh
                              3600         ; Retry
                              1209600      ; Expire
                              86400 )      ; Negative Cache TTL
;
; Authoritative Nameservers
@       IN      NS      ns1.hoster1280.shop.
@       IN      NS      ns2.hoster1280.shop.

; Glue A Records for Nameservers
ns1     IN      A       ${PUBLIC_IP}
ns2     IN      A       ${PUBLIC_IP}

; Domain Base & Service Records
@       IN      A       ${PUBLIC_IP}
www     IN      A       ${PUBLIC_IP}
cpanel  IN      A       ${PUBLIC_IP}
mail    IN      A       ${PUBLIC_IP}
EOF

# 5. Add zone to named.conf.local
if ! grep -q "zone \"hoster1280.shop\"" /etc/bind/named.conf.local; then
  echo "[*] Registering hoster1280.shop zone in /etc/bind/named.conf.local..."
  cat <<EOF >> /etc/bind/named.conf.local

zone "hoster1280.shop" {
    type master;
    file "/etc/bind/zones/db.hoster1280.shop";
    allow-transfer { none; };
};
EOF
fi

# 6. Check Bind configuration syntax
echo "[*] Validating named configurations..."
named-checkconf
named-checkzone hoster1280.shop "${ZONE_FILE}"

# 7. Restart and enable Bind9
echo "[*] Restarting and enabling Bind9 service..."
systemctl restart bind9 || systemctl restart named
systemctl enable bind9 || systemctl enable named

# 8. Test local query
echo "[*] Testing local DNS resolution..."
dig @127.0.0.1 ns1.hoster1280.shop +short

# 9. Firewall rules (Open UDP/TCP port 53)
if command -v ufw >/dev/null 2>&1; then
  ufw allow 53/tcp || true
  ufw allow 53/udp || true
fi

echo ""
echo "======================================================================"
echo "      BIND9 NAMESERVERS SETUP COMPLETED SUCCESSFULLY!                "
echo "======================================================================"
echo "Nameserver 1: ns1.hoster1280.shop -> ${PUBLIC_IP}"
echo "Nameserver 2: ns2.hoster1280.shop -> ${PUBLIC_IP}"
echo ""
echo "CRITICAL REGISTRAR STEP (GLUE RECORDS):"
echo "Log into your domain registrar (Namecheap, GoDaddy, Porkbun, etc.)"
echo "Navigate to 'Advanced DNS' -> 'Personal Nameservers / Glue Records':"
echo "  1. Add Host: ns1.hoster1280.shop  IP: ${PUBLIC_IP}"
echo "  2. Add Host: ns2.hoster1280.shop  IP: ${PUBLIC_IP}"
echo "======================================================================"
