#!/bin/bash
# ==============================================================================
# Nameserver & DNS Live Diagnostic / Monitoring Tool
# Domain: hoster1280.shop | Nameservers: ns1 & ns2
# ==============================================================================

# Terminal Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

DOMAIN="hoster1280.shop"
NS1="ns1.${DOMAIN}"
NS2="ns2.${DOMAIN}"

# Function to run full diagnostic check
run_diagnostic() {
    clear
    echo -e "${CYAN}${BOLD}======================================================================${NC}"
    echo -e "${PURPLE}${BOLD}   NAMESERVERS & DNS REAL-TIME MONITOR (hoster1280.shop)           ${NC}"
    echo -e "${CYAN}${BOLD}======================================================================${NC}"
    echo -e "Time: ${BOLD}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo ""

    # 1. Fetch Real VPS Public IPv4
    echo -e "${BLUE}[1/5] Checking Server Public IP...${NC}"
    VPS_IP=$(curl -s --max-time 3 https://api.ipify.org 2>/dev/null || curl -s --max-time 3 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    if [ -n "$VPS_IP" ]; then
        echo -e "      Server Real Public IPv4: ${GREEN}${BOLD}${VPS_IP}${NC}"
    else
        echo -e "      ${RED}Could not fetch public IP. Check internet connection.${NC}"
        VPS_IP="Unknown"
    fi
    echo ""

    # 2. Check Port 53 Listening Status on VPS
    echo -e "${BLUE}[2/5] Checking Bind9 (Port 53) Listening Status on VPS...${NC}"
    PORT53=$(sudo ss -tlunp 2>/dev/null | grep ':53 ' || netstat -tlunp 2>/dev/null | grep ':53 ' || true)
    if [ -n "$PORT53" ]; then
        echo -e "      Bind9 Status: ${GREEN}${BOLD}ACTIVE & LISTENING on Port 53 (UDP/TCP)${NC}"
    else
        echo -e "      Bind9 Status: ${RED}${BOLD}INACTIVE / NOT LISTENING${NC}"
        echo -e "      ${YELLOW}Tip: Run 'sudo systemctl restart bind9' to start DNS service.${NC}"
    fi
    echo ""

    # 3. Check Local Resolution (127.0.0.1)
    echo -e "${BLUE}[3/5] Testing Local VPS Resolution (@127.0.0.1)...${NC}"
    LOCAL_NS1=$(dig @127.0.0.1 "$NS1" +short +time=2 +tries=1 2>/dev/null || true)
    LOCAL_NS2=$(dig @127.0.0.1 "$NS2" +short +time=2 +tries=1 2>/dev/null || true)

    if [ "$LOCAL_NS1" == "$VPS_IP" ]; then
        echo -e "      Local ${NS1} -> ${GREEN}${LOCAL_NS1} (MATCH - OK)${NC}"
    else
        echo -e "      Local ${NS1} -> ${YELLOW}${LOCAL_NS1:-'No response'}${NC} (Expected: ${VPS_IP})"
    fi

    if [ "$LOCAL_NS2" == "$VPS_IP" ]; then
        echo -e "      Local ${NS2} -> ${GREEN}${LOCAL_NS2} (MATCH - OK)${NC}"
    else
        echo -e "      Local ${NS2} -> ${YELLOW}${LOCAL_NS2:-'No response'}${NC} (Expected: ${VPS_IP})"
    fi
    echo ""

    # 4. Check Global Resolution via Cloudflare (1.1.1.1) & Google (8.8.8.8)
    echo -e "${BLUE}[4/5] Testing Global Public DNS Resolution...${NC}"
    CF_NS1=$(dig @1.1.1.1 "$NS1" +short +time=3 +tries=1 2>/dev/null | tail -n 1 || true)
    CF_NS2=$(dig @1.1.1.1 "$NS2" +short +time=3 +tries=1 2>/dev/null | tail -n 1 || true)
    GOOG_NS1=$(dig @8.8.8.8 "$NS1" +short +time=3 +tries=1 2>/dev/null | tail -n 1 || true)
    GOOG_NS2=$(dig @8.8.8.8 "$NS2" +short +time=3 +tries=1 2>/dev/null | tail -n 1 || true)

    # Cloudflare 1.1.1.1
    if [ "$CF_NS1" == "$VPS_IP" ]; then
        echo -e "      Cloudflare DNS (1.1.1.1) -> ${NS1}: ${GREEN}${CF_NS1} [OK - DIRECT POINTED]${NC}"
    else
        echo -e "      Cloudflare DNS (1.1.1.1) -> ${NS1}: ${YELLOW}${CF_NS1:-'Pending / Not Propagated'}${NC}"
    fi

    if [ "$CF_NS2" == "$VPS_IP" ]; then
        echo -e "      Cloudflare DNS (1.1.1.1) -> ${NS2}: ${GREEN}${CF_NS2} [OK - DIRECT POINTED]${NC}"
    else
        echo -e "      Cloudflare DNS (1.1.1.1) -> ${NS2}: ${YELLOW}${CF_NS2:-'Pending / Not Propagated'}${NC}"
    fi

    # Google 8.8.8.8
    if [ "$GOOG_NS1" == "$VPS_IP" ]; then
        echo -e "      Google DNS (8.8.8.8)     -> ${NS1}: ${GREEN}${GOOG_NS1} [OK - DIRECT POINTED]${NC}"
    else
        echo -e "      Google DNS (8.8.8.8)     -> ${NS1}: ${YELLOW}${GOOG_NS1:-'Pending / Not Propagated'}${NC}"
    fi

    if [ "$GOOG_NS2" == "$VPS_IP" ]; then
        echo -e "      Google DNS (8.8.8.8)     -> ${NS2}: ${GREEN}${GOOG_NS2} [OK - DIRECT POINTED]${NC}"
    else
        echo -e "      Google DNS (8.8.8.8)     -> ${NS2}: ${YELLOW}${GOOG_NS2:-'Pending / Not Propagated'}${NC}"
    fi
    echo ""

    # 5. Overall Diagnostic Verdict & Next Action
    echo -e "${CYAN}${BOLD}======================================================================${NC}"
    echo -e "${PURPLE}${BOLD}   DIAGNOSTIC SUMMARY & ACTION STATUS                              ${NC}"
    echo -e "${CYAN}${BOLD}======================================================================${NC}"

    ALL_MATCH=true
    if [ "$CF_NS1" != "$VPS_IP" ] || [ "$CF_NS2" != "$VPS_IP" ]; then
        ALL_MATCH=false
    fi

    if [ "$ALL_MATCH" = true ]; then
        echo -e "Status: ${GREEN}${BOLD}ALL OK! ns1 and ns2 are globally resolving to your VPS IP (${VPS_IP}).${NC}"
        echo -e "Clients can now use ${BOLD}ns1.hoster1280.shop${NC} and ${BOLD}ns2.hoster1280.shop${NC} as their nameservers!"
    else
        echo -e "Status: ${YELLOW}${BOLD}PENDING PROPAGATION OR CONFIGURATION NEEDED${NC}"
        echo -e "Please verify:"
        echo -e "  1. In Cloudflare: A records for 'ns1' and 'ns2' point to ${BOLD}${VPS_IP}${NC} with ${YELLOW}DNS Only (Grey Cloud)${NC}."
        echo -e "  2. In Registrar: Glue Records (Child Nameservers) for 'ns1' and 'ns2' set to ${BOLD}${VPS_IP}${NC}."
        echo -e "  3. Wait 2-5 minutes for DNS TTL cache to expire."
    fi
    echo -e "${CYAN}======================================================================${NC}"
}

# Check argument for loop/watch mode
if [ "${1:-}" == "--watch" ] || [ "${1:-}" == "-w" ]; then
    echo "Starting continuous live monitor (updating every 5 seconds). Press Ctrl+C to exit..."
    sleep 1
    while true; do
        run_diagnostic
        echo ""
        echo -e "${CYAN}Auto-refreshing in 5 seconds... (Press Ctrl+C to stop)${NC}"
        sleep 5
    done
else
    run_diagnostic
    echo ""
    echo -e "Tip: Run ${BOLD}bash scripts/check_nameservers.sh --watch${NC} to auto-refresh live every 5s!"
fi
