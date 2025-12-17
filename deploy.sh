#!/usr/bin/env bash
# =============================================================================
# Mega-Sena Analyzer - Production Deployment Script
# Pre-builds locally, then deploys to VPS
# =============================================================================
#
# IMPORTANT: Read agent_planning/archive/lessons-learned-docker-builds.md before using this script!
#
# Usage:
#   ./deploy.sh              # Build + Deploy
#   ./deploy.sh --skip-build # Deploy only (reuse existing build)
#   ./deploy.sh --image-only # Build image only (no deploy)
#
# =============================================================================

set -euo pipefail

# Configuration
VPS_HOST="megasena-vps"  # SSH alias from ~/.ssh/config
VPS_PATH="/home/claude/apps/megasena-analyser"
IMAGE_NAME="megasena-analyzer"
IMAGE_TAG="latest"
IMAGE_FILE="megasena-analyzer.tar.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
SKIP_BUILD=false
IMAGE_ONLY=false
for arg in "$@"; do
    case $arg in
        --skip-build) SKIP_BUILD=true ;;
        --image-only) IMAGE_ONLY=true ;;
    esac
done

echo "============================================================"
echo "Mega-Sena Analyzer - Production Deployment"
echo "============================================================"
echo ""

# Step 1: Pre-build Next.js locally
if [ "$SKIP_BUILD" = false ]; then
    log_info "Step 1/6: Building Next.js locally..."

    # Check for bun
    if ! command -v bun &> /dev/null; then
        log_error "Bun is not installed. Please install Bun first."
        exit 1
    fi

    # Clean previous build
    rm -rf .next dist

    # Build Next.js with Bun runtime
    bun --bun next build

    if [ ! -d ".next/standalone" ]; then
        log_error "Build failed: .next/standalone not found"
        exit 1
    fi

    # Find the nested standalone path (Next.js mirrors host directory structure)
    # Look for server.js in the standalone output
    STANDALONE_SERVER=$(find .next/standalone -name "server.js" -type f | head -1)
    if [ -z "${STANDALONE_SERVER}" ]; then
        log_error "Build failed: server.js not found in standalone output"
        exit 1
    fi

    STANDALONE_DIR=$(dirname "${STANDALONE_SERVER}")
    log_info "Found standalone at: ${STANDALONE_DIR}"

    # Copy to a consistent location for Docker
    mkdir -p dist/standalone
    cp -r "${STANDALONE_DIR}"/* dist/standalone/
    cp -r .next/static dist/standalone/.next/static 2>/dev/null || true

    log_info "[OK] Next.js build complete"
else
    log_warn "Step 1/6: Skipping build (--skip-build flag)"

    if [ ! -d "dist/standalone" ]; then
        log_error "No existing build found (dist/standalone). Remove --skip-build flag."
        exit 1
    fi
fi

# Step 2: Build Docker image with correct platform
log_info "Step 2/6: Building Docker image (linux/amd64)..."

docker build \
    --platform linux/amd64 \
    -t "${IMAGE_NAME}:${IMAGE_TAG}" \
    .

log_info "[OK] Docker image built"

# Step 3: Save Docker image
log_info "Step 3/6: Saving Docker image..."

docker save "${IMAGE_NAME}:${IMAGE_TAG}" | gzip > "${IMAGE_FILE}"

IMAGE_SIZE=$(ls -lh "${IMAGE_FILE}" | awk '{print $5}')
log_info "[OK] Image saved: ${IMAGE_FILE} (${IMAGE_SIZE})"

if [ "$IMAGE_ONLY" = true ]; then
    log_info "Image-only mode. Skipping deployment."
    echo ""
    log_info "To deploy manually:"
    log_info "  scp ${IMAGE_FILE} ${VPS_HOST}:/tmp/"
    log_info "  ssh ${VPS_HOST} 'docker load < /tmp/${IMAGE_FILE}'"
    exit 0
fi

# Step 4: Transfer to VPS
log_info "Step 4/6: Transferring image and config to VPS..."

# Transfer image
scp "${IMAGE_FILE}" "${VPS_HOST}:/tmp/"

# Transfer docker-compose file
scp docker-compose.coolify.yml "${VPS_HOST}:${VPS_PATH}/"

log_info "[OK] Files transferred"

# Step 5: Load and deploy on VPS
log_info "Step 5/6: Deploying on VPS..."

ssh "${VPS_HOST}" << EOF
set -e

echo "[VPS] Loading Docker image..."
docker load < /tmp/${IMAGE_FILE}

echo "[VPS] Cleaning up image file..."
rm -f /tmp/${IMAGE_FILE}

echo "[VPS] Stopping existing container..."
cd ${VPS_PATH}
docker compose -f docker-compose.coolify.yml down || true

echo "[VPS] Starting new container..."
docker compose -f docker-compose.coolify.yml up -d

echo "[VPS] Waiting for container to start..."
sleep 5

echo "[VPS] Checking container status..."
docker ps --filter name=megasena-analyzer --format "table {{.Names}}\t{{.Status}}"
EOF

log_info "[OK] Container deployed"

# Step 6: Verify deployment
log_info "Step 6/6: Verifying deployment..."

sleep 10  # Wait for services to start

# Test health endpoint
HEALTH_CHECK=$(ssh "${VPS_HOST}" 'curl -s http://localhost:3201/api/health' 2>/dev/null || echo '{"status":"error"}')

if echo "${HEALTH_CHECK}" | grep -q '"status":"healthy"'; then
    log_info "[OK] Health check passed"
else
    log_warn "Health check failed. Checking logs..."
    ssh "${VPS_HOST}" "docker logs megasena-analyzer --tail 30" || true
fi

# Clean up local image file
rm -f "${IMAGE_FILE}"

echo ""
echo "============================================================"
echo "Deployment Complete"
echo "============================================================"
echo ""
log_info "Application URL: https://megasena-analyzer.com.br"
log_info "API Health: https://megasena-analyzer.com.br/api/health"
echo ""
log_info "To view logs: ssh ${VPS_HOST} 'docker logs -f megasena-analyzer'"
log_info "To restart:   ssh ${VPS_HOST} 'cd ${VPS_PATH} && docker compose -f docker-compose.coolify.yml restart'"
echo ""
