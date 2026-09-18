#!/usr/bin/env bash
echo "=========================================================="
echo " HOSTER 1280 - System Diagnostic & Live Status Check "
echo "=========================================================="
echo "[1] Nginx Service Status:"
systemctl is-active nginx 2>/dev/null || service nginx status 2>/dev/null || true

echo ""
echo "[2] PM2 Process Status:"
pm2 status 2>/dev/null || npx pm2 status 2>/dev/null || true

echo ""
echo "[3] Local Nginx Reverse Proxy (Port 80 -> Vite 5173):"
curl -s -I http://127.0.0.1 -H "Host: hoster1280.shop" | head -n 5

echo ""
echo "[4] Local phpMyAdmin (Port 8080):"
curl -s -I http://127.0.0.1:8080 | head -n 5

echo ""
echo "[5] Bind9 DNS Status (Port 53):"
systemctl is-active bind9 2>/dev/null || service bind9 status 2>/dev/null || true

echo "=========================================================="
