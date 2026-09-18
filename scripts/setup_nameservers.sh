#!/bin/bash
# ==============================================================================
# Production-Grade Authoritative Bind9 DNS Engine Setup
# Brand: hoster1280.shop
# Authoritative Nameservers: ns1.hoster1280.shop / ns2.hoster1280.shop
# ==============================================================================

set -e

echo "======================================================================"
echo " Starting Hardened Bind9 Authoritative Nameserver Setup (hoster1280.shop)"
echo "======================================================================"

# 1. Fetch Real Server Public IPv4
PUBLIC_IP=$(curl -s --max-time 4 https://api.ipify.org || hostname -I | awk '{print $1}')
echo "[+] Detected Server Public IPv4: ${PUBLIC_IP}"

# 2. Install Bind9 and DNS utility packages non-interactively
echo "[+] Installing bind9, bind9utils, dnsutils..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y bind9 bind9utils bind9-doc dnsutils

# 3. Security Hardening Configuration (/etc/bind/named.conf.options)
# Protects against DNS Amplification Attacks (Authoritative-Only, Rate Limiting, No Recursion)
echo "[+] Configuring hardened /etc/bind/named.conf.options..."
cat <<EOF > /etc/bind/named.conf.options
options {
    directory "/var/cache/bind";

    // Listen on Port 53 for all IPv4 interfaces
    listen-on port 53 { any; };
    listen-on-v6 port 53 { any; };

    // Authoritative Server Hardening (Prevents Open Resolver & Amplification Exploits)
    recursion no;
    allow-recursion { none; };
    allow-query { any; };
    allow-transfer { none; };

    // Hide Bind version to prevent fingerprinting
    version none;

    // Rate Limiting (Mitigates DDoS and DNS reflection attacks)
    rate-limit {
        responses-per-second 10;
        window 5;
    };

    dnssec-validation auto;
    auth-nxdomain no;    # conform to RFC1035
};
EOF

# 4. Create Master Zone for hoster1280.shop
mkdir -p /etc/bind/zones
ZONE_FILE="/etc/bind/zones/db.hoster1280.shop"

SERIAL_DATE=$(date +%Y%m%d01)
echo "[+] Writing Primary Zone File: ${ZONE_FILE} (Serial: ${SERIAL_DATE})..."
cat <<EOF > "${ZONE_FILE}"
; ==============================================================================
; Primary Master Zone for hoster1280.shop
; Authoritative Nameservers: ns1.hoster1280.shop & ns2.hoster1280.shop
; ==============================================================================
\$TTL    86400
@       IN      SOA     ns1.hoster1280.shop. hostmaster.hoster1280.shop. (
                              ${SERIAL_DATE} ; Serial
                              7200         ; Refresh (2 hours)
                              3600         ; Retry (1 hour)
                              1209600      ; Expire (2 weeks)
                              86400 )      ; Minimum TTL (1 day)
;
; Authoritative Nameservers
@       IN      NS      ns1.hoster1280.shop.
@       IN      NS      ns2.hoster1280.shop.

; Glue A Records for Nameservers
ns1     IN      A       ${PUBLIC_IP}
ns2     IN      A       ${PUBLIC_IP}

; Domain Core & Service Records
@       IN      A       ${PUBLIC_IP}
www     IN      A       ${PUBLIC_IP}
cpanel  IN      A       ${PUBLIC_IP}
mail    IN      A       ${PUBLIC_IP}
ftp     IN      A       ${PUBLIC_IP}

; Mail Exchange (MX) & SPF TXT Records
@       IN      MX  10  mail.hoster1280.shop.
@       IN      TXT     "v=spf1 a mx ip4:${PUBLIC_IP} ~all"
EOF

# 5. Register master zone in /etc/bind/named.conf.local
if ! grep -q "zone \"hoster1280.shop\"" /etc/bind/named.conf.local; then
  echo "[+] Registering hoster1280.shop in /etc/bind/named.conf.local..."
  cat <<EOF >> /etc/bind/named.conf.local

// Master Zone for hosting control panel & nameserver cluster
zone "hoster1280.shop" {
    type master;
    file "/etc/bind/zones/db.hoster1280.shop";
    allow-transfer { none; };
};
EOF
fi

# 6. Syntax Validation
echo "[+] Validating Bind9 configuration syntax..."
named-checkconf
named-checkzone hoster1280.shop "${ZONE_FILE}"

# 7. Configure Permissions & Restart Bind9
chown -R bind:bind /etc/bind/zones
chmod 755 /etc/bind/zones
chmod 644 /etc/bind/zones/*

systemctl restart bind9 || systemctl restart named
systemctl enable bind9 || systemctl enable named

# 8. Firewall Configuration (UFW Port 53 UDP & TCP)
if command -v ufw >/dev/null 2>&1; then
  echo "[+] Ensuring UFW Firewall allows port 53 (DNS)..."
  ufw allow 53/tcp || true
  ufw allow 53/udp || true
fi

# 9. Verify Local Port 53 Listening
echo "[+] Testing Bind9 local query resolution..."
dig @127.0.0.1 ns1.hoster1280.shop +short || true

echo ""
echo "======================================================================"
echo "      BIND9 HARDENED AUTHORITATIVE NAMESERVER SETUP COMPLETE!        "
echo "======================================================================"
echo "Host Server Public IP: ${PUBLIC_IP}"
echo "Authoritative NS1:     ns1.hoster1280.shop -> ${PUBLIC_IP}"
echo "Authoritative NS2:     ns2.hoster1280.shop -> ${PUBLIC_IP}"
echo ""
echo "----------------------------------------------------------------------"
echo "CRITICAL REGISTRAR & CLOUDFLARE CONFIGURATION INSTRUCTIONS:"
echo "----------------------------------------------------------------------"
echo "1. DOMAIN REGISTRAR (GLUE RECORDS):"
echo "   In the registrar where 'hoster1280.shop' is registered (e.g., Namecheap, GoDaddy):"
echo "   - Go to 'Advanced DNS' -> 'Personal Nameservers / Glue Records / Registered Nameservers'"
echo "   - Create Host: ns1  -> IP: ${PUBLIC_IP}"
echo "   - Create Host: ns2  -> IP: ${PUBLIC_IP}"
echo ""
echo "2. CLOUDFLARE DNS (IF USING CLOUDFLARE FOR HOSTER1280.SHOP):"
echo "   - Add A Record: Name: ns1  | IPv4: ${PUBLIC_IP} | Proxy: DNS Only (GREY CLOUD - unproxied)"
echo "   - Add A Record: Name: ns2  | IPv4: ${PUBLIC_IP} | Proxy: DNS Only (GREY CLOUD - unproxied)"
echo "   * IMPORTANT: Proxy MUST be GREY CLOUD so UDP port 53 packets reach this VPS directly!"
echo "======================================================================"
