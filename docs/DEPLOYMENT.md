# Production Deployment Guide
## Mega-Sena Analyser - VPS Hostinger

**Version:** 1.0.1
**Last Updated:** 2025-09-30
**Target Environment:** Ubuntu 24.04 LTS (VPS Shared)

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Quick Deploy](#quick-deploy)
5. [Manual Deployment](#manual-deployment)
6. [Configuration](#configuration)
7. [Verification](#verification)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)
10. [Rollback Procedure](#rollback-procedure)

---

## Overview

This guide documents the complete production deployment process for the Mega-Sena Analyser application on a shared VPS Hostinger environment. The application is deployed with:

- **Path-based routing:** `/megasena-analyzer`
- **Process manager:** PM2 for auto-restart and monitoring
- **Reverse proxy:** Caddy for HTTP routing
- **Database:** SQLite with file-based storage
- **Port isolation:** Internal port 3002

### Deployment Goals

✅ **Isolated Execution** - No interference with other VPS applications
✅ **Automatic Restart** - PM2 ensures 24/7 availability
✅ **Clean URLs** - Path-based routing via standard HTTP port
✅ **Zero Downtime Updates** - Hot reload with PM2
✅ **Resource Efficient** - ~100MB memory footprint

---

## Prerequisites

### Server Requirements

**Minimum Specifications:**
- OS: Ubuntu 20.04+ or similar Linux distribution
- RAM: 512MB available (1GB recommended)
- Disk: 2GB free space
- Node.js: v20.0.0 or higher
- Network: Port 80 accessible (HTTP)

**Required Software:**

```bash
# Check installed versions
node --version    # Should be v20+
npm --version     # Should be v10+
pm2 --version     # Should be v6+
```

**Installation Commands (if needed):**

```bash
# Install NVM (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install Node.js 22 LTS
nvm install 22
nvm use 22

# Install PM2 globally
npm install -g pm2

# Verify installations
node --version
npm --version
pm2 --version
```

### Local Development Machine

**Required Tools:**
- Bun v1.1+ (or Node.js v20+)
- Git
- SSH client
- `sshpass` utility (for automated deployments)

**Install sshpass (if needed):**

```bash
# macOS
brew install hudochenkov/sshpass/sshpass

# Ubuntu/Debian
sudo apt-get install sshpass

# Fedora/RHEL
sudo dnf install sshpass
```

### Server Access

You need:
- SSH credentials (username/password or SSH key)
- Sudo access for Caddy/Nginx configuration
- Ability to manage PM2 processes

---

## Architecture

### Application Stack

```
┌─────────────────────────────────────────────┐
│            Internet / Users                  │
└────────────────┬────────────────────────────┘
                 │ HTTP :80
                 ▼
┌─────────────────────────────────────────────┐
│         Caddy Reverse Proxy                  │
│    Routes: /megasena-analyzer* → :3002      │
└────────────────┬────────────────────────────┘
                 │ Internal
                 ▼
┌─────────────────────────────────────────────┐
│           PM2 Process Manager                │
│      Auto-restart, Logs, Monitoring          │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│      Next.js Application (Port 3002)         │
│     basePath: /megasena-analyzer            │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│       SQLite Database (File-based)           │
│     /home/claude/apps/megasena-analyser/    │
│              db/mega-sena.db                 │
└─────────────────────────────────────────────┘
```

### Directory Structure

```
/home/claude/apps/megasena-analyser/
├── .env.production              # Environment variables
├── ecosystem.config.js          # PM2 configuration
├── next.config.js               # Next.js config with basePath
├── package.json                 # Dependencies
├── package-lock.json            # Lock file
├── node_modules/                # Installed packages
├── .next/                       # Production build
├── app/                         # Next.js App Router pages
├── components/                  # React components
├── lib/                         # Business logic
├── db/
│   ├── mega-sena.db            # SQLite database
│   ├── mega-sena.db-wal        # Write-ahead log
│   ├── mega-sena.db-shm        # Shared memory
│   └── migrations/             # SQL migrations
├── scripts/                     # CLI utilities
└── logs/
    ├── error.log               # PM2 error logs
    └── out.log                 # PM2 stdout logs
```

### Network Configuration

| Component | Port | Access | Purpose |
|-----------|------|--------|---------|
| Caddy | 80 | Public | HTTP entry point |
| Caddy | 443 | Public | HTTPS (if configured) |
| Next.js App | 3002 | Internal | Application server |
| PM2 | N/A | Internal | Process management |

---

## Quick Deploy

### Automated Deployment (Recommended)

**Initial Deployment:**

```bash
# From your local project root
bash scripts/deploy-fixed.sh --yes
```

This script will:
1. ✅ Run lint and build locally
2. ✅ Verify port 3002 availability
3. ✅ Transfer files via rsync
4. ✅ Install dependencies on server
5. ✅ Run database migrations
6. ✅ Build application on server
7. ✅ Start PM2 process
8. ✅ Verify deployment

**Subsequent Updates:**

```bash
# From your local project root
bash scripts/update-remote.sh
```

This performs a fast update:
- Transfers only changed files
- Rebuilds application
- Hot reloads PM2 (zero downtime)

### Configure Public Access

After deployment, configure Caddy for public access:

```bash
# Connect to server
ssh claude@212.85.2.24

# Add Caddy configuration
echo '
:80 {
    handle /megasena-analyzer* {
        reverse_proxy localhost:3002
    }
    handle {
        respond "Server running" 200
    }
}
' | sudo tee -a /etc/caddy/Caddyfile

# Reload Caddy
sudo systemctl reload caddy
```

**Access URL:** `http://212.85.2.24/megasena-analyzer`

---

## Manual Deployment

### Step 1: Prepare Local Build

```bash
# Navigate to project root
cd /path/to/megasena-analyser-webapp

# Install dependencies
bun install

# Run linter
bun run lint

# Create production build
bun run build

# Verify build succeeded
ls -la .next/
```

### Step 2: Prepare Server Directory

```bash
# Connect to server
ssh claude@212.85.2.24

# Create directory structure
mkdir -p /home/claude/apps/megasena-analyser/{db/migrations,logs,db/backups}

# Verify creation
ls -la /home/claude/apps/
```

### Step 3: Transfer Files

From your local machine:

```bash
# Using rsync with sshpass
sshpass -p 'YOUR_PASSWORD' rsync -avz --progress \
    -e "ssh -o StrictHostKeyChecking=no" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.next' \
    --exclude 'db/*.db' \
    --exclude '*.log' \
    --exclude '.env.local' \
    --exclude '.env.development' \
    --exclude '.DS_Store' \
    --exclude 'tests' \
    --exclude '___OLD_SITE' \
    --delete \
    ./ claude@212.85.2.24:/home/claude/apps/megasena-analyser/
```

### Step 4: Configure Environment

On the server:

```bash
cd /home/claude/apps/megasena-analyser

# Create .env.production
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3002
DATABASE_PATH=/home/claude/apps/megasena-analyser/db/mega-sena.db
CAIXA_API_BASE_URL=https://servicebus2.caixa.gov.br/portaldeloterias/api
EOF

# Verify
cat .env.production
```

### Step 5: Install Dependencies and Build

```bash
# Source NVM to get Node.js
source ~/.nvm/nvm.sh

# Install dependencies (all, including devDependencies for build)
npm install

# Build application
npm run build

# Verify build
ls -la .next/
```

### Step 6: Initialize Database

```bash
# Run migrations
npm run db:migrate

# Load initial data (latest 100 draws)
npm run db:pull -- --limit 100

# Verify database
ls -lh db/mega-sena.db
```

### Step 7: Configure PM2

```bash
# Create ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'megasena-analyser',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3002',
    cwd: '/home/claude/apps/megasena-analyser',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '700M',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    error_file: '/home/claude/apps/megasena-analyser/logs/error.log',
    out_file: '/home/claude/apps/megasena-analyser/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Verify status
pm2 status
pm2 logs megasena-analyser --lines 20
```

### Step 8: Configure Caddy

```bash
# Backup existing Caddyfile
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup-$(date +%Y%m%d)

# Add configuration
echo '
:80 {
    handle /megasena-analyzer* {
        reverse_proxy localhost:3002
    }
    handle {
        respond "Server running" 200
    }
}
' | sudo tee -a /etc/caddy/Caddyfile

# Validate configuration
sudo caddy validate --config /etc/caddy/Caddyfile

# Reload Caddy
sudo systemctl reload caddy

# Verify Caddy status
sudo systemctl status caddy
```

### Step 9: Test Deployment

```bash
# Test internal access
curl http://localhost:3002/megasena-analyzer

# Test via Caddy
curl http://localhost/megasena-analyzer

# Check PM2 status
pm2 status

# Check logs
pm2 logs megasena-analyser --lines 50
```

---

## Configuration

### Environment Variables

**`.env.production`** (on server):

```bash
NODE_ENV=production
PORT=3002
DATABASE_PATH=/home/claude/apps/megasena-analyser/db/mega-sena.db
CAIXA_API_BASE_URL=https://servicebus2.caixa.gov.br/portaldeloterias/api
```

### Next.js Configuration

**`next.config.js`:**

```javascript
const nextConfig = {
  reactStrictMode: true,
  basePath: '/megasena-analyzer',        // Path prefix
  assetPrefix: '/megasena-analyzer',     // Asset URL prefix
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('better-sqlite3');
    }
    return config;
  },
};
```

### PM2 Configuration

**`ecosystem.config.js`:**

```javascript
module.exports = {
  apps: [{
    name: 'megasena-analyser',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3002',
    cwd: '/home/claude/apps/megasena-analyser',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '700M',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
};
```

### Caddy Configuration

**`/etc/caddy/Caddyfile`** (append):

```caddyfile
:80 {
    handle /megasena-analyzer* {
        reverse_proxy localhost:3002
    }

    handle {
        respond "Server running" 200
    }

    encode gzip zstd

    log {
        output file /var/log/caddy/access.log
        format json
    }
}
```

---

## Verification

### Health Checks

**1. PM2 Process Status:**

```bash
pm2 status megasena-analyser
```

Expected output:
```
┌────┬──────────────────────┬─────────┬─────────┬──────────┐
│ id │ name                 │ status  │ memory  │ restarts │
├────┼──────────────────────┼─────────┼─────────┼──────────┤
│ 0  │ megasena-analyser    │ online  │ ~100mb  │ 0        │
└────┴──────────────────────┴─────────┴─────────┴──────────┘
```

**2. HTTP Endpoint Tests:**

```bash
# Homepage
curl -I http://localhost/megasena-analyzer
# Expected: HTTP/1.1 200 OK

# Dashboard
curl -I http://localhost/megasena-analyzer/dashboard
# Expected: HTTP/1.1 200 OK

# API endpoint
curl -X POST http://localhost/megasena-analyzer/api/generate-bets \
  -H "Content-Type: application/json" \
  -d '{"budget":50,"strategy":"balanced","betType":"simple"}'
# Expected: JSON response with bets
```

**3. Database Verification:**

```bash
# Check database file
ls -lh /home/claude/apps/megasena-analyser/db/mega-sena.db

# Count records (if sqlite3 installed)
sqlite3 db/mega-sena.db "SELECT COUNT(*) FROM draws;"
```

**4. Log Analysis:**

```bash
# Check for errors in PM2 logs
pm2 logs megasena-analyser --lines 100 --err

# Check application output
pm2 logs megasena-analyser --lines 100 --out

# Check Caddy logs
sudo journalctl -u caddy -n 50
```

**5. Memory and CPU:**

```bash
# Detailed PM2 info
pm2 show megasena-analyser

# System resources
pm2 monit
```

### Smoke Tests

```bash
# Create a test script
cat > /tmp/smoke-test.sh << 'EOF'
#!/bin/bash

echo "=== Smoke Test for Mega-Sena Analyser ==="

# Test 1: Homepage
echo "Test 1: Homepage"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/megasena-analyzer)
if [ "$RESPONSE" = "200" ]; then
    echo "✅ PASS: Homepage returns 200"
else
    echo "❌ FAIL: Homepage returns $RESPONSE"
    exit 1
fi

# Test 2: Dashboard
echo "Test 2: Dashboard"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/megasena-analyzer/dashboard)
if [ "$RESPONSE" = "200" ]; then
    echo "✅ PASS: Dashboard returns 200"
else
    echo "❌ FAIL: Dashboard returns $RESPONSE"
    exit 1
fi

# Test 3: PM2 Status
echo "Test 3: PM2 Status"
if pm2 describe megasena-analyser | grep -q "online"; then
    echo "✅ PASS: PM2 process is online"
else
    echo "❌ FAIL: PM2 process is not online"
    exit 1
fi

# Test 4: Database
echo "Test 4: Database"
if [ -f "/home/claude/apps/megasena-analyser/db/mega-sena.db" ]; then
    echo "✅ PASS: Database file exists"
else
    echo "❌ FAIL: Database file not found"
    exit 1
fi

echo ""
echo "=== All Tests Passed ✅ ==="
EOF

chmod +x /tmp/smoke-test.sh
/tmp/smoke-test.sh
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: Port 3002 Already in Use

**Symptom:**
```
Error: listen EADDRINUSE: address already in use :::3002
```

**Solution:**
```bash
# Find what's using the port
lsof -i :3002

# If it's another PM2 process
pm2 list
pm2 delete <process-id>

# Or kill the process
kill -9 <PID>

# Restart application
pm2 restart megasena-analyser
```

#### Issue 2: Application Returns 404

**Symptom:**
All routes return 404 Not Found

**Cause:**
Caddy not properly configured or basePath mismatch

**Solution:**
```bash
# Verify basePath in next.config.js
cat next.config.js | grep basePath
# Should show: basePath: '/megasena-analyzer'

# Check Caddy configuration
sudo cat /etc/caddy/Caddyfile | grep -A 3 "megasena-analyzer"

# Test internal app directly
curl http://localhost:3002/megasena-analyzer

# If internal works but external doesn't, reload Caddy
sudo systemctl reload caddy
```

#### Issue 3: PM2 Process Keeps Restarting

**Symptom:**
PM2 shows high restart count

**Solution:**
```bash
# Check error logs
pm2 logs megasena-analyser --err --lines 100

# Common causes:
# 1. Missing dependencies
npm install

# 2. Database file permissions
chmod 644 db/mega-sena.db
chmod 755 db/

# 3. Memory limit exceeded
pm2 set megasena-analyser max_memory_restart 1G
pm2 restart megasena-analyser
```

#### Issue 4: Database Errors

**Symptom:**
```
SqliteError: no such table: draws
```

**Solution:**
```bash
# Run migrations
npm run db:migrate

# Verify database
ls -lh db/mega-sena.db

# If database is corrupted, restore from backup
cp db/backups/mega-sena.db.backup-* db/mega-sena.db

# Or recreate
rm db/mega-sena.db
npm run db:migrate
npm run db:pull -- --limit 100
```

#### Issue 5: Caddy Configuration Errors

**Symptom:**
```
Error: adapting config using caddyfile
```

**Solution:**
```bash
# Validate Caddyfile syntax
sudo caddy validate --config /etc/caddy/Caddyfile

# Check for duplicate blocks
sudo cat /etc/caddy/Caddyfile | grep "^:80"

# Restore backup if needed
sudo cp /etc/caddy/Caddyfile.backup-* /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

#### Issue 6: Permission Denied on Database

**Symptom:**
```
EACCES: permission denied, open 'db/mega-sena.db'
```

**Solution:**
```bash
# Fix permissions
cd /home/claude/apps/megasena-analyser
chmod 644 db/mega-sena.db
chmod 755 db/
chown -R claude:claude db/

# Restart app
pm2 restart megasena-analyser
```

---

## Maintenance

### Regular Updates

**Update Application Code:**

```bash
# From local machine
bash scripts/update-remote.sh
```

This performs:
- Local lint and build
- File transfer to server
- Remote rebuild
- PM2 hot reload (zero downtime)

**Update Database with Latest Draws:**

```bash
# On server
ssh claude@212.85.2.24
source ~/.nvm/nvm.sh
cd /home/claude/apps/megasena-analyser

# Pull latest 50 draws
npm run db:pull -- --limit 50

# Or update all
npm run db:pull
```

**Update Dependencies:**

```bash
# On server
cd /home/claude/apps/megasena-analyser

# Update packages
npm update

# Rebuild
npm run build

# Restart
pm2 restart megasena-analyser
```

### Backup Procedures

**Database Backup:**

```bash
# Manual backup
cd /home/claude/apps/megasena-analyser
cp db/mega-sena.db db/backups/mega-sena.db.backup-$(date +%Y%m%d-%H%M%S)

# Automated backup (cron)
crontab -e
# Add:
0 3 * * * cd /home/claude/apps/megasena-analyser && cp db/mega-sena.db db/backups/mega-sena.db.backup-$(date +\%Y\%m\%d)
```

**Full Application Backup:**

```bash
# Create tarball
cd /home/claude/apps
tar -czf megasena-analyser-backup-$(date +%Y%m%d).tar.gz \
    --exclude='node_modules' \
    --exclude='.next' \
    megasena-analyser/

# Download to local machine
scp claude@212.85.2.24:/home/claude/apps/megasena-analyser-backup-*.tar.gz ./backups/
```

### Log Rotation

**PM2 Log Management:**

```bash
# Install PM2 log rotate module
pm2 install pm2-logrotate

# Configure rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

**Caddy Log Rotation:**

Caddy handles log rotation automatically. To configure:

```bash
sudo nano /etc/caddy/Caddyfile
```

Add to log block:
```caddyfile
log {
    output file /var/log/caddy/access.log {
        roll_size 100mb
        roll_keep 5
        roll_keep_for 720h
    }
}
```

### Monitoring

**Setup Health Check Script:**

```bash
cat > /home/claude/apps/megasena-analyser/health-check.sh << 'EOF'
#!/bin/bash
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/megasena-analyzer)
if [ "$RESPONSE" != "200" ]; then
    echo "App down! Restarting..."
    pm2 restart megasena-analyser
    echo "Restart triggered at $(date)" >> /home/claude/apps/megasena-analyser/logs/health-check.log
fi
EOF

chmod +x health-check.sh

# Add to cron (every 5 minutes)
crontab -e
# Add:
*/5 * * * * /home/claude/apps/megasena-analyser/health-check.sh
```

**PM2 Web Dashboard:**

```bash
# Install PM2 web interface
pm2 install pm2-web

# Access at http://212.85.2.24:9615
```

---

## Rollback Procedure

### Quick Rollback Steps

**1. Stop Current Version:**

```bash
ssh claude@212.85.2.24
pm2 stop megasena-analyser
```

**2. Restore Database Backup:**

```bash
cd /home/claude/apps/megasena-analyser
cp db/backups/mega-sena.db.backup-YYYYMMDD db/mega-sena.db
```

**3. Restore Code (if using git):**

```bash
cd /home/claude/apps/megasena-analyser
git log --oneline -10  # Find commit to revert to
git checkout <commit-hash>
npm install
npm run build
```

**4. Or Restore from Backup:**

```bash
cd /home/claude/apps
tar -xzf megasena-analyser-backup-YYYYMMDD.tar.gz
cd megasena-analyser
npm install
npm run build
```

**5. Restart Application:**

```bash
pm2 restart megasena-analyser
pm2 logs megasena-analyser --lines 50
```

**6. Verify:**

```bash
curl http://localhost/megasena-analyzer
pm2 status
```

### Database Rollback

```bash
# List available backups
ls -lh db/backups/

# Restore specific backup
cp db/backups/mega-sena.db.backup-YYYYMMDD db/mega-sena.db

# Restart app to use restored database
pm2 restart megasena-analyser
```

---

## Security Considerations

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable

# Verify rules
sudo ufw status
```

### File Permissions

```bash
# Set appropriate permissions
cd /home/claude/apps/megasena-analyser

# Application files
find . -type f -name "*.js" -exec chmod 644 {} \;
find . -type f -name "*.json" -exec chmod 644 {} \;
find . -type d -exec chmod 755 {} \;

# Database
chmod 644 db/mega-sena.db
chmod 755 db/

# Logs
chmod 755 logs/
chmod 644 logs/*.log

# Environment file (sensitive)
chmod 600 .env.production

# Scripts
chmod 755 scripts/*.sh
```

### Environment Variables

```bash
# Never commit secrets to version control
echo ".env.production" >> .gitignore

# Ensure .env.production is not world-readable
chmod 600 .env.production

# Audit environment variables
cat .env.production
```

---

## Performance Tuning

### PM2 Optimization

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'megasena-analyser',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3002',
    instances: 1,           // Single instance for SQLite
    exec_mode: 'fork',      // Fork mode (not cluster, SQLite constraint)
    max_memory_restart: '1G', // Restart if exceeds 1GB
    node_args: '--max-old-space-size=1024', // Node.js heap limit
  }]
};
```

### Next.js Optimization

```javascript
// next.config.js
const nextConfig = {
  compress: true,              // Enable gzip compression
  poweredByHeader: false,      // Remove X-Powered-By header
  generateEtags: true,         // Enable ETags for caching

  // Production optimizations
  swcMinify: true,            // Use SWC for minification
  reactStrictMode: true,      // Enable React strict mode
};
```

### Database Optimization

```sql
-- Run VACUUM periodically to optimize database
sqlite3 db/mega-sena.db "VACUUM;"

-- Analyze tables for query optimization
sqlite3 db/mega-sena.db "ANALYZE;"
```

---

## Support and Resources

### Documentation Files

- **DEPLOYMENT_AUDIT.md** - Complete technical audit of deployment
- **DEPLOYMENT_SUCCESS.md** - Successful deployment report
- **MANUAL_PATH_SETUP.md** - Quick setup guide for path routing
- **ACCESS_GUIDE.md** - All access configuration options
- **README.md** - Project overview and development setup
- **CHANGELOG.md** - Version history and changes

### Useful Commands Cheat Sheet

```bash
# PM2 Management
pm2 status                              # Show all processes
pm2 logs megasena-analyser             # View logs
pm2 restart megasena-analyser          # Restart app
pm2 stop megasena-analyser             # Stop app
pm2 delete megasena-analyser           # Remove from PM2
pm2 monit                              # Real-time monitoring
pm2 show megasena-analyser             # Detailed info

# Caddy Management
sudo systemctl status caddy            # Check Caddy status
sudo systemctl reload caddy            # Reload configuration
sudo systemctl restart caddy           # Restart Caddy
sudo journalctl -u caddy -f            # Follow Caddy logs
sudo caddy validate --config /etc/caddy/Caddyfile  # Validate config

# Application Management
npm run db:migrate                     # Run database migrations
npm run db:pull -- --limit 50          # Update lottery data
npm run lint                           # Run linter
npm run build                          # Build application

# System Monitoring
htop                                   # System resources
df -h                                  # Disk space
free -h                                # Memory usage
ss -tulpn | grep :3002                # Check port usage
```

### Troubleshooting Checklist

- [ ] PM2 process is online (`pm2 status`)
- [ ] Application responds on port 3002 (`curl http://localhost:3002/megasena-analyzer`)
- [ ] Caddy is running (`sudo systemctl status caddy`)
- [ ] Port 80 is accessible (`sudo ss -tulpn | grep :80`)
- [ ] Database file exists and is readable (`ls -la db/mega-sena.db`)
- [ ] No errors in PM2 logs (`pm2 logs megasena-analyser --err`)
- [ ] No errors in Caddy logs (`sudo journalctl -u caddy -n 50`)
- [ ] Firewall allows port 80 (`sudo ufw status`)

---

## Appendix

### A. Server Specifications

```
Hostname: srv849078
OS: Ubuntu 24.04.3 LTS (GNU/Linux 6.8.0-84-generic x86_64)
IP Address: 212.85.2.24
RAM: 7.8GB
Disk: 96GB
CPU: Multiple cores (x86_64)

Installed Software:
- Node.js: v22.18.0 (via NVM)
- npm: 10.9.3
- PM2: 6.0.8
- Caddy: Running
- Nginx: 1.24.0 (alternative)
- Git: 2.43.0
- Docker: Installed
```

### B. Port Allocation

| Port | Status | Application |
|------|--------|-------------|
| 80 | IN USE | Caddy (HTTP) |
| 443 | IN USE | Caddy (HTTPS) |
| 3001 | IN USE | Other Next.js app |
| **3002** | **IN USE** | **Mega-Sena Analyser** |
| 3010 | IN USE | Another application |
| 8080 | IN USE | Unknown service |
| 8443 | IN USE | Unknown service |
| 11434 | IN USE | Ollama |

### C. Related GitHub Issues

If you encounter issues, check:
- [Next.js basePath documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath)
- [PM2 documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Caddy documentation](https://caddyserver.com/docs/)

---

**Document Version:** 1.0.0
**Last Updated:** 2025-09-30
**Maintained By:** Development Team
**Status:** ✅ Production Ready
