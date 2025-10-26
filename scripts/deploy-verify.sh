#!/bin/bash
# ============================================================================
# Deployment Verification Script
# Run this after deployment to verify everything is working
# ============================================================================

set -e  # Exit on error

DOMAIN="megasena-analyser.conhecendotudo.online"
API_PORT=3201
CONTAINER_NAME="megasena-analyser"

echo "════════════════════════════════════════════════════════════"
echo "Mega-Sena Analyser - Deployment Verification"
echo "════════════════════════════════════════════════════════════"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILURES=0

# Test function
test_step() {
    local description=$1
    local command=$2

    echo -n "Testing: $description... "

    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        FAILURES=$((FAILURES + 1))
        return 1
    fi
}

echo "1. DNS Resolution"
echo "─────────────────────────────────────────────────────────────"
test_step "DNS resolves to VPS" "dig +short $DOMAIN | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'"
VPS_IP=$(dig +short $DOMAIN | head -1)
echo "   Domain: $DOMAIN → IP: $VPS_IP"
echo ""

echo "2. Container Status"
echo "─────────────────────────────────────────────────────────────"
test_step "Container is running" "docker ps --filter name=$CONTAINER_NAME --filter status=running -q"
test_step "Container is healthy" "docker inspect $CONTAINER_NAME --format='{{.State.Health.Status}}' | grep -q healthy"

# Get container ID
CONTAINER_ID=$(docker ps --filter name=$CONTAINER_NAME -q | head -1)
if [ -n "$CONTAINER_ID" ]; then
    echo "   Container ID: $CONTAINER_ID"
    echo "   Uptime: $(docker inspect $CONTAINER_ID --format='{{.State.StartedAt}}')"
fi
echo ""

echo "3. Database"
echo "─────────────────────────────────────────────────────────────"
test_step "Database file exists" "[ -f /root/coolify-migration/compose/megasena-analyser/db/mega-sena.db ]"
test_step "Database is not empty" "[ -s /root/coolify-migration/compose/megasena-analyser/db/mega-sena.db ]"

DB_SIZE=$(du -h /root/coolify-migration/compose/megasena-analyser/db/mega-sena.db 2>/dev/null | cut -f1)
if [ -n "$DB_SIZE" ]; then
    echo "   Database size: $DB_SIZE"
fi
echo ""

echo "4. Health Endpoints"
echo "─────────────────────────────────────────────────────────────"
test_step "Internal API health (port 3201)" "docker exec $CONTAINER_NAME curl -f http://localhost:3201/api/health"
test_step "HTTPS endpoint responds" "curl -f -s -o /dev/null -w '%{http_code}' https://$DOMAIN | grep -q 200"
test_step "API health via HTTPS" "curl -f -s https://$DOMAIN/api/health | grep -q 'ok'"
echo ""

echo "5. SSL Certificate"
echo "─────────────────────────────────────────────────────────────"
test_step "SSL certificate valid" "echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | openssl x509 -noout -checkend 0"
test_step "Certificate from Let's Encrypt" "echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | grep -q 'Let'"

CERT_EXPIRY=$(echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
if [ -n "$CERT_EXPIRY" ]; then
    echo "   Certificate expires: $CERT_EXPIRY"
fi
echo ""

echo "6. Application Endpoints"
echo "─────────────────────────────────────────────────────────────"
test_step "Homepage loads" "curl -f -s -o /dev/null -w '%{http_code}' https://$DOMAIN | grep -q 200"
test_step "Dashboard loads" "curl -f -s -o /dev/null -w '%{http_code}' https://$DOMAIN/dashboard | grep -q 200"
test_step "Generator loads" "curl -f -s -o /dev/null -w '%{http_code}' https://$DOMAIN/dashboard/generator | grep -q 200"
test_step "Statistics loads" "curl -f -s -o /dev/null -w '%{http_code}' https://$DOMAIN/dashboard/statistics | grep -q 200"
echo ""

echo "7. Database Migrations"
echo "─────────────────────────────────────────────────────────────"
# Check container logs for migration messages
if docker logs $CONTAINER_NAME 2>&1 | grep -q "Applied migration"; then
    echo -e "   ${GREEN}✓${NC} Migrations applied"
    MIGRATION_COUNT=$(docker logs $CONTAINER_NAME 2>&1 | grep "Applied migration" | wc -l)
    echo "   Applied: $MIGRATION_COUNT migrations"
else
    echo -e "   ${YELLOW}⚠${NC} No migration logs found (may be normal if already applied)"
fi
echo ""

echo "8. Resource Usage"
echo "─────────────────────────────────────────────────────────────"
CPU_USAGE=$(docker stats --no-stream --format "{{.CPUPerc}}" $CONTAINER_NAME)
MEM_USAGE=$(docker stats --no-stream --format "{{.MemUsage}}" $CONTAINER_NAME)
echo "   CPU: $CPU_USAGE"
echo "   Memory: $MEM_USAGE"
echo ""

echo "9. Logs Check"
echo "─────────────────────────────────────────────────────────────"
ERROR_COUNT=$(docker logs $CONTAINER_NAME 2>&1 | grep -i error | grep -v "0 errors" | wc -l)
if [ "$ERROR_COUNT" -gt 0 ]; then
    echo -e "   ${YELLOW}⚠${NC} Found $ERROR_COUNT error messages in logs"
    echo "   Run: docker logs $CONTAINER_NAME | grep -i error"
else
    echo -e "   ${GREEN}✓${NC} No errors in logs"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "Verification Summary"
echo "════════════════════════════════════════════════════════════"

if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo ""
    echo "Application is ready at: https://$DOMAIN"
    echo ""
    echo "Next steps:"
    echo "  1. Seed database: docker exec $CONTAINER_NAME bun run scripts/pull-draws.ts"
    echo "  2. Test bet generation in browser"
    echo "  3. Monitor logs: docker logs -f $CONTAINER_NAME"
    exit 0
else
    echo -e "${RED}✗ $FAILURES TEST(S) FAILED${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check logs: docker logs $CONTAINER_NAME"
    echo "  2. Check container: docker inspect $CONTAINER_NAME"
    echo "  3. Check Traefik: docker logs traefik"
    exit 1
fi
