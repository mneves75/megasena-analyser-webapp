# Docker Deployment Guide - Mega-Sena Analyser
**Version:** 1.1.0
**Last Updated:** 2025-10-01
**Platform:** Docker + Docker Compose

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Environment Configuration](#environment-configuration)
5. [Building the Image](#building-the-image)
6. [Running Containers](#running-containers)
7. [Production Deployment](#production-deployment)
8. [Database Management](#database-management)
9. [Monitoring & Logging](#monitoring--logging)
10. [Troubleshooting](#troubleshooting)
11. [Migration from PM2](#migration-from-pm2)
12. [Rollback Procedures](#rollback-procedures)

---

## Overview

This guide describes how to deploy the Mega-Sena Analyser using Docker containers. Docker provides:

✅ **Consistent environments** across development, staging, and production
✅ **Easy deployment** with single commands
✅ **Isolated dependencies** preventing conflicts
✅ **Fast rollbacks** using versioned images
✅ **Simplified onboarding** for new developers

**Architecture:**
- **Next.js** (port 3000): Frontend application
- **Bun API Server** (port 3201): Backend API
- **SQLite Database**: Persisted via Docker volumes
- **Caddy** (optional): Reverse proxy with automatic HTTPS

---

## Prerequisites

### Required Software

1. **Docker** (≥20.10)
   ```bash
   # Install on Ubuntu/Debian
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh

   # Verify installation
   docker --version
   ```

2. **Docker Compose** (≥2.0)
   ```bash
   # Usually included with Docker Desktop
   docker compose version
   ```

3. **Git** (for code deployment)
   ```bash
   git --version
   ```

### System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 core | 2 cores |
| RAM | 512 MB | 1 GB |
| Disk | 2 GB | 5 GB |
| Network | 1 Mbps | 10 Mbps |

---

## Quick Start

### Local Development

1. **Clone Repository**
   ```bash
   git clone https://github.com/yourusername/megasena-analyser.git
   cd megasena-analyser
   ```

2. **Build and Run**
   ```bash
   docker compose up --build
   ```

3. **Access Application**
   - Next.js: http://localhost:3000/megasena-analyzer
   - API: http://localhost:3201/api/health

4. **Stop Containers**
   ```bash
   docker compose down
   ```

---

## Environment Configuration

### Environment Variables

Create `.env` file (copy from `.env.example`):

```bash
# Next.js Configuration
NEXT_PUBLIC_BASE_URL=http://localhost:3000
PORT=3000

# API Server Configuration
API_PORT=3201
API_HOST=localhost

# CORS Configuration (comma-separated)
ALLOWED_ORIGIN=http://localhost:3000,https://conhecendotudo.online

# Database Path
DATABASE_PATH=/app/db/mega-sena.db

# Backup Configuration (optional)
BACKUP_RETENTION_DAYS=30
BACKUP_MAX_COUNT=50
```

### Production Environment

For production, override values using `docker-compose.prod.yml`:

```yaml
environment:
  - NEXT_PUBLIC_BASE_URL=https://conhecendotudo.online/megasena-analyzer
  - API_HOST=localhost
  - ALLOWED_ORIGIN=https://conhecendotudo.online
```

---

## Building the Image

### Local Build

```bash
# Build image
docker compose build

# Build without cache (clean build)
docker compose build --no-cache

# View image details
docker images | grep megasena
```

### Build for Production

```bash
# Build production image
docker build -t megasena-analyser:latest .

# Tag for registry
docker tag megasena-analyser:latest ghcr.io/yourusername/megasena-analyser:latest

# Push to registry
docker push ghcr.io/yourusername/megasena-analyser:latest
```

**Expected Build Time:** 2-3 minutes
**Expected Image Size:** ~200-250 MB (compressed)

---

## Running Containers

### Development Mode

```bash
# Start in foreground (see logs)
docker compose up

# Start in background
docker compose up -d

# View logs
docker compose logs -f

# View logs for specific service
docker compose logs -f app
```

### Production Mode

```bash
# Start with production overrides
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check status
docker compose ps

# Restart services
docker compose restart
```

### Useful Commands

```bash
# Execute command in running container
docker compose exec app bun run db:migrate

# Access container shell
docker compose exec app sh

# View resource usage
docker stats

# Inspect container
docker compose exec app env
```

---

## Production Deployment

### VPS Deployment (Hostinger/DigitalOcean/AWS)

#### Step 1: Prepare VPS

```bash
# SSH into server
ssh user@your-vps-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

#### Step 2: Deploy Application

```bash
# Clone repository
git clone https://github.com/yourusername/megasena-analyser.git
cd megasena-analyser

# Create environment file
cp .env.example .env
nano .env  # Edit with production values

# Create database directory
mkdir -p db/backups

# Pull latest image (if using registry)
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull

# Start services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify health
docker compose ps
curl http://localhost:3201/api/health
```

#### Step 3: Configure Reverse Proxy

If using Caddy (recommended):

```bash
# Start Caddy with proxy profile
docker compose --profile with-proxy up -d
```

Or configure existing Caddy/Nginx to proxy to port 3000.

**Caddy Configuration:**
```caddyfile
conhecendotudo.online {
    handle_path /megasena-analyzer* {
        reverse_proxy localhost:3000
    }
}
```

---

## Database Management

### Database Location

SQLite database is stored in Docker volume:

```bash
# Default location
./db/mega-sena.db

# In container
/app/db/mega-sena.db
```

### Migrations

```bash
# Run migrations
docker compose exec app bun run db:migrate

# Pull latest lottery data
docker compose exec app bun run db:pull -- --limit 100
```

### Backups

#### Manual Backup

```bash
# Create backup using script
docker compose exec app bun run scripts/backup-database.ts

# Copy backup to host
docker cp megasena-analyser:/app/db/backups/ ./backups/
```

#### Automated Backups

Add to crontab on VPS:

```bash
# Daily backup at 3 AM
0 3 * * * cd /path/to/megasena-analyser && docker compose exec -T app bun run scripts/backup-database.ts >> logs/backup.log 2>&1
```

#### Volume Backup

```bash
# Backup entire volume
docker run --rm \
  -v megasena_database:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/db-volume-$(date +%Y%m%d).tar.gz /data
```

### Restore from Backup

```bash
# Stop application
docker compose down

# Restore database file
cp db/backups/mega-sena-backup-20251001.db db/mega-sena.db

# Restart application
docker compose up -d

# Verify restoration
docker compose exec app bun -e "console.log(require('fs').statSync('/app/db/mega-sena.db'))"
```

---

## Monitoring & Logging

### Container Logs

```bash
# View all logs
docker compose logs

# Follow logs in real-time
docker compose logs -f

# Last 100 lines
docker compose logs --tail=100

# Logs for specific service
docker compose logs -f app

# Export logs
docker compose logs > app-logs-$(date +%Y%m%d).txt
```

### Health Checks

```bash
# Check container health status
docker compose ps

# Manual health check
curl http://localhost:3201/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-10-01T...",
  "uptime": 12345,
  "database": {
    "connected": true,
    "totalDraws": 2500
  },
  "version": "1.0.0"
}
```

### Resource Monitoring

```bash
# Real-time resource usage
docker stats megasena-analyser

# Container details
docker inspect megasena-analyser
```

### Log Rotation

Configure log rotation in production:

```yaml
# docker-compose.prod.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
    compress: "true"
```

---

## Troubleshooting

### Container Won't Start

**Problem:** Container exits immediately

**Solution:**
```bash
# Check logs for errors
docker compose logs app

# Common issues:
# 1. Port already in use
sudo lsof -i :3000
sudo lsof -i :3201

# 2. Permission issues
sudo chown -R 1001:1001 ./db

# 3. Database corruption
rm db/mega-sena.db
docker compose up -d
docker compose exec app bun run db:migrate
```

### Database Errors

**Problem:** SQLite errors or missing tables

**Solution:**
```bash
# Re-run migrations
docker compose exec app bun run db:migrate

# Check database integrity
docker compose exec app sqlite3 /app/db/mega-sena.db "PRAGMA integrity_check;"
```

### API Not Responding

**Problem:** Health check fails

**Solution:**
```bash
# Check if API server is running
docker compose exec app ps aux | grep server.ts

# Check ports inside container
docker compose exec app netstat -tulpn

# Restart API server
docker compose restart app
```

### Build Failures

**Problem:** Docker build fails

**Solution:**
```bash
# Clear build cache
docker builder prune -af

# Build with verbose output
docker compose build --progress=plain

# Check Dockerfile syntax
docker compose config
```

### Out of Disk Space

**Problem:** "no space left on device"

**Solution:**
```bash
# Remove unused images
docker image prune -af

# Remove stopped containers
docker container prune -f

# Remove unused volumes (⚠️ careful!)
docker volume prune -f

# See disk usage
docker system df
```

---

## Migration from PM2

### Pre-Migration Checklist

- [ ] Current PM2 deployment is stable
- [ ] Database backup created
- [ ] Environment variables documented
- [ ] Docker installed and tested
- [ ] Rollback plan prepared

### Migration Steps

1. **Backup Current State**
   ```bash
   # Backup database
   cp db/mega-sena.db db/mega-sena.db.backup-$(date +%Y%m%d)

   # Export PM2 logs
   pm2 logs megasena-analyser --lines 1000 > pm2-logs-backup.txt
   ```

2. **Test Docker Locally**
   ```bash
   # Build and test
   docker compose up --build

   # Verify functionality
   curl http://localhost:3000/megasena-analyzer
   curl http://localhost:3201/api/health
   ```

3. **Deploy Docker on VPS**
   ```bash
   # Stop PM2
   pm2 stop megasena-analyser
   pm2 stop megasena-api

   # Start Docker
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

   # Verify deployment
   docker compose ps
   curl http://localhost:3201/api/health
   ```

4. **Update Caddy Configuration**
   ```bash
   # Update Caddyfile to point to new ports if needed
   sudo nano /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

5. **Monitor for 24 Hours**
   ```bash
   # Watch logs
   docker compose logs -f

   # Monitor resources
   docker stats
   ```

6. **Remove PM2 (Optional)**
   ```bash
   # Only after confirming Docker works perfectly
   pm2 delete megasena-analyser
   pm2 delete megasena-api
   pm2 save
   ```

---

## Rollback Procedures

### Rollback to PM2

If Docker deployment fails:

```bash
# Step 1: Stop Docker
docker compose down

# Step 2: Restore database
cp db/mega-sena.db.backup-20251001 db/mega-sena.db

# Step 3: Restart PM2
source ~/.nvm/nvm.sh
pm2 restart ecosystem.config.js

# Step 4: Verify
pm2 status
curl http://localhost:3002
```

### Rollback to Previous Docker Image

```bash
# Pull previous version
docker pull ghcr.io/yourusername/megasena-analyser:v1.0.3

# Stop current version
docker compose down

# Update docker-compose.prod.yml to use v1.0.3
# Then restart
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Best Practices

### Security

1. **Run as non-root** ✅ (implemented in Dockerfile)
2. **Use secrets** for sensitive data (GitHub Secrets for CI/CD)
3. **Regular updates** of base images
4. **Security scanning** (Trivy in CI/CD pipeline)

### Performance

1. **Resource limits** defined in docker-compose.prod.yml
2. **Layer caching** for faster builds
3. **Multi-stage builds** for smaller images
4. **Health checks** for automatic restarts

### Maintenance

1. **Weekly image updates**
2. **Daily database backups**
3. **Monthly security audits**
4. **Quarterly dependency updates**

---

## CI/CD Integration

### Automated Deployments

GitHub Actions automatically:
1. ✅ Runs linting and tests
2. ✅ Builds Docker image
3. ✅ Scans for vulnerabilities
4. ✅ Pushes to GitHub Container Registry
5. ✅ Deploys to VPS on main branch push

See `.github/workflows/ci-cd.yml` for details.

### Manual Deployment

```bash
# Trigger workflow manually
gh workflow run ci-cd.yml

# Or use deployment script
./scripts/deploy-docker.sh
```

---

## Cloudflare Integration (Recommended)

For DDoS protection, CDN caching, and WAF, integrate with Cloudflare:

### Setup Steps

1. **Add Domains to Cloudflare**
   - Create free Cloudflare account
   - Add each domain: `megasena-analyzer.com.br`, `.com`, `.online`
   - Set A records pointing to VPS IP with orange cloud (proxied)

2. **Configure SSL**
   - SSL/TLS > Overview: Set to "Full (strict)"
   - Edge Certificates: Enable "Always Use HTTPS"

3. **Security Features**
   - Security > WAF: Enable managed rules
   - Security > Bots: Enable Bot Fight Mode
   - Security > Settings: Set Security Level to "Medium"

4. **Restrict VPS Firewall**
   ```bash
   # After DNS propagates, run firewall script
   chmod +x scripts/setup-cloudflare-firewall.sh
   sudo ./scripts/setup-cloudflare-firewall.sh
   ```

### Configuration Files

| File | Purpose |
|------|---------|
| `traefik-cloudflare.yaml` | Trusted IPs middleware for Traefik |
| `traefik-cloudflare-tls.yaml` | Origin certificate configuration |
| `scripts/setup-cloudflare-firewall.sh` | UFW rules for Cloudflare-only access |

### Benefits

- DDoS protection (L3/L4/L7)
- Hidden origin IP
- CDN caching for static assets
- WAF protection
- Bot mitigation

---

## Multi-Domain Configuration

The application supports three domains simultaneously:

| Domain | Purpose | CORS |
|--------|---------|------|
| `megasena-analyzer.com.br` | Primary (canonical URLs) | Allowed |
| `megasena-analyzer.com` | International | Allowed |
| `megasena-analyzer.online` | Alternative | Allowed |

Traefik routing is configured in `docker-compose.coolify.yml` with the label:
```yaml
traefik.http.routers.megasena-analyzer.rule=Host(`megasena-analyzer.com.br`) || Host(`megasena-analyzer.com`) || Host(`megasena-analyzer.online`)
```

---

## Support & Resources

- **Documentation:** `/docs/`
- **Issues:** GitHub Issues
- **Logs:** `docker compose logs -f`
- **Health Check:** http://localhost:3201/api/health
- **Domains:** megasena-analyzer.com.br | .com | .online

---

**Last Updated:** 2025-12-02
**Deployment Version:** 1.2.1
**Docker Version:** 24.0+
**Docker Compose Version:** 2.0+
