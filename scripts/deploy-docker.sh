#!/bin/bash

################################################################################
# Docker Deployment Script - Mega-Sena Analyser
#
# Deploys the application to VPS using Docker Compose
#
# Usage: bash scripts/deploy-docker.sh [options]
#
# Options:
#   --skip-build    Skip local build (use existing)
#   --no-backup     Skip database backup
#   --dry-run       Show commands without executing
#
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Server configuration
SSH_USER="claude"
SSH_HOST="212.85.2.24"
SSH_KEY="$HOME/.ssh/id_megasena_vps"
SSH_ALIAS="megasena-vps"
REMOTE_DIR="/home/claude/apps/megasena-analyser"

# Deployment configuration
DOCKER_IMAGE="megasena-analyser"
DOCKER_TAG="latest"

# Flags
SKIP_BUILD=false
NO_BACKUP=false
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --no-backup)
      NO_BACKUP=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 [--skip-build] [--no-backup] [--dry-run]"
      exit 1
      ;;
  esac
done

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_step() {
    echo -e "${GREEN}▶ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

ssh_command() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY-RUN SSH]${NC} $1"
    else
        ssh "$SSH_ALIAS" "$1"
    fi
}

################################################################################
# Pre-deployment Checks
################################################################################

print_header "🔍 Pre-Deployment Checks"

# Check if we're in project root
if [ ! -f "package.json" ]; then
    print_error "Error: Execute this script from project root"
    exit 1
fi
print_success "Project directory OK"

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    print_error "SSH key not found: $SSH_KEY"
    exit 1
fi
print_success "SSH key found"

# Check SSH connectivity
print_step "Testing SSH connection..."
if ssh_command "echo 'SSH OK'" &> /dev/null; then
    print_success "SSH connection established"
else
    print_error "Failed to connect via SSH"
    exit 1
fi

# Check if Docker is installed on VPS
print_step "Checking Docker on VPS..."
DOCKER_VERSION=$(ssh_command "docker --version 2>&1 || echo 'not-installed'")
if [[ $DOCKER_VERSION == *"not-installed"* ]]; then
    print_error "Docker is not installed on VPS"
    print_step "Install Docker first: curl -fsSL https://get.docker.com | sh"
    exit 1
else
    print_success "Docker installed: $DOCKER_VERSION"
fi

# Check if Docker Compose is available
print_step "Checking Docker Compose on VPS..."
COMPOSE_VERSION=$(ssh_command "docker compose version 2>&1 || echo 'not-installed'")
if [[ $COMPOSE_VERSION == *"not-installed"* ]]; then
    print_error "Docker Compose is not installed on VPS"
    exit 1
else
    print_success "Docker Compose available: $COMPOSE_VERSION"
fi

################################################################################
# Local Build (Optional)
################################################################################

if [ "$SKIP_BUILD" = false ]; then
    print_header "🏗️  Local Build"

    print_step "Installing dependencies..."
    bun install --frozen-lockfile

    print_step "Running linter..."
    bun run lint || print_warning "Linting completed with warnings"

    print_step "Building Next.js..."
    bun run build

    if [ -d ".next" ]; then
        print_success "Build completed successfully"
    else
        print_error "Build failed - .next directory not created"
        exit 1
    fi
else
    print_warning "Skipping local build (--skip-build)"
fi

################################################################################
# File Transfer
################################################################################

print_header "📦 Transferring Files"

print_step "Syncing files via rsync..."

RSYNC_CMD="rsync -avz --progress \
    -e 'ssh -i $SSH_KEY' \
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
    --exclude '.bfg-report' \
    ./ $SSH_USER@$SSH_HOST:$REMOTE_DIR/"

if [ "$DRY_RUN" = false ]; then
    eval $RSYNC_CMD
    print_success "Files transferred"
else
    echo -e "${YELLOW}[DRY-RUN]${NC} $RSYNC_CMD"
fi

################################################################################
# Database Backup
################################################################################

if [ "$NO_BACKUP" = false ]; then
    print_header "💾 Database Backup"

    print_step "Creating pre-deployment backup..."
    ssh_command "cd $REMOTE_DIR && ~/.bun/bin/bun run scripts/backup-database.ts" || print_warning "Backup failed, continuing..."
    print_success "Backup completed"
else
    print_warning "Skipping database backup (--no-backup)"
fi

################################################################################
# Docker Deployment
################################################################################

print_header "🐳 Docker Deployment"

# Create necessary directories
print_step "Creating directories..."
ssh_command "mkdir -p $REMOTE_DIR/db/backups $REMOTE_DIR/logs"

# Install dependencies on server
print_step "Installing dependencies on server..."
ssh_command "cd $REMOTE_DIR && ~/.bun/bin/bun install --frozen-lockfile"

# Build on server (more reliable than transferring .next)
print_step "Building application on server..."
ssh_command "cd $REMOTE_DIR && ~/.bun/bin/bun run build"

# Check if containers are already running
print_step "Checking existing containers..."
RUNNING=$(ssh_command "cd $REMOTE_DIR && docker compose ps -q 2>/dev/null | wc -l" || echo "0")

if [ "$RUNNING" -gt "0" ]; then
    print_warning "Containers already running, will restart..."
    DEPLOY_CMD="docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --force-recreate"
else
    print_step "Starting new deployment..."
    DEPLOY_CMD="docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
fi

# Deploy containers
print_step "Deploying Docker containers..."
ssh_command "cd $REMOTE_DIR && $DEPLOY_CMD"

# Wait for containers to start
print_step "Waiting for containers to start..."
sleep 10

################################################################################
# Health Checks
################################################################################

print_header "✅ Health Checks"

# Check container status
print_step "Checking container status..."
CONTAINER_STATUS=$(ssh_command "cd $REMOTE_DIR && docker compose ps --format '{{.Status}}' | grep -c 'Up'" || echo "0")

if [ "$CONTAINER_STATUS" -gt "0" ]; then
    print_success "Containers running"
else
    print_error "Containers not running"
    ssh_command "cd $REMOTE_DIR && docker compose logs --tail=50"
    exit 1
fi

# Check API health endpoint
print_step "Checking API health..."
API_HEALTH=$(ssh_command "curl -s -o /dev/null -w '%{http_code}' http://localhost:3201/api/health" || echo "000")

if [ "$API_HEALTH" = "200" ]; then
    print_success "API healthy (HTTP $API_HEALTH)"
else
    print_error "API health check failed (HTTP $API_HEALTH)"
    print_step "Fetching API logs..."
    ssh_command "cd $REMOTE_DIR && docker compose logs app --tail=30"
    exit 1
fi

# Check Next.js endpoint
print_step "Checking Next.js..."
NEXT_STATUS=$(ssh_command "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/megasena-analyzer" || echo "000")

if [ "$NEXT_STATUS" = "200" ]; then
    print_success "Next.js healthy (HTTP $NEXT_STATUS)"
else
    print_warning "Next.js check returned HTTP $NEXT_STATUS (may need Caddy update)"
fi

# Display container stats
print_step "Container resource usage:"
ssh_command "cd $REMOTE_DIR && docker stats --no-stream --format 'table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}'"

################################################################################
# Cleanup
################################################################################

print_header "🧹 Cleanup"

print_step "Removing old Docker images..."
ssh_command "docker image prune -af --filter 'until=72h'" || print_warning "Cleanup failed"

print_step "Checking disk usage..."
ssh_command "cd $REMOTE_DIR && du -sh ."

################################################################################
# Summary
################################################################################

print_header "📊 Deployment Summary"

echo -e "${GREEN}✓ Deployment completed successfully!${NC}\n"

echo -e "${BLUE}Access URLs:${NC}"
echo "  • Direct (Next.js): http://$SSH_HOST:3000/megasena-analyzer"
echo "  • Direct (API): http://$SSH_HOST:3201/api/health"
echo "  • Production: https://conhecendotudo.online/megasena-analyzer"
echo ""

echo -e "${BLUE}Container Management:${NC}"
echo "  • Status:  ssh $SSH_ALIAS 'cd $REMOTE_DIR && docker compose ps'"
echo "  • Logs:    ssh $SSH_ALIAS 'cd $REMOTE_DIR && docker compose logs -f'"
echo "  • Restart: ssh $SSH_ALIAS 'cd $REMOTE_DIR && docker compose restart'"
echo "  • Stop:    ssh $SSH_ALIAS 'cd $REMOTE_DIR && docker compose down'"
echo ""

echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Update Caddy to point to localhost:3000"
echo "  2. Test public URL: https://conhecendotudo.online/megasena-analyzer"
echo "  3. Monitor logs for 10-15 minutes"
echo "  4. If stable, stop PM2 processes"
echo ""

print_header "🎉 Deployment Complete"

exit 0
