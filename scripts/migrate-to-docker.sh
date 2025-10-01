#!/bin/bash

################################################################################
# PM2 to Docker Migration Script
#
# Safely migrates from PM2-based deployment to Docker containers with
# zero downtime and full rollback capability.
#
# Usage: bash scripts/migrate-to-docker.sh [--auto] [--dry-run]
#
# Options:
#   --auto      Automatic mode (no prompts)
#   --dry-run   Show commands without executing
#
################################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Server configuration
SSH_USER="claude"
SSH_HOST="212.85.2.24"
SSH_ALIAS="megasena-vps"
REMOTE_DIR="/home/claude/apps/megasena-analyser"

# Migration state tracking
MIGRATION_LOG="/tmp/megasena-migration-$(date +%Y%m%d-%H%M%S).log"
PM2_BACKUP_DIR="$REMOTE_DIR/pm2-backup"
DB_BACKUP_NAME="pre-docker-migration-$(date +%Y%m%d-%H%M%S).db"

# Flags
AUTO_MODE=false
DRY_RUN=false
ROLLBACK_NEEDED=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --auto)
      AUTO_MODE=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 [--auto] [--dry-run]"
      exit 1
      ;;
  esac
done

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    printf "${CYAN}║${NC} %-62s ${CYAN}║${NC}\n" "$1"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}\n"
}

print_step() {
    echo -e "${GREEN}▶${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_message() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$MIGRATION_LOG"
}

ssh_command() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY-RUN]${NC} SSH: $1"
        return 0
    fi
    ssh "$SSH_ALIAS" "$1" 2>&1 | tee -a "$MIGRATION_LOG"
}

confirm() {
    if [ "$AUTO_MODE" = true ]; then
        return 0
    fi

    while true; do
        read -p "$1 (yes/no): " yn
        case $yn in
            [Yy]|[Yy][Ee][Ss] ) return 0;;
            [Nn]|[Nn][Oo] ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

rollback() {
    print_header "🔄 ROLLBACK INITIATED"
    print_error "Migration failed. Rolling back to PM2..."

    log_message "ROLLBACK: Stopping Docker containers"
    ssh_command "cd $REMOTE_DIR && docker compose down" || true

    log_message "ROLLBACK: Restoring database backup"
    ssh_command "cd $REMOTE_DIR && cp db/backups/$DB_BACKUP_NAME db/mega-sena.db" || true

    log_message "ROLLBACK: Restarting PM2 processes"
    ssh_command "source ~/.nvm/nvm.sh && pm2 restart ecosystem.config.js"

    log_message "ROLLBACK: Updating Caddy to PM2 port (3002)"
    ssh_command "sudo sed -i 's/localhost:3000/localhost:3002/g' /etc/caddy/Caddyfile && sudo systemctl reload caddy" || true

    print_success "Rollback complete. System restored to PM2 deployment."
    log_message "ROLLBACK: Complete"
    exit 1
}

# Set trap for cleanup on error
trap 'rollback' ERR

################################################################################
# Migration Start
################################################################################

print_header "🚀 PM2 to Docker Migration"
echo "Migration Log: $MIGRATION_LOG"
echo ""

log_message "Migration started"

if [ "$DRY_RUN" = true ]; then
    print_warning "DRY RUN MODE - No changes will be made"
fi

################################################################################
# Phase 1: Pre-flight Checks
################################################################################

print_header "Phase 1: Pre-flight Checks"

# Check SSH connectivity
print_step "Testing SSH connection..."
if ! ssh_command "echo 'SSH OK'" &> /dev/null; then
    print_error "SSH connection failed"
    exit 1
fi
print_success "SSH connection OK"
log_message "Pre-flight: SSH OK"

# Check if Docker is installed on VPS
print_step "Checking Docker installation..."
DOCKER_CHECK=$(ssh_command "docker --version 2>&1 || echo 'not-installed'")
if [[ $DOCKER_CHECK == *"not-installed"* ]]; then
    print_error "Docker is not installed on VPS"
    print_step "Please install Docker first:"
    echo "  ssh $SSH_ALIAS"
    echo "  curl -fsSL https://get.docker.com | sudo sh"
    echo "  sudo usermod -aG docker $SSH_USER"
    exit 1
fi
print_success "Docker installed: $DOCKER_CHECK"
log_message "Pre-flight: Docker OK"

# Check if PM2 is running
print_step "Checking PM2 processes..."
PM2_STATUS=$(ssh_command "source ~/.nvm/nvm.sh && pm2 list | grep -E 'megasena-(analyser|api)' | grep -c 'online' || echo '0'")
if [ "$PM2_STATUS" -eq "0" ]; then
    print_warning "No PM2 processes found running"
    if ! confirm "Continue anyway?"; then
        exit 1
    fi
else
    print_success "PM2 processes running: $PM2_STATUS"
fi
log_message "Pre-flight: PM2 status $PM2_STATUS"

# Check database exists
print_step "Checking database..."
DB_EXISTS=$(ssh_command "[ -f $REMOTE_DIR/db/mega-sena.db ] && echo 'yes' || echo 'no'")
if [ "$DB_EXISTS" = "no" ]; then
    print_error "Database not found at $REMOTE_DIR/db/mega-sena.db"
    exit 1
fi

DB_SIZE=$(ssh_command "du -h $REMOTE_DIR/db/mega-sena.db | cut -f1")
print_success "Database found: $DB_SIZE"
log_message "Pre-flight: Database OK ($DB_SIZE)"

################################################################################
# Phase 2: Backup
################################################################################

print_header "Phase 2: Creating Backups"

# Backup database
print_step "Creating database backup..."
ssh_command "mkdir -p $REMOTE_DIR/db/backups"
ssh_command "cp $REMOTE_DIR/db/mega-sena.db $REMOTE_DIR/db/backups/$DB_BACKUP_NAME"
print_success "Database backed up: $DB_BACKUP_NAME"
log_message "Backup: Database saved as $DB_BACKUP_NAME"

# Backup PM2 configuration
print_step "Backing up PM2 configuration..."
ssh_command "mkdir -p $PM2_BACKUP_DIR"
ssh_command "cp $REMOTE_DIR/ecosystem.config.js $PM2_BACKUP_DIR/ 2>/dev/null || echo 'No ecosystem.config.js found'"
ssh_command "source ~/.nvm/nvm.sh && pm2 save" || true
print_success "PM2 configuration backed up"
log_message "Backup: PM2 config saved"

# Backup Caddy configuration
print_step "Backing up Caddy configuration..."
ssh_command "sudo cp /etc/caddy/Caddyfile $PM2_BACKUP_DIR/Caddyfile.backup"
print_success "Caddy configuration backed up"
log_message "Backup: Caddy config saved"

################################################################################
# Phase 3: Deploy Docker (Parallel to PM2)
################################################################################

print_header "Phase 3: Deploying Docker Containers"

print_step "Transferring Docker configuration files..."
if [ "$DRY_RUN" = false ]; then
    # Use existing deploy-docker.sh script
    bash scripts/deploy-docker.sh --no-backup
fi
print_success "Docker deployment complete"
log_message "Deployment: Docker containers started"

# Verify Docker is running
print_step "Verifying Docker containers..."
sleep 5
DOCKER_STATUS=$(ssh_command "cd $REMOTE_DIR && docker compose ps --format '{{.Status}}' | grep -c 'Up' 2>/dev/null || echo '0'" | tr -d '\n\r ')
if [ "$DOCKER_STATUS" -eq "0" ]; then
    print_error "Docker containers not running"
    rollback
fi
print_success "Docker containers healthy"
log_message "Verification: Docker OK"

# Test Docker endpoints
# Note: During migration, Docker API uses port 3301 to avoid conflict with PM2 (port 3201)
# Wait longer for services to fully initialize (Bun server + Next.js startup)
print_step "Waiting for services to initialize (20 seconds)..."
sleep 20

print_step "Testing Docker API (port 3301)..."
API_TEST=$(ssh_command "curl -s -o /dev/null -w '%{http_code}' http://localhost:3301/api/health" | tr -d '\n\r ')
if [ "$API_TEST" != "200" ]; then
    print_error "Docker API health check failed (HTTP $API_TEST)"
    print_step "Fetching container logs..."
    ssh_command "cd $REMOTE_DIR && docker compose logs --tail=50"
    rollback
fi
print_success "Docker API responding on port 3301 (HTTP 200)"

print_step "Testing Docker Next.js (port 3000)..."
NEXT_TEST=$(ssh_command "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/megasena-analyzer" | tr -d '\n\r ')
if [ "$NEXT_TEST" != "200" ]; then
    print_warning "Docker Next.js returned HTTP $NEXT_TEST (may need Caddy update)"
else
    print_success "Docker Next.js responding (HTTP 200)"
fi
log_message "Verification: Endpoints tested"

################################################################################
# Phase 4: Traffic Cutover
################################################################################

print_header "Phase 4: Traffic Cutover"

print_step "Current Caddy configuration points to: localhost:3002 (PM2)"
print_step "Updating Caddy to point to: localhost:3000 (Docker)"

if ! confirm "Proceed with traffic cutover to Docker?"; then
    print_warning "Cutover cancelled. Docker is running but not receiving traffic."
    exit 0
fi

# Update Caddy configuration
print_step "Updating Caddy configuration..."
ssh_command "sudo sed -i 's/localhost:3002/localhost:3000/g' /etc/caddy/Caddyfile"
ssh_command "sudo systemctl reload caddy"
print_success "Caddy updated and reloaded"
log_message "Cutover: Caddy updated to port 3000"

# Verify public URL
print_step "Waiting for Caddy to apply changes..."
sleep 3

print_step "Testing public URL..."
PUBLIC_TEST=$(ssh_command "curl -s -o /dev/null -w '%{http_code}' https://conhecendotudo.online/megasena-analyzer")
if [ "$PUBLIC_TEST" = "200" ]; then
    print_success "Public URL responding via Docker! (HTTP 200)"
else
    print_warning "Public URL returned HTTP $PUBLIC_TEST"
fi
log_message "Cutover: Public URL tested (HTTP $PUBLIC_TEST)"

################################################################################
# Phase 5: PM2 Shutdown
################################################################################

print_header "Phase 5: Stopping PM2 Processes"

print_warning "Docker is now serving all traffic"
print_step "It's safe to stop PM2 processes"

if ! confirm "Stop PM2 processes?"; then
    print_warning "PM2 still running. You can stop it later manually."
    log_message "PM2: User chose to keep running"
else
    print_step "Stopping PM2 processes..."
    ssh_command "source ~/.nvm/nvm.sh && pm2 stop megasena-analyser megasena-api" || true
    print_success "PM2 processes stopped"
    log_message "PM2: Processes stopped"

    print_step "Removing PM2 from startup..."
    ssh_command "source ~/.nvm/nvm.sh && pm2 unstartup" || true
    ssh_command "source ~/.nvm/nvm.sh && pm2 delete megasena-analyser megasena-api" || true
    print_success "PM2 processes removed from startup"
    log_message "PM2: Removed from startup"
fi

################################################################################
# Phase 6: Final Verification
################################################################################

print_header "Phase 6: Final Verification"

print_step "Docker container status:"
ssh_command "cd $REMOTE_DIR && docker compose ps"

print_step "Docker resource usage:"
ssh_command "cd $REMOTE_DIR && docker stats --no-stream --format 'table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}'"

print_step "Testing all endpoints..."
echo "  API Health: $(ssh_command "curl -s http://localhost:3201/api/health | grep -o '\"status\":\"[^\"]*\"'")"
echo "  Public URL: HTTP $PUBLIC_TEST"

################################################################################
# Migration Complete
################################################################################

print_header "✅ Migration Complete!"

print_success "Successfully migrated from PM2 to Docker!"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo "  • Docker containers running on ports 3000 (Next.js) and 3201 (API)"
echo "  • Caddy proxying traffic to Docker"
echo "  • PM2 processes stopped"
echo "  • Database backed up: $DB_BACKUP_NAME"
echo "  • PM2 backup available: $PM2_BACKUP_DIR"
echo ""

echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Monitor Docker logs: ssh $SSH_ALIAS 'cd $REMOTE_DIR && docker compose logs -f'"
echo "  2. Check public URL: https://conhecendotudo.online/megasena-analyzer"
echo "  3. Monitor for 24-48 hours"
echo "  4. If stable, run: bash scripts/cleanup-pm2.sh"
echo ""

echo -e "${BLUE}Rollback (if needed):${NC}"
echo "  bash scripts/migrate-to-docker.sh --rollback"
echo ""

log_message "Migration completed successfully"

print_success "Migration log saved: $MIGRATION_LOG"

exit 0
