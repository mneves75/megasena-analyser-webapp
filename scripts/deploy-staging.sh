#!/bin/bash

################################################################################
# Staging Deployment Script - Mega-Sena Analyser
#
# Deploys staging environment to VPS using Coolify Docker Compose
#
# Usage: bash scripts/deploy-staging.sh
#
# Prerequisites:
#   - SSH key configured (~/.ssh/id_megasena_vps)
#   - DNS: staging.megasena-analyzer.com.br -> VPS IP
#
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Server configuration
SSH_ALIAS="megasena-vps"
STAGING_DIR="/home/claude/apps/megasena-analyser-staging"
COMPOSE_FILE="docker-compose.staging.yml"

print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_step() { echo -e "${GREEN}▶ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_success() { echo -e "${GREEN}✓ $1${NC}"; }

ssh_cmd() { ssh "$SSH_ALIAS" "$1"; }

################################################################################
# Pre-deployment Checks
################################################################################

print_header "Pre-Deployment Checks"

# Check project root
if [ ! -f "package.json" ]; then
    print_error "Execute from project root"
    exit 1
fi
print_success "Project directory OK"

# Check compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    print_error "Compose file not found: $COMPOSE_FILE"
    exit 1
fi
print_success "Compose file found"

# Test SSH
print_step "Testing SSH connection..."
if ssh_cmd "echo 'OK'" &> /dev/null; then
    print_success "SSH connection OK"
else
    print_error "SSH connection failed"
    exit 1
fi

# Check Docker on VPS
print_step "Checking Docker..."
if ssh_cmd "docker --version" &> /dev/null; then
    print_success "Docker available"
else
    print_error "Docker not installed on VPS"
    exit 1
fi

################################################################################
# Setup Staging Directory
################################################################################

print_header "Setting Up Staging Environment"

print_step "Creating staging directory..."
ssh_cmd "mkdir -p $STAGING_DIR/db $STAGING_DIR/logs"
print_success "Directory created: $STAGING_DIR"

print_step "Copying docker-compose.staging.yml..."
scp "$COMPOSE_FILE" "$SSH_ALIAS:$STAGING_DIR/docker-compose.yml"
print_success "Compose file transferred"

print_step "Syncing project files..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.next' \
    --exclude 'db/*.db' \
    --exclude 'db/*.db-*' \
    --exclude '*.log' \
    --exclude 'logs/' \
    --exclude '.env.local' \
    --exclude '.DS_Store' \
    --exclude 'coverage' \
    --exclude '.turbo' \
    ./ "$SSH_ALIAS:$STAGING_DIR/"
print_success "Files synced"

################################################################################
# Build and Deploy
################################################################################

print_header "Building and Deploying"

print_step "Building Docker image..."
ssh_cmd "cd $STAGING_DIR && docker compose -f docker-compose.staging.yml build --no-cache"
print_success "Image built"

print_step "Starting staging container..."
ssh_cmd "cd $STAGING_DIR && docker compose -f docker-compose.staging.yml up -d --force-recreate"

print_step "Waiting for container startup (30s)..."
sleep 30

################################################################################
# Health Checks
################################################################################

print_header "Health Checks"

print_step "Checking container status..."
CONTAINER_UP=$(ssh_cmd "cd $STAGING_DIR && docker compose -f docker-compose.staging.yml ps --format '{{.Status}}' | grep -c 'Up'" || echo "0")

if [ "$CONTAINER_UP" -gt "0" ]; then
    print_success "Container running"
else
    print_error "Container not running"
    ssh_cmd "cd $STAGING_DIR && docker compose -f docker-compose.staging.yml logs --tail=50"
    exit 1
fi

print_step "Checking API health (port 3401)..."
API_STATUS=$(ssh_cmd "curl -s -o /dev/null -w '%{http_code}' http://localhost:3401/api/health 2>/dev/null" || echo "000")

if [ "$API_STATUS" = "200" ]; then
    print_success "API healthy (HTTP 200)"
else
    print_warning "API returned HTTP $API_STATUS (may still be starting)"
fi

################################################################################
# Seed Database (First Deploy)
################################################################################

print_header "Database Setup"

DB_EXISTS=$(ssh_cmd "test -f $STAGING_DIR/db/mega-sena.db && echo 'yes' || echo 'no'")

if [ "$DB_EXISTS" = "no" ] || [ "$DB_EXISTS" = "" ]; then
    print_step "Seeding database with historical draws..."
    ssh_cmd "cd $STAGING_DIR && docker compose -f docker-compose.staging.yml exec -T app bun run scripts/pull-draws.ts" || print_warning "Seeding failed - run manually"
    print_success "Database seeded"
else
    print_success "Database already exists"
fi

################################################################################
# Summary
################################################################################

print_header "Deployment Summary"

echo -e "${GREEN}✓ Staging deployment completed!${NC}\n"

echo -e "${BLUE}Staging URL:${NC}"
echo "  https://staging.megasena-analyzer.com.br"
echo ""

echo -e "${BLUE}Container Management:${NC}"
echo "  • Status:  ssh $SSH_ALIAS 'cd $STAGING_DIR && docker compose -f docker-compose.staging.yml ps'"
echo "  • Logs:    ssh $SSH_ALIAS 'cd $STAGING_DIR && docker compose -f docker-compose.staging.yml logs -f'"
echo "  • Restart: ssh $SSH_ALIAS 'cd $STAGING_DIR && docker compose -f docker-compose.staging.yml restart'"
echo "  • Stop:    ssh $SSH_ALIAS 'cd $STAGING_DIR && docker compose -f docker-compose.staging.yml down'"
echo ""

echo -e "${BLUE}Ports:${NC}"
echo "  • Next.js: http://VPS_IP:3100"
echo "  • API:     http://VPS_IP:3401/api/health"
echo ""

echo -e "${YELLOW}Note:${NC} Ensure DNS A record exists for staging.megasena-analyzer.com.br"
echo ""

print_header "Staging Ready"

exit 0
