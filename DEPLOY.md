# Production Deployment Guide

**Target:** Hostinger VPS with Coolify
**Domain:** https://megasena-analyser.conhecendotudo.online
**Deployment Time:** ~4-5 minutes

## Pre-Deployment Checklist

- [x] Docker Compose configuration created
- [x] Dockerfile updated to use port 80
- [x] All changes committed and pushed to GitHub
- [ ] DNS pointing to VPS IP
- [ ] Coolify accessible
- [ ] VPS has minimum 20GB free disk space

## Deployment Method 1: Coolify UI (Recommended)

### Step 1: Access Coolify

1. Open browser to your Coolify instance
2. Log in with credentials
3. Navigate to: **Projects** → **Add Resource** → **Docker Compose**

### Step 2: Paste Docker Compose Configuration

Copy the entire content below and paste into Coolify's Docker Compose editor:

```yaml
# ============================================================================
# Coolify Production Deployment Configuration
# Matches existing Traefik configuration on VPS
# Path: /root/coolify-migration/compose/megasena-analyser/docker-compose.yml
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

    container_name: megasena-analyser

    # Expose port 80 for Traefik (matches production pattern)
    # Container will listen on port 80 internally
    expose:
      - "80"

    # Production environment variables
    environment:
      - NODE_ENV=production
      # CRITICAL: Set to 80 to match Traefik service port configuration
      - PORT=80
      - API_PORT=3201
      - API_HOST=localhost
      - DATABASE_PATH=/app/db/mega-sena.db
      # Use exact domain from production config
      - NEXT_PUBLIC_BASE_URL=https://megasena-analyser.conhecendotudo.online
      - NEXT_TELEMETRY_DISABLED=1
      - ALLOWED_ORIGIN=https://megasena-analyser.conhecendotudo.online

    # Persist database across redeployments
    volumes:
      - ./db:/app/db
      - ./logs:/app/logs

    # Auto-restart on failure
    restart: unless-stopped

    # Health check for Coolify monitoring
    # Check API server since it starts first
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

    # Traefik labels - MUST match production pattern exactly
    labels:
      - "coolify.managed=true"
      - "traefik.enable=true"
      # Entrypoint: use 'https' to match production
      - "traefik.http.routers.megasena-analyser.entrypoints=https"
      # TLS configuration
      - "traefik.http.routers.megasena-analyser.tls=true"
      - "traefik.http.routers.megasena-analyser.tls.certresolver=letsencrypt"
      # Routing rule - exact domain from production
      - "traefik.http.routers.megasena-analyser.rule=Host(`megasena-analyser.conhecendotudo.online`)"
      # Service port - MUST be 80 to match production pattern
      - "traefik.http.services.megasena-analyser.loadbalancer.server.port=80"
      # Rate limiting - matches production (100 requests/sec average)
      - "traefik.http.middlewares.ratelimit.rateLimit.average=100"

# Use Coolify's network (external, created by Coolify)
networks:
  default:
    name: coolify
    external: true
```

### Step 3: Configure Resource

**General Settings:**
- Name: `Mega-Sena Analyser`
- Description: `Lottery analysis and bet generation`

**Deployment Path:**
```
/root/coolify-migration/compose/megasena-analyser/docker-compose.yml
```

**Domain:**
```
megasena-analyser.conhecendotudo.online
```

**SSL Settings:**
- ✓ Enable Automatic SSL (Let's Encrypt)
- ✓ Force HTTPS redirect

### Step 4: Deploy

1. Click **"Save"** to create resource
2. Click **"Deploy"** button
3. Watch deployment logs in real-time

**Expected Timeline:**
```
[0:00 - 2:30] Building Docker image (multi-stage build)
[2:30 - 3:00] Starting container
[3:00 - 3:30] Database migrations
[3:30 - 4:00] SSL certificate issuance
[4:00 - 4:30] Traefik routing configuration
─────────────────────────────────────────────────
Total: ~4-5 minutes
```

**Success Indicators:**
- ✓ Container status: **Running** (green)
- ✓ Health check: **Healthy**
- ✓ Logs show: "✅ All services started successfully"
- ✓ Logs show: "Applied migration" entries

### Step 5: Verify Deployment

**Via Coolify UI:**
1. Check container status: **Running** + **Healthy**
2. View logs for startup messages
3. Verify no error messages

**Via Browser:**
1. Visit: https://megasena-analyser.conhecendotudo.online
2. Check SSL certificate (green padlock)
3. Navigate to `/dashboard` - should load
4. Navigate to `/dashboard/generator` - should load

**Via SSH (Optional):**
```bash
ssh root@your-vps-ip
cd /root/coolify-migration/compose/megasena-analyser
bash <(curl -s https://raw.githubusercontent.com/mneves75/megasena-analyser-webapp/main/scripts/deploy-verify.sh)
```

Or run verification script from repository:
```bash
chmod +x scripts/deploy-verify.sh
scp scripts/deploy-verify.sh root@your-vps-ip:/tmp/
ssh root@your-vps-ip "bash /tmp/deploy-verify.sh"
```

### Step 6: Seed Database

The database starts empty. Populate with historical draws:

**Via Coolify UI Terminal:**
1. Go to Application → Terminal
2. Click "Open Terminal"
3. Run:
```bash
bun run scripts/pull-draws.ts
```

**Via SSH:**
```bash
ssh root@your-vps-ip
docker exec megasena-analyser bun run scripts/pull-draws.ts
```

**Expected Output:**
```
📡 Fetching Mega-Sena draws from CAIXA API...
✅ Fetched 2847 draws
💾 Saving to database...
✅ Inserted 2847 draws
✅ Complete! Database now has 2847 draws
```

**Duration:** ~30 seconds

---

## Deployment Method 2: Direct SSH (Advanced)

If Coolify UI is unavailable, deploy directly via SSH:

### Step 1: Clone Repository on VPS

```bash
ssh root@your-vps-ip

# Navigate to deployment directory
cd /root/coolify-migration/compose/megasena-analyser

# Clone repository (if not already cloned)
git clone https://github.com/mneves75/megasena-analyser-webapp.git .

# Or pull latest changes
git pull origin main
```

### Step 2: Deploy with Docker Compose

```bash
# Stop existing container (if any)
docker compose down

# Pull latest images
docker compose -f docker-compose.coolify.yml pull

# Build and start
docker compose -f docker-compose.coolify.yml up -d --build

# Watch logs
docker compose -f docker-compose.coolify.yml logs -f
```

### Step 3: Verify

```bash
# Check status
docker compose -f docker-compose.coolify.yml ps

# Test health endpoint
curl http://localhost:3201/api/health

# Check SSL
curl -I https://megasena-analyser.conhecendotudo.online
```

---

## Post-Deployment Tasks

### 1. Configure Automatic Draw Updates

Set up cron job to fetch new draws daily:

```bash
ssh root@your-vps-ip
crontab -e

# Add this line (runs daily at 9 PM after CAIXA publishes results)
0 21 * * * docker exec megasena-analyser bun run scripts/pull-draws.ts --incremental >> /var/log/megasena-cron.log 2>&1
```

### 2. Set Up Database Backups

```bash
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * docker exec megasena-analyser bun -e "require('bun:sqlite').Database('/app/db/mega-sena.db').exec('VACUUM INTO \"/app/db/backup-$(date +\%Y\%m\%d).db\"')"

# Keep only last 7 backups
5 2 * * * find /root/coolify-migration/compose/megasena-analyser/db -name "backup-*.db" -mtime +7 -delete
```

### 3. Monitor Application

**Check logs:**
```bash
docker logs -f megasena-analyser
```

**Monitor resources:**
```bash
docker stats megasena-analyser
```

**Health check:**
```bash
watch -n 5 'curl -s https://megasena-analyser.conhecendotudo.online/api/health'
```

---

## Troubleshooting

### Issue: Container Won't Start

**Check logs:**
```bash
docker logs megasena-analyser
```

**Common causes:**
1. Port conflict - check if another service uses port 80
2. Out of memory - increase limits in docker-compose.yml
3. Database corruption - delete db/mega-sena.db and restart

### Issue: SSL Certificate Not Issued

**Check DNS:**
```bash
dig megasena-analyser.conhecendotudo.online +short
```

**Check Traefik:**
```bash
docker logs traefik | grep megasena-analyser
```

**Force renewal:**
- Delete certificate in Coolify
- Redeploy application

### Issue: 500 Errors

**Check application logs:**
```bash
docker exec megasena-analyser tail -100 /app/logs/app.log
```

**Check API health:**
```bash
docker exec megasena-analyser curl http://localhost:3201/api/health
```

**Common causes:**
1. Database not migrated - check logs for "Applied migration"
2. Environment variables missing - verify in Coolify
3. Disk space full - check with `df -h`

### Issue: Slow Performance

**Optimize database:**
```bash
docker exec megasena-analyser bun run scripts/optimize-db.ts
```

**Check resource usage:**
```bash
docker stats megasena-analyser
```

**Increase resources if needed:**
Edit docker-compose.yml:
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'      # Increase from 1.0
      memory: 1024M    # Increase from 512M
```

---

## Rollback Procedure

### Method 1: Via Coolify UI

1. Navigate to Application → Deployments
2. Find previous successful deployment
3. Click "Rollback to this deployment"

### Method 2: Via Docker

```bash
ssh root@your-vps-ip
cd /root/coolify-migration/compose/megasena-analyser

# Stop current version
docker compose down

# Checkout previous version
git log --oneline  # Find commit hash
git checkout <previous-commit-hash>

# Redeploy
docker compose up -d --build
```

### Method 3: Database Restore

If database corrupted:

```bash
# Stop container
docker compose down

# List backups
ls -lht db/backup-*.db

# Restore
cp db/backup-YYYYMMDD.db db/mega-sena.db

# Restart
docker compose up -d
```

---

## Verification Checklist

After deployment, verify ALL of these:

- [ ] Container running: `docker ps | grep megasena-analyser`
- [ ] Health check passing: `docker inspect megasena-analyser | grep Health`
- [ ] HTTPS working: `curl -I https://megasena-analyser.conhecendotudo.online`
- [ ] SSL valid: Check browser for green padlock
- [ ] Homepage loads: Visit https://megasena-analyser.conhecendotudo.online
- [ ] Dashboard loads: Visit /dashboard
- [ ] Generator works: Test bet generation
- [ ] Statistics show data: Visit /dashboard/statistics
- [ ] API responsive: `curl https://megasena-analyser.conhecendotudo.online/api/health`
- [ ] Database has data: Check /dashboard shows draws
- [ ] No errors in logs: `docker logs megasena-analyser | grep -i error`
- [ ] Resources within limits: `docker stats megasena-analyser`

---

## Support & Maintenance

**Documentation:**
- Full deployment plan: `agent_planning/coolify-deployment-plan.md`
- Architecture details: `CLAUDE.md`
- API documentation: `docs/SYSTEM_PROMPT.md`

**Monitoring:**
- Coolify UI: Application dashboard
- Logs: `docker logs -f megasena-analyser`
- Metrics: Coolify resource monitoring

**Updates:**
```bash
# Pull latest code
cd /root/coolify-migration/compose/megasena-analyser
git pull origin main

# Rebuild and restart
docker compose down
docker compose up -d --build
```

---

**Last Updated:** 2025-10-26
**Version:** 1.1.2
**Status:** Production Ready ✅
