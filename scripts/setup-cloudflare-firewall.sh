#!/bin/bash
# Cloudflare Firewall Setup Script
# This script configures UFW to only allow HTTP/HTTPS from Cloudflare IPs
# Run as root on your VPS

set -euo pipefail

echo "=== Cloudflare Firewall Setup ==="
echo "This will restrict HTTP/HTTPS to Cloudflare IPs only"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "Error: This script must be run as root"
   exit 1
fi

# Cloudflare IPv4 ranges (as of December 2025)
# Source: https://www.cloudflare.com/ips-v4
CF_IPV4=(
    "173.245.48.0/20"
    "103.21.244.0/22"
    "103.22.200.0/22"
    "103.31.4.0/22"
    "141.101.64.0/18"
    "108.162.192.0/18"
    "190.93.240.0/20"
    "188.114.96.0/20"
    "197.234.240.0/22"
    "198.41.128.0/17"
    "162.158.0.0/15"
    "104.16.0.0/13"
    "104.24.0.0/14"
    "172.64.0.0/13"
    "131.0.72.0/22"
)

# Cloudflare IPv6 ranges
CF_IPV6=(
    "2400:cb00::/32"
    "2606:4700::/32"
    "2803:f800::/32"
    "2405:b500::/32"
    "2405:8100::/32"
    "2a06:98c0::/29"
    "2c0f:f248::/32"
)

# Backup current rules
echo "[1/6] Backing up current UFW rules..."
ufw status numbered > /root/ufw-backup-$(date +%Y%m%d-%H%M%S).txt

# Reset and set defaults
echo "[2/6] Resetting UFW rules..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (IMPORTANT: Don't lock yourself out!)
echo "[3/6] Allowing SSH..."
ufw allow 22/tcp comment 'SSH'

# Allow Coolify management ports from anywhere (or restrict to your IP)
echo "[4/6] Allowing Coolify ports..."
ufw allow 8000/tcp comment 'Coolify Dashboard'

# Allow HTTP/HTTPS only from Cloudflare IPv4
echo "[5/6] Adding Cloudflare IPv4 rules..."
for ip in "${CF_IPV4[@]}"; do
    ufw allow from "$ip" to any port 80 proto tcp comment "Cloudflare IPv4"
    ufw allow from "$ip" to any port 443 proto tcp comment "Cloudflare IPv4"
done

# Allow HTTP/HTTPS only from Cloudflare IPv6
echo "[5/6] Adding Cloudflare IPv6 rules..."
for ip in "${CF_IPV6[@]}"; do
    ufw allow from "$ip" to any port 80 proto tcp comment "Cloudflare IPv6"
    ufw allow from "$ip" to any port 443 proto tcp comment "Cloudflare IPv6"
done

# Enable UFW
echo "[6/6] Enabling UFW..."
ufw --force enable

echo ""
echo "=== Firewall Setup Complete ==="
echo ""
ufw status verbose

echo ""
echo "IMPORTANT: Test your SSH connection in a new terminal before closing this one!"
echo ""
echo "To verify Cloudflare is working:"
echo "  curl -I https://megasena-analyzer.com.br"
echo ""
echo "To check if direct IP access is blocked:"
echo "  curl -I http://212.85.2.24 (should timeout/fail)"
