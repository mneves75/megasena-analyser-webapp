# Coolify VPS Deployment - Mega-Sena Analyser

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with PLANS.md located at the repository root.


## Purpose / Big Picture

Deploy the Mega-Sena Analyser application to a Hostinger VPS using Coolify's Docker Compose deployment method. After this deployment, users will be able to access the production application at https://megasena-analyzer.conhecendotudo.online with full functionality including historical draw analysis, bet generation, and statistics visualization.

The application runs as a single Docker container managed by Coolify, with persistent SQLite database storage and automatic health monitoring. Coolify handles SSL certificate provisioning, container orchestration, and automatic restarts.


## Progress

Use this section to track granular steps with timestamps:

- [ ] Create production-ready docker-compose.coolify.yml
- [ ] Configure environment variables in Coolify UI
- [ ] Upload docker-compose.yml to VPS via Coolify
- [ ] Trigger initial deployment
- [ ] Verify database migrations executed
- [ ] Verify application health endpoints
- [ ] Test frontend at https://megasena-analyzer.conhecendotudo.online
- [ ] Test API endpoints via frontend
- [ ] Verify SSL certificate provisioning
- [ ] Configure monitoring alerts (optional)
- [ ] Document rollback procedure


## Surprises & Discoveries

Document unexpected behaviors, bugs, or insights discovered during deployment:

(To be filled during deployment)


## Decision Log

Record every decision made while working on the plan:

- Decision: Use single-container deployment instead of separate services
  Rationale: Application already uses dual-server pattern (Next.js + Bun API) within one container via start-docker.ts script. Simplifies Coolify management and matches existing architecture.
  Date/Author: 2025-10-26 / AI Agent

- Decision: Use Coolify's Docker Compose method instead of GitHub integration
  Rationale: User specified "Projects → Add Resource → Docker Compose" workflow. Faster initial deployment without CI/CD setup. Can migrate to GitHub integration later.
  Date/Author: 2025-10-26 / AI Agent

- Decision: Use volume mount for SQLite database instead of external volume
  Rationale: Simpler for initial deployment. Database file persists in /root/coolify-migration/compose/megasena-analyser/db/ on host filesystem.
  Date/Author: 2025-10-26 / AI Agent

- Decision: Use `expose:` instead of `ports:` in docker-compose.coolify.yml
  Rationale: Coolify's Traefik reverse proxy already listens on ports 80/443. Mapping container port 3000 to host port 80 would conflict. Using `expose:` makes port available on Docker network for Traefik to connect internally while Traefik handles external HTTPS traffic.
  Date/Author: 2025-10-26 / AI Agent (Critical fix during self-review)


## Outcomes & Retrospective

(To be filled after deployment completion)


## Context and Orientation

### What is Coolify?

Coolify is an open-source, self-hosted Platform-as-a-Service (PaaS) similar to Heroku or Vercel. It runs on your VPS and provides:
- Docker container orchestration
- Automatic SSL certificate provisioning (via Let's Encrypt)
- Web UI for deployment management
- Automatic reverse proxy configuration (via Traefik)
- Health monitoring and auto-restart

### Current VPS Setup

- **Provider:** Hostinger VPS
- **Platform:** Coolify (already installed)
- **Base Path:** `/root/coolify-migration/compose/megasena-analyser/`
- **Target URL:** https://megasena-analyzer.conhecendotudo.online
- **Deployment Method:** Docker Compose (paste in Coolify UI)

### Application Architecture

The Mega-Sena Analyser is a Next.js 15 application with Bun runtime that runs TWO servers in a SINGLE container:

1. **Bun API Server** (port 3201): Handles lottery data fetching, database operations, bet generation
2. **Next.js Server** (port 3000): Serves the frontend application and API routes

Both servers start via `scripts/start-docker.ts` which:
- Starts API server first (runs migrations, binds to port 3201)
- Waits for API health check
- Starts Next.js server (binds to port 3000)
- Monitors both processes and handles graceful shutdown

### Key Files

- **Dockerfile** - Multi-stage build: deps → builder → runner (Alpine-based, ~250MB final image)
- **docker-compose.yml** - Development configuration (reference only)
- **docker-compose.prod.yml** - Production overrides (reference only)
- **scripts/start-docker.ts** - Container startup orchestrator
- **db/migrations/** - SQL migration files (applied automatically on startup)
- **.env.example** - Template for environment variables

### Database Strategy

- **Engine:** SQLite (bun:sqlite - native Bun integration)
- **File:** `/app/db/mega-sena.db` (inside container)
- **Persistence:** Volume mount to host filesystem
- **Migrations:** Auto-applied on container startup by `lib/db.ts`
- **WAL Mode:** Enabled for concurrent read/write access

The database directory is mounted as a volume so data persists across container restarts and redeployments.


## Plan of Work

### Step 1: Create Coolify-Specific Docker Compose

Create `docker-compose.coolify.yml` tailored for Coolify's requirements:

- Single service named `app`
- Build from local Dockerfile (Coolify will clone repo)
- Port mapping: 3000:80 (Coolify proxy expects port 80)
- Environment variables (use Coolify secrets for sensitive data)
- Volume for database persistence
- Health check for automatic restart
- Proper labels for Coolify proxy integration

### Step 2: Configure Coolify Resource

In Coolify UI:

1. Navigate to Projects → Add Resource → Docker Compose
2. Paste `docker-compose.coolify.yml` content
3. Set deployment path: `/root/coolify-migration/compose/megasena-analyser/docker-compose.yml`
4. Configure environment variables in Coolify secrets
5. Set domain: `megasena-analyzer.conhecendotudo.online`
6. Enable SSL (Let's Encrypt automatic)

### Step 3: Initial Deployment

Trigger deployment via Coolify UI. Coolify will:

1. Create directory structure on VPS
2. Write docker-compose.yml to specified path
3. Execute `docker compose up -d`
4. Configure Traefik reverse proxy
5. Request SSL certificate from Let's Encrypt
6. Monitor health endpoint

### Step 4: Verification

Verify deployment success:

1. Check container logs in Coolify UI
2. Verify database migrations executed (look for "Applied migration" logs)
3. Test health endpoint: `https://megasena-analyzer.conhecendotudo.online/api/health`
4. Access frontend: `https://megasena-analyzer.conhecendotudo.online`
5. Test bet generation functionality
6. Verify statistics page loads data


## Concrete Steps

### Prerequisites

Before starting, ensure you have:

1. SSH access to Hostinger VPS
2. Coolify UI access (web interface)
3. DNS A record pointing `megasena-analyzer.conhecendotudo.online` to VPS IP
4. Git repository accessible (for source code)

### Step 1: Create docker-compose.coolify.yml

Create a new file in the repository root:

**File:** `docker-compose.coolify.yml`

```yaml
# ============================================================================
# Coolify Production Deployment Configuration
# Usage: Paste this content in Coolify UI → Docker Compose
# ============================================================================

version: '3.8'

services:
  app:
    # Build from repository root
    build:
      context: .
      dockerfile: Dockerfile
      args:
        BUILDKIT_INLINE_CACHE: 1

    container_name: megasena-analyser-prod

    # Expose port 3000 on Docker network for Traefik to connect
    # Don't map to host ports - Coolify's Traefik handles external access
    expose:
      - "3000"

    # Production environment variables
    # Sensitive values should be set in Coolify Secrets
    environment:
      - NODE_ENV=production
      - PORT=3000
      - API_PORT=3201
      - API_HOST=localhost
      - DATABASE_PATH=/app/db/mega-sena.db
      - NEXT_PUBLIC_BASE_URL=https://megasena-analyzer.conhecendotudo.online
      - NEXT_TELEMETRY_DISABLED=1
      # Add these in Coolify Secrets:
      # - ALLOWED_ORIGIN=${ALLOWED_ORIGIN}

    # Persist database across redeployments
    volumes:
      - ./db:/app/db
      - ./logs:/app/logs

    # Auto-restart on failure
    restart: unless-stopped

    # Health check for Coolify monitoring
    healthcheck:
      test: ["CMD", "bun", "-e", "fetch('http://localhost:3201/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

    # Coolify labels for Traefik integration
    labels:
      - "coolify.managed=true"
      - "traefik.enable=true"
      - "traefik.http.routers.megasena.rule=Host(`megasena-analyzer.conhecendotudo.online`)"
      - "traefik.http.routers.megasena.entrypoints=websecure"
      - "traefik.http.routers.megasena.tls=true"
      - "traefik.http.routers.megasena.tls.certresolver=letsencrypt"
      - "traefik.http.services.megasena.loadbalancer.server.port=3000"

networks:
  default:
    name: coolify
    external: true
```

**Command to create:**
```bash
# From repository root
cat > docker-compose.coolify.yml << 'EOF'
[paste the content above]
EOF
```

### Step 2: Commit and Push (Optional)

If you want version control for the Coolify config:

```bash
git add docker-compose.coolify.yml
git commit -m "feat: add Coolify production deployment configuration"
git push origin main
```

**Note:** This is optional. Coolify can deploy without pushing to git by pasting the compose file directly in the UI.

### Step 3: Access Coolify UI

1. Open browser and navigate to your Coolify instance (e.g., `https://coolify.yourdomain.com`)
2. Log in with your credentials
3. Navigate to: **Projects** → **Add Resource** → **Docker Compose**

### Step 4: Configure Deployment

In the Coolify UI:

**4.1 General Settings:**
- **Name:** Mega-Sena Analyser
- **Description:** Lottery analysis and bet generation application

**4.2 Docker Compose:**
- Click the text area
- Paste the entire content of `docker-compose.coolify.yml`
- Verify syntax highlighting shows no errors

**4.3 Deployment Path:**
- Set to: `/root/coolify-migration/compose/megasena-analyser/docker-compose.yml`
- Coolify will create this directory structure automatically

**4.4 Domain Configuration:**
- **Domain:** `megasena-analyzer.conhecendotudo.online`
- **SSL:** Enable "Automatic SSL (Let's Encrypt)"
- **Force HTTPS:** Enable (redirects HTTP to HTTPS)

**4.5 Environment Variables:**

Click "Add Environment Variable" for each:

| Key | Value | Secret? |
|-----|-------|---------|
| `NODE_ENV` | `production` | No |
| `PORT` | `3000` | No |
| `API_PORT` | `3201` | No |
| `API_HOST` | `localhost` | No |
| `DATABASE_PATH` | `/app/db/mega-sena.db` | No |
| `NEXT_PUBLIC_BASE_URL` | `https://megasena-analyzer.conhecendotudo.online` | No |
| `NEXT_TELEMETRY_DISABLED` | `1` | No |
| `ALLOWED_ORIGIN` | `https://megasena-analyzer.conhecendotudo.online` | No |

**Note:** If you have sensitive API keys in the future, mark them as "Secret" in Coolify.

**4.6 Build Settings:**
- **Build Command:** (leave default, Dockerfile handles build)
- **Build Args:** None needed (already in compose file)

**4.7 Volumes:**
- Coolify will automatically detect volumes from compose file
- Verify `./db` and `./logs` are mapped correctly

### Step 5: Deploy

1. Click **"Save"** to create the resource
2. Click **"Deploy"** button
3. Watch the deployment logs in real-time

**Expected log sequence:**

```
[Coolify] Cloning repository...
[Coolify] Building Docker image...
[Docker] Step 1/25 : FROM oven/bun:1.2-alpine AS deps
[Docker] ...
[Docker] Successfully built 1234567890ab
[Docker] Successfully tagged megasena-analyser:latest
[Coolify] Starting container...
[App] 🐳 Starting Mega-Sena Analyser in Docker container...
[App] Environment: production
[App] Ports: Next.js=3000, API=3201
[App] 📡 Starting Bun API server...
[App] ⚙️  Running database migrations...
[App] ✅ Applied migration: 001_initial_schema.sql
[App] ✅ Applied migration: 002_add_indexes.sql
[App] ✅ Applied migration: 003_add_statistics.sql
[App] ✅ API server ready
[App] 🌐 Starting Next.js server...
[App] ✅ All services started successfully
[App] 🚀 Application ready at http://localhost:3000
[Coolify] Container healthy
[Coolify] Configuring Traefik proxy...
[Coolify] Requesting SSL certificate...
[Coolify] ✅ Deployment successful
```

**Deployment takes approximately 3-5 minutes:**
- 2-3 minutes: Docker build
- 30 seconds: Container startup + migrations
- 30 seconds: SSL certificate issuance
- 30 seconds: Traefik configuration

### Step 6: Verify Deployment

**6.1 Check Container Status**

In Coolify UI → Application Details:
- Status should show: **Running** (green)
- Health check should show: **Healthy**
- Uptime should increment

**6.2 Test Health Endpoint**

Open terminal and run:

```bash
curl -I https://megasena-analyzer.conhecendotudo.online/api/health
```

**Expected response:**
```
HTTP/2 200
content-type: application/json
content-length: 15

{"status":"ok"}
```

**6.3 Access Frontend**

1. Open browser: `https://megasena-analyzer.conhecendotudo.online`
2. Verify SSL certificate (green padlock icon)
3. Check homepage loads without errors
4. Navigate to `/dashboard` - should load statistics
5. Navigate to `/dashboard/generator` - test bet generation

**6.4 Verify Database**

SSH into VPS and check database file:

```bash
ssh root@your-vps-ip
cd /root/coolify-migration/compose/megasena-analyser/db
ls -lh mega-sena.db

# Should show file size > 0 bytes
# Example: -rw-r--r-- 1 1001 1001 2.5M Oct 26 12:00 mega-sena.db
```

**6.5 Check Logs**

In Coolify UI → Logs:

Look for:
- ✅ "Applied migration" entries (confirms DB setup)
- ✅ "All services started successfully"
- ✅ No error messages
- ✅ API requests being processed

### Step 7: Initial Data Seeding (Optional)

If the database is empty, seed it with historical draws:

**7.1 Via Coolify UI:**

1. Go to Application → Terminal
2. Click "Open Terminal"
3. Run:

```bash
bun run scripts/pull-draws.ts
```

**Or via SSH:**

```bash
ssh root@your-vps-ip
cd /root/coolify-migration/compose/megasena-analyser
docker compose exec app bun run scripts/pull-draws.ts
```

**Expected output:**

```
📡 Fetching Mega-Sena draws from CAIXA API...
✅ Fetched 2847 draws
💾 Saving to database...
✅ Inserted 2847 draws
✅ Complete! Database now has 2847 draws
```

This takes ~30 seconds and populates the database with all historical lottery data.


## Validation and Acceptance

The deployment is successful when ALL of the following are true:

### Critical Checks (Must Pass)

1. **Container Running:**
   - Coolify UI shows status: **Running** (green indicator)
   - Health check: **Healthy**
   - No restart loops

2. **HTTPS Access:**
   - `https://megasena-analyzer.conhecendotudo.online` loads in browser
   - SSL certificate is valid (green padlock, no warnings)
   - No mixed content warnings in browser console

3. **Health Endpoint:**
   - `curl https://megasena-analyzer.conhecendotudo.online/api/health` returns HTTP 200
   - Response body: `{"status":"ok"}`

4. **Database Functional:**
   - SSH into VPS: `ls -lh /root/coolify-migration/compose/megasena-analyser/db/mega-sena.db`
   - File exists and has size > 0 bytes
   - Migrations applied (check logs for "Applied migration" messages)

5. **Frontend Functional:**
   - Homepage loads without JavaScript errors
   - `/dashboard` shows statistics (or "No data" if DB empty)
   - `/dashboard/generator` form submits without errors
   - No 404 errors for static assets (CSS, JS)

### User Acceptance Test

Execute this scenario to verify end-to-end functionality:

1. **Open:** `https://megasena-analyzer.conhecendotudo.online/dashboard/generator`
2. **Fill form:**
   - Budget: R$ 100
   - Strategy: Balanced
   - Mode: Optimized
3. **Click:** "Gerar Apostas"
4. **Verify:**
   - Loading state appears
   - Results render (list of bets with numbers)
   - Budget breakdown shows correct calculation
   - No console errors
5. **Navigate:** To `/dashboard/statistics`
6. **Verify:**
   - Charts render
   - Statistics show data (frequency, patterns)
   - No console errors

If all steps pass, deployment is successful.


## Idempotence and Recovery

### Safe to Repeat

The following steps can be run multiple times safely:

1. **Rebuild:** Coolify's "Rebuild" button
   - Stops container gracefully
   - Rebuilds Docker image
   - Starts new container
   - Database persists (volume mount)

2. **Restart:** Coolify's "Restart" button
   - Sends SIGTERM (graceful shutdown)
   - Waits 10 seconds
   - Force kills if needed
   - Starts container

3. **Redeploy:** Paste updated `docker-compose.coolify.yml`
   - Coolify detects changes
   - Recreates container with new config
   - Database persists

### Rollback Procedure

If deployment fails or causes issues:

**Option 1: Quick Rollback (Coolify UI)**

1. Navigate to Application → Deployments
2. Find previous successful deployment
3. Click "Rollback to this deployment"
4. Coolify will:
   - Stop current container
   - Restore previous Docker image
   - Start container with old config

**Option 2: Manual Rollback (SSH)**

```bash
ssh root@your-vps-ip
cd /root/coolify-migration/compose/megasena-analyser

# Stop current container
docker compose down

# Backup database (safety)
cp -r db db.backup.$(date +%Y%m%d-%H%M%S)

# Restore previous image (if tagged)
docker compose pull
docker compose up -d
```

**Option 3: Emergency Database Restore**

If database corrupted:

```bash
ssh root@your-vps-ip
cd /root/coolify-migration/compose/megasena-analyser

# Stop container
docker compose down

# List backups
ls -lht db.backup.*

# Restore from backup
cp -r db.backup.YYYYMMDD-HHMMSS/mega-sena.db db/mega-sena.db

# Restart
docker compose up -d
```

### Recovery from Common Failures

**Failure 1: Container Won't Start**

**Symptoms:** Restart loop, logs show startup error

**Diagnosis:**
```bash
docker compose logs app
```

**Fixes:**
- Check environment variables in Coolify
- Verify database directory exists and has permissions
- Increase startup timeout if migrations take long

**Failure 2: SSL Certificate Not Issued**

**Symptoms:** HTTPS shows certificate error, HTTP works

**Diagnosis:**
- Check DNS: `dig megasena-analyzer.conhecendotudo.online`
- Verify A record points to VPS IP

**Fixes:**
- Wait 5-10 minutes (Let's Encrypt can be slow)
- Check Traefik logs in Coolify
- Verify domain in Coolify settings
- Force certificate renewal via Coolify UI

**Failure 3: Database Migrations Failed**

**Symptoms:** Logs show migration errors, app returns 500 errors

**Diagnosis:**
```bash
docker compose exec app bun -e "console.log(require('bun:sqlite').Database('/app/db/mega-sena.db').query('SELECT * FROM migrations').all())"
```

**Fixes:**
```bash
# Reset database (CAUTION: destroys data)
docker compose down
rm -rf db/mega-sena.db
docker compose up -d

# Or: Run migrations manually
docker compose exec app bun run scripts/migrate.ts
```

**Failure 4: Out of Disk Space**

**Symptoms:** Container stops, logs show I/O errors

**Diagnosis:**
```bash
df -h
```

**Fixes:**
```bash
# Clean Docker system
docker system prune -a -f --volumes

# Clean old images
docker image prune -a -f

# Check database size
du -sh /root/coolify-migration/compose/megasena-analyser/db
```

### Backup Strategy

**Automated Backup (Recommended):**

Create a cron job on VPS to backup database daily:

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * /usr/bin/docker compose -f /root/coolify-migration/compose/megasena-analyser/docker-compose.yml exec -T app bun -e "require('bun:sqlite').Database('/app/db/mega-sena.db').exec('VACUUM INTO \"/app/db/backup-$(date +\%Y\%m\%d).db\"')"

# Keep only last 7 backups
5 2 * * * find /root/coolify-migration/compose/megasena-analyser/db -name "backup-*.db" -mtime +7 -delete
```

**Manual Backup:**

```bash
ssh root@your-vps-ip
cd /root/coolify-migration/compose/megasena-analyser/db
sqlite3 mega-sena.db "VACUUM INTO 'backup-$(date +%Y%m%d).db'"
```


## Artifacts and Notes

### Expected Directory Structure on VPS

After deployment, the VPS filesystem should look like:

```
/root/coolify-migration/compose/megasena-analyser/
├── docker-compose.yml          # Deployed by Coolify
├── db/                         # Volume mount (persisted)
│   ├── mega-sena.db           # SQLite database
│   ├── mega-sena.db-shm       # WAL shared memory
│   └── mega-sena.db-wal       # WAL write-ahead log
└── logs/                       # Volume mount (optional)
    └── app.log                # Application logs
```

### Example Successful Deployment Log

```
[2025-10-26 12:00:00] [Coolify] Starting deployment for megasena-analyser
[2025-10-26 12:00:01] [Coolify] Pulling latest changes from repository
[2025-10-26 12:00:05] [Docker] Building image from Dockerfile
[2025-10-26 12:01:30] [Docker] Step 25/25 : CMD ["bun", "run", "scripts/start-docker.ts"]
[2025-10-26 12:01:35] [Docker] Successfully built abc123def456
[2025-10-26 12:01:40] [Coolify] Creating container: megasena-analyser-prod
[2025-10-26 12:01:45] [App] ═══════════════════════════════════════════════════════════
[2025-10-26 12:01:45] [App] 🎰 Mega-Sena Analyser - Docker Container
[2025-10-26 12:01:45] [App] ═══════════════════════════════════════════════════════════
[2025-10-26 12:01:45] [App] 🐳 Starting Mega-Sena Analyser in Docker container...
[2025-10-26 12:01:45] [App] Environment: production
[2025-10-26 12:01:45] [App] Ports: Next.js=3000, API=3201
[2025-10-26 12:01:45] [App] 📡 Starting Bun API server...
[2025-10-26 12:01:48] [App] ⏳ Waiting for API server to initialize...
[2025-10-26 12:01:48] [App] ⚙️  Checking database migrations...
[2025-10-26 12:01:48] [App] ✅ Applied migration: 001_initial_schema.sql
[2025-10-26 12:01:48] [App] ✅ Applied migration: 002_add_indexes.sql
[2025-10-26 12:01:48] [App] ✅ Applied migration: 003_add_statistics.sql
[2025-10-26 12:01:48] [App] ✅ Database ready (WAL mode enabled)
[2025-10-26 12:01:51] [App] ✅ API server ready
[2025-10-26 12:01:51] [App] 🌐 Starting Next.js server...
[2025-10-26 12:01:53] [App] ⏳ Waiting for Next.js server to initialize...
[2025-10-26 12:01:55] [App] ✅ All services started successfully
[2025-10-26 12:01:55] [App] 🚀 Application ready at http://localhost:3000
[2025-10-26 12:01:55] [App] 📊 API endpoints at http://localhost:3201/api/*
[2025-10-26 12:02:00] [Coolify] Health check passed
[2025-10-26 12:02:05] [Coolify] Configuring Traefik proxy...
[2025-10-26 12:02:10] [Coolify] Requesting SSL certificate from Let's Encrypt...
[2025-10-26 12:02:35] [Coolify] SSL certificate issued successfully
[2025-10-26 12:02:40] [Coolify] ✅ Deployment complete
[2025-10-26 12:02:40] [Coolify] Application available at: https://megasena-analyzer.conhecendotudo.online
```

### Monitoring Metrics

After deployment, monitor these metrics in Coolify UI:

**Container Metrics:**
- CPU usage: Should stay under 50% during normal operation
- Memory usage: Should stay around 256-384MB (within 512MB limit)
- Network I/O: Spikes during bet generation, otherwise low
- Disk I/O: Increases during database writes

**Application Metrics (via logs):**
- Request rate: Varies by traffic
- Error rate: Should be < 1%
- Average response time: < 500ms for API, < 2s for pages
- Database query time: < 100ms average

**Health Check:**
- Interval: Every 30 seconds
- Failures allowed: 3 consecutive
- Expected uptime: > 99.5%


## Interfaces and Dependencies

### Required DNS Configuration

Before deployment, ensure DNS is configured:

**Record Type:** A
**Name:** `megasena-analyzer.conhecendotudo.online`
**Value:** Your VPS IP address (e.g., `123.45.67.89`)
**TTL:** 3600 (or default)

**Verify with:**
```bash
dig megasena-analyzer.conhecendotudo.online +short
# Should return: 123.45.67.89
```

### Coolify Requirements

- **Version:** Coolify v4.0+ (check with Coolify UI → Settings → About)
- **Docker:** v20.10+ (installed by Coolify)
- **Traefik:** v2.0+ (installed by Coolify)
- **SSL Provider:** Let's Encrypt (integrated)

### VPS Requirements

**Minimum Specifications:**
- RAM: 2GB (512MB for app + 512MB for Docker + 1GB OS overhead)
- CPU: 1 vCore
- Disk: 20GB (5GB for app + images, 15GB free space for WAL operations)
- OS: Ubuntu 20.04+ or Debian 11+

**Network:**
- Inbound: Ports 80 (HTTP), 443 (HTTPS)
- Outbound: Unrestricted (for pulling Docker images, CAIXA API)

### Application Ports

**Inside Container:**
- 3000: Next.js server (public traffic)
- 3201: Bun API server (internal, called by Next.js)

**Host Mapping:**
- 80 → 3000 (Coolify Traefik proxy)
- 443 → 80 → 3000 (HTTPS → Traefik → Next.js)

**Traefik handles:**
- SSL termination
- HTTP → HTTPS redirect
- Load balancing (single instance)
- WebSocket proxying

### Environment Variables Reference

Complete list with descriptions:

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `NODE_ENV` | `production` | Yes | Node environment (production/development) |
| `PORT` | `3000` | Yes | Next.js server port (internal) |
| `API_PORT` | `3201` | Yes | Bun API server port (internal) |
| `API_HOST` | `localhost` | Yes | API server hostname (localhost in container) |
| `DATABASE_PATH` | `/app/db/mega-sena.db` | Yes | SQLite database file path |
| `NEXT_PUBLIC_BASE_URL` | - | Yes | Public URL for client-side fetch (HTTPS) |
| `NEXT_TELEMETRY_DISABLED` | `1` | No | Disable Next.js telemetry |
| `ALLOWED_ORIGIN` | - | No | CORS allowed origins (comma-separated) |

**Security Note:**
All environment variables are visible in Coolify UI to users with access. For truly sensitive data (API keys, passwords), use Coolify's "Secret" checkbox to encrypt values.


## Post-Deployment Tasks

### 1. Seed Historical Data (Required for Functionality)

```bash
# Via Coolify UI Terminal or SSH
docker compose exec app bun run scripts/pull-draws.ts
```

**Why:** Application needs historical lottery data to generate statistics and betting strategies. Without this, dashboard will show "No data available."

**Duration:** ~30 seconds for all ~2850 draws

### 2. Schedule Automatic Draw Updates (Recommended)

Create a cron job to fetch new draws daily:

```bash
# SSH into VPS
crontab -e

# Add: Fetch new draws daily at 9 PM (after CAIXA publishes results)
0 21 * * * /usr/bin/docker compose -f /root/coolify-migration/compose/megasena-analyser/docker-compose.yml exec -T app bun run scripts/pull-draws.ts --incremental >> /var/log/megasena-cron.log 2>&1
```

**Why:** Mega-Sena draws happen twice weekly (Wednesday, Saturday). This keeps the database current without manual intervention.

### 3. Configure Monitoring Alerts (Optional)

In Coolify UI → Application → Settings → Notifications:

- **Email:** your@email.com
- **Events:**
  - Container down
  - Health check failed
  - Deployment failed
  - High CPU/memory usage

**Why:** Get notified immediately if the application crashes or degrades.

### 4. Set Up Database Backups (Recommended)

See "Backup Strategy" section above for cron job configuration.

**Why:** SQLite databases can corrupt (rare but possible). Daily backups prevent data loss.

### 5. Review Resource Limits (After 1 Week)

Monitor actual usage in Coolify UI for 7 days, then adjust:

```yaml
# In docker-compose.coolify.yml
deploy:
  resources:
    limits:
      cpus: '1.0'      # Increase if CPU > 80%
      memory: 512M     # Increase if OOM errors occur
```

**Why:** Initial limits are conservative. Real-world usage may require more resources.


## Troubleshooting Guide

### Issue: Container Keeps Restarting

**Symptoms:**
- Coolify shows "Restarting" status
- Logs show repeating startup messages
- Health check never passes

**Diagnosis:**
```bash
docker compose logs app --tail 100
```

**Common Causes:**

1. **Database migration failure:**
   - Look for "Migration failed" in logs
   - Fix: Delete `/root/.../db/mega-sena.db` and restart

2. **Port conflict:**
   - Another service using port 3000 or 3201
   - Fix: Change ports in docker-compose.coolify.yml

3. **Out of memory:**
   - Logs show "JavaScript heap out of memory"
   - Fix: Increase memory limit to 768M or 1G

### Issue: HTTPS Not Working

**Symptoms:**
- HTTP works, HTTPS shows certificate error
- Browser shows "Not Secure" warning

**Diagnosis:**
```bash
dig megasena-analyzer.conhecendotudo.online +short
# Should return VPS IP

curl -I http://megasena-analyzer.conhecendotudo.online
# Should redirect to HTTPS
```

**Common Causes:**

1. **DNS not propagated:**
   - Wait 5-60 minutes
   - Check with: `dig @8.8.8.8 megasena-analyzer.conhecendotudo.online`

2. **Let's Encrypt rate limit:**
   - 5 certificate requests per domain per week
   - Fix: Wait or use staging certificate

3. **Firewall blocking port 443:**
   - Fix: Open port in VPS firewall
   ```bash
   ufw allow 443/tcp
   ```

### Issue: Database Queries Slow

**Symptoms:**
- Pages load slowly (> 5 seconds)
- API endpoints timeout
- High disk I/O

**Diagnosis:**
```bash
docker compose exec app bun -e "
const db = require('bun:sqlite').Database('/app/db/mega-sena.db');
console.log(db.query('PRAGMA page_count').get());
console.log(db.query('PRAGMA page_size').get());
"
```

**Fixes:**

1. **Run VACUUM to optimize:**
```bash
docker compose exec app bun run scripts/optimize-db.ts
```

2. **Check disk space:**
```bash
df -h
# Should have > 15% free
```

3. **Verify WAL mode:**
```bash
docker compose exec app bun -e "
const db = require('bun:sqlite').Database('/app/db/mega-sena.db');
console.log(db.query('PRAGMA journal_mode').get());
// Should output: { journal_mode: 'wal' }
"
```

### Issue: Application Returns 500 Errors

**Symptoms:**
- Frontend loads, but API calls fail
- Console shows "Internal Server Error"

**Diagnosis:**
```bash
docker compose logs app | grep ERROR
```

**Common Causes:**

1. **Database connection failed:**
   - Check file permissions
   ```bash
   ls -l /root/.../db/mega-sena.db
   # Should be owned by UID 1001 (nextjs user)
   ```

2. **Environment variable missing:**
   - Verify all required vars in Coolify
   - Check with: `docker compose exec app env | grep -E 'NODE_ENV|PORT|DATABASE'`

3. **CORS error:**
   - Check browser console for CORS messages
   - Fix: Add domain to `ALLOWED_ORIGIN` env var


## Migration from PM2 (If Applicable)

If you currently have the app running with PM2 on the same VPS, follow this migration procedure:

### Phase 1: Parallel Deployment (Zero Downtime)

1. **Deploy Docker version on different ports:**
   - Docker: 3000 (Next.js), 3301 (API)
   - PM2: 3002 (Next.js), 3201 (API)
   - Both run simultaneously

2. **Test Docker version:**
   - Access via IP: `http://VPS_IP:3000`
   - Verify all functionality
   - Monitor for 24 hours

3. **Switch DNS:**
   - Update reverse proxy to point to Docker ports
   - Or: Change Coolify domain config

### Phase 2: PM2 Shutdown

1. **Stop PM2 processes:**
```bash
pm2 stop megasena-next
pm2 stop megasena-api
pm2 delete megasena-next
pm2 delete megasena-api
pm2 save
```

2. **Backup PM2 database (if different):**
```bash
cp /path/to/pm2/db/mega-sena.db /root/coolify.../db/mega-sena.db.pm2-backup
```

3. **Reclaim ports (if needed):**
```bash
# Update Coolify docker-compose.yml to use original ports
# Restart Coolify container
```

### Phase 3: Cleanup

1. **Remove PM2 files:**
```bash
rm -rf /path/to/pm2/app
rm -rf ~/.pm2/logs/megasena-*
```

2. **Uninstall PM2 (optional):**
```bash
npm uninstall -g pm2
```

3. **Update documentation:**
   - Update deployment docs to reference Coolify
   - Archive PM2 scripts


## Summary Checklist

Before considering deployment complete:

- [ ] `docker-compose.coolify.yml` created and committed (optional)
- [ ] Coolify resource created with correct configuration
- [ ] Domain configured: `megasena-analyzer.conhecendotudo.online`
- [ ] SSL certificate issued and valid
- [ ] Container status: Running + Healthy
- [ ] Health endpoint returns HTTP 200
- [ ] Frontend accessible via HTTPS
- [ ] Database migrations applied successfully
- [ ] Historical draw data seeded (via `pull-draws.ts`)
- [ ] User acceptance test passed (bet generation works)
- [ ] Monitoring alerts configured
- [ ] Backup cron job created
- [ ] Documentation updated (README deployment section)
- [ ] Rollback procedure tested (optional but recommended)

**When all items checked, deployment is COMPLETE.**


---

## Revision History

- **2025-10-26:** Initial version - Comprehensive Coolify deployment plan created
