#!/usr/bin/env bash
clear
echo "================================================================================"
echo "          HOSTER 1280 - VPS COMPREHENSIVE NETWORK & DNS INSPECTOR               "
echo "================================================================================"
echo ""
echo ">>> [1. PUBLIC & OUTBOUND IP CHECK] <<<"
echo -n "curl ipify.org:     "; curl -s --max-time 3 https://api.ipify.org 2>/dev/null; echo ""
echo -n "curl icanhazip.com: "; curl -s --max-time 3 https://icanhazip.com 2>/dev/null; echo ""
echo -n "curl ifconfig.me:   "; curl -s --max-time 3 https://ifconfig.me 2>/dev/null; echo ""
echo ""

echo ">>> [2. LOCAL NETWORK INTERFACES & DEFAULT GATEWAY] <<<"
ip -4 addr show
echo "Default Gateway / Route:"
ip route show default
echo ""

echo ">>> [3. HOSTNAME & ENVIRONMENT CONTEXT] <<<"
echo "Hostname: $(hostname)"
echo "Kernel:   $(uname -a)"
echo "Freestyle / Cloud Environment Variables:"
env | grep -iE "freestyle|cloud|vps|host|port|domain" || echo "No matching env vars"
echo ""

echo ">>> [4. ACTIVE LISTENING PORTS (TCP/UDP)] <<<"
sudo ss -tulpn 2>/dev/null || ss -tuln 2>/dev/null || netstat -tuln 2>/dev/null
echo ""

echo ">>> [5. NGINX STATUS & ACTIVE VHOST SERVER NAMES] <<<"
nginx -v 2>&1
echo "Nginx Systemd Status: $(systemctl is-active nginx 2>/dev/null || service nginx status 2>/dev/null || echo 'Unknown')"
echo "Active VirtualHosts in /etc/nginx/sites-enabled/:"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "None"
echo ""
echo "Server Names configured in Nginx:"
grep -rh "server_name" /etc/nginx/sites-enabled/ 2>/dev/null || echo "None"
echo ""

echo ">>> [6. BIND9 DNS STATUS & LOCAL ZONES] <<<"
echo "Bind9 Systemd Status: $(systemctl is-active bind9 2>/dev/null || service bind9 status 2>/dev/null || echo 'Not running/installed')"
if [ -d "/etc/bind/zones" ]; then
    echo "Existing Bind Zones:"
    ls -la /etc/bind/zones/
fi
echo ""

echo ">>> [7. LOCAL HTTP / HTTPS TEST] <<<"
echo -n "Port 80 (Local):   "; curl -s -o /dev/null -w "%{http_code}\n" --max-time 2 http://127.0.0.1 2>/dev/null || echo "Timed out"
echo -n "Port 5173 (Vite):  "; curl -s -o /dev/null -w "%{http_code}\n" --max-time 2 http://127.0.0.1:5173 2>/dev/null || echo "Timed out"
echo -n "Port 8080 (PMA):   "; curl -s -o /dev/null -w "%{http_code}\n" --max-time 2 http://127.0.0.1:8080 2>/dev/null || echo "Timed out"
echo ""

echo ">>> [8. CLOUD TOOLING AVAILABILITY] <<<"
echo -n "freestyle CLI: "; which freestyle 2>/dev/null || echo "Not found"
echo -n "cloudflared:   "; which cloudflared 2>/dev/null || echo "Not found"
echo ""
echo "================================================================================"
echo "           INSPECTION COMPLETE - PLEASE COPY ALL TEXT ABOVE                     "
echo "================================================================================"
