#!/bin/bash

################################################################################
# PM2 Cleanup Script
#
# Removes PM2 processes, configuration, and old files after successful
# migration to Docker.
#
# Usage: bash scripts/cleanup-pm2.sh [--force] [--uninstall-pm2]
#
# Options:
#   --force          Skip confirmation prompts
#   --uninstall-pm2  Also uninstall PM2 globally
#
# ⚠️  WARNING: Only run this after confirming Docker deployment is stable!
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Server configuration
SSH_USER="claude"
SSH_HOST="212.85.2.24"
SSH_ALIAS="megasena-vps"
REMOTE_DIR="/home/claude/apps/megasena-analyser"

# Flags
FORCE_MODE=false
UNINSTALL_PM2=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --force)
      FORCE_MODE=true
      shift
      ;;
    --uninstall-pm2)
      UNINSTALL_PM2=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 [--force] [--uninstall-pm2]"
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
    ssh "$SSH_ALIAS" "$1" 2>&1
}

confirm() {
    if [ "$FORCE_MODE" = true ]; then
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

################################################################################
# Safety Checks
################################################################################

print_header "🧹 PM2 Cleanup Utility"

print_warning "This script will remove PM2 processes and configuration."
print_warning "Only proceed if Docker deployment has been running stably for 24+ hours."
echo ""

# Check if Docker is running
print_step "Checking Docker status..."
DOCKER_STATUS=$(ssh_command "cd $REMOTE_DIR && docker compose ps --format '{{.Status}}' | grep -c 'Up' || echo '0'")
if [ "$DOCKER_STATUS" -eq "0" ]; then
    print_error "Docker containers are not running!"
    print_error "Cannot proceed with PM2 cleanup."
    exit 1
fi
print_success "Docker containers running"

# Verify public site is accessible via Docker
print_step "Verifying public site..."
PUBLIC_TEST=$(ssh_command "curl -s -o /dev/null -w '%{http_code}' https://conhecendotudo.online/megasena-analyzer")
if [ "$PUBLIC_TEST" != "200" ]; then
    print_error "Public site health check failed (HTTP $PUBLIC_TEST)"
    if ! confirm "Continue anyway?"; then
        exit 1
    fi
else
    print_success "Public site responding (HTTP 200)"
fi

# Final confirmation
echo ""
if ! confirm "Are you sure you want to clean up PM2?"; then
    print_warning "Cleanup cancelled"
    exit 0
fi

################################################################################
# PM2 Cleanup
################################################################################

print_header "Phase 1: Stopping PM2 Processes"

# Check if PM2 processes are running
print_step "Checking PM2 status..."
PM2_RUNNING=$(ssh_command "source ~/.nvm/nvm.sh && pm2 list 2>/dev/null | grep -E 'megasena-(analyser|api)' | grep -c 'online' || echo '0'")

if [ "$PM2_RUNNING" -gt "0" ]; then
    print_step "Stopping PM2 processes..."
    ssh_command "source ~/.nvm/nvm.sh && pm2 stop megasena-analyser megasena-api" || true
    print_success "PM2 processes stopped"
else
    print_success "PM2 processes already stopped"
fi

# Delete PM2 processes
print_step "Deleting PM2 processes..."
ssh_command "source ~/.nvm/nvm.sh && pm2 delete megasena-analyser megasena-api" 2>/dev/null || true
ssh_command "source ~/.nvm/nvm.sh && pm2 save --force" || true
print_success "PM2 processes deleted"

################################################################################
# Remove PM2 from Startup
################################################################################

print_header "Phase 2: Removing PM2 from Startup"

print_step "Removing PM2 startup script..."
ssh_command "source ~/.nvm/nvm.sh && pm2 unstartup" || true
print_success "PM2 removed from startup"

################################################################################
# Archive PM2 Configuration
################################################################################

print_header "Phase 3: Archiving PM2 Configuration"

# Create archive directory
ARCHIVE_DIR="$REMOTE_DIR/pm2-archive-$(date +%Y%m%d)"
print_step "Creating archive directory: $ARCHIVE_DIR"
ssh_command "mkdir -p $ARCHIVE_DIR"

# Archive ecosystem.config.js
print_step "Archiving ecosystem.config.js..."
ssh_command "[ -f $REMOTE_DIR/ecosystem.config.js ] && mv $REMOTE_DIR/ecosystem.config.js $ARCHIVE_DIR/ || echo 'File not found'" || true
print_success "ecosystem.config.js archived"

# Archive PM2 logs
print_step "Archiving PM2 logs..."
ssh_command "[ -d $REMOTE_DIR/logs ] && tar czf $ARCHIVE_DIR/pm2-logs.tar.gz $REMOTE_DIR/logs/*.log 2>/dev/null || echo 'No logs found'" || true
print_success "PM2 logs archived"

# Archive old .next directory if exists
print_step "Checking for old build artifacts..."
ssh_command "[ -d $REMOTE_DIR/.next ] && du -sh $REMOTE_DIR/.next" || echo "No .next directory"

################################################################################
# Optional: Uninstall PM2
################################################################################

if [ "$UNINSTALL_PM2" = true ]; then
    print_header "Phase 4: Uninstalling PM2 (Optional)"

    print_warning "This will remove PM2 globally from the VPS"
    if confirm "Proceed with PM2 uninstall?"; then
        print_step "Uninstalling PM2 globally..."
        ssh_command "source ~/.nvm/nvm.sh && npm uninstall -g pm2"
        print_success "PM2 uninstalled"
    else
        print_warning "Keeping PM2 installed"
    fi
else
    print_step "Keeping PM2 installed (use --uninstall-pm2 to remove)"
fi

################################################################################
# Disk Space Cleanup
################################################################################

print_header "Phase 5: Disk Space Cleanup"

# Show disk usage before cleanup
print_step "Disk usage before cleanup:"
ssh_command "cd $REMOTE_DIR && du -sh ."

# Remove old log files
print_step "Removing old log files..."
ssh_command "find $REMOTE_DIR/logs -name '*.log' -mtime +30 -delete 2>/dev/null || echo 'No old logs to delete'" || true
print_success "Old logs cleaned"

# Show disk usage after cleanup
print_step "Disk usage after cleanup:"
ssh_command "cd $REMOTE_DIR && du -sh ."

################################################################################
# Final Verification
################################################################################

print_header "Phase 6: Final Verification"

print_step "Verifying Docker is still running..."
DOCKER_FINAL=$(ssh_command "cd $REMOTE_DIR && docker compose ps --format '{{.Status}}' | grep -c 'Up' || echo '0'")
if [ "$DOCKER_FINAL" -eq "0" ]; then
    print_error "ERROR: Docker containers stopped during cleanup!"
    print_error "Restart immediately: ssh $SSH_ALIAS 'cd $REMOTE_DIR && docker compose up -d'"
    exit 1
fi
print_success "Docker still running"

print_step "Verifying public site..."
FINAL_TEST=$(ssh_command "curl -s -o /dev/null -w '%{http_code}' https://conhecendotudo.online/megasena-analyzer")
if [ "$FINAL_TEST" != "200" ]; then
    print_warning "Public site returned HTTP $FINAL_TEST"
else
    print_success "Public site healthy (HTTP 200)"
fi

################################################################################
# Summary
################################################################################

print_header "✅ PM2 Cleanup Complete"

echo -e "${GREEN}Successfully cleaned up PM2 deployment!${NC}"
echo ""

echo -e "${BLUE}What was done:${NC}"
echo "  • PM2 processes stopped and deleted"
echo "  • PM2 removed from startup scripts"
echo "  • Configuration archived to: $ARCHIVE_DIR"
echo "  • Old logs cleaned up"
if [ "$UNINSTALL_PM2" = true ]; then
    echo "  • PM2 uninstalled globally"
fi
echo ""

echo -e "${BLUE}Archive location:${NC}"
echo "  $ARCHIVE_DIR"
echo ""

echo -e "${BLUE}Docker status:${NC}"
ssh_command "cd $REMOTE_DIR && docker compose ps"
echo ""

echo -e "${BLUE}Next steps:${NC}"
echo "  • Monitor Docker for next 48 hours"
echo "  • Archive can be deleted after 1 month if no issues"
echo "  • Consider setting up automated backups"
echo ""

print_success "Migration to Docker fully complete!"

exit 0
