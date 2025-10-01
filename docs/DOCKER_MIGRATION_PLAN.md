# Docker Migration Plan - PM2 to Docker
**Date:** 2025-10-01
**Status:** 🚀 READY TO EXECUTE
**Reviewer:** John Carmack
**VPS:** 212.85.2.24 (Hostinger)

---

## Mission

Safely migrate the Mega-Sena Analyser from PM2-based deployment to Docker containers on production VPS with **zero downtime** and **full rollback capability**.

---

## Current State Assessment

### Existing PM2 Deployment
```
Location: /home/claude/apps/megasena-analyser/
Processes:
  - megasena-analyser (Next.js on port 3002)
  - megasena-api (Bun API on port 3201)
Reverse Proxy: Caddy → localhost:3002
Database: /home/claude/apps/megasena-analyser/db/mega-sena.db
```

### Target Docker Deployment
```
Location: /home/claude/apps/megasena-analyser/
Container: megasena-analyser
Ports:
  - 3000 (Next.js, mapped to host 3000)
  - 3201 (Bun API, mapped to host 3201)
Reverse Proxy: Caddy → localhost:3000 (UPDATE REQUIRED)
Database: Volume-mounted from ./db/mega-sena.db
```

---

## Pre-Migration Checklist

- [ ] Docker installed on VPS
- [ ] Database backup created
- [ ] PM2 processes documented
- [ ] Caddy configuration backed up
- [ ] Rollback script ready
- [ ] Off-hours deployment window scheduled

---

## Migration Phases

### Phase 1: Preparation (Local)
**Duration:** 5 minutes
**Risk:** LOW

1. Create Docker deployment script (`scripts/deploy-docker.sh`)
2. Create migration script (`scripts/migrate-to-docker.sh`)
3. Create PM2 cleanup script (`scripts/cleanup-pm2.sh`)
4. Test scripts locally (syntax check)

**Deliverables:**
- `scripts/deploy-docker.sh` - Docker-based deployment automation
- `scripts/migrate-to-docker.sh` - Complete migration orchestration
- `scripts/cleanup-pm2.sh` - Safe PM2 removal

---

### Phase 2: VPS Preparation (Remote)
**Duration:** 10 minutes
**Risk:** LOW

1. Install Docker on VPS
2. Install Docker Compose
3. Create backup directory structure
4. Backup current database
5. Backup current PM2 configuration
6. Document current Caddy config

**Acceptance Criteria:**
- Docker version ≥ 20.10 installed
- Docker Compose version ≥ 2.0 installed
- Database backup created with timestamp
- PM2 config saved to backup file

---

### Phase 3: Parallel Deployment (Remote)
**Duration:** 5 minutes
**Risk:** MEDIUM

1. Deploy Docker stack alongside PM2
2. Run migrations on Docker container
3. Verify Docker health checks pass
4. Test API endpoints (port 3201)
5. Test Next.js (port 3000)

**Acceptance Criteria:**
- Docker containers running and healthy
- API responds on localhost:3201
- Next.js responds on localhost:3000
- Database accessible in container
- No conflicts with PM2 processes

---

### Phase 4: Traffic Cutover (Remote)
**Duration:** 2 minutes
**Risk:** MEDIUM

1. Update Caddy to point to Docker (port 3000 instead of 3002)
2. Reload Caddy configuration
3. Verify traffic flowing to Docker
4. Monitor logs for errors
5. Check public URL

**Acceptance Criteria:**
- Caddy proxying to localhost:3000
- Public URL responding correctly
- No 502/503 errors
- Logs clean and healthy

---

### Phase 5: PM2 Shutdown (Remote)
**Duration:** 2 minutes
**Risk:** LOW (Docker already serving traffic)

1. Stop PM2 processes (megasena-analyser, megasena-api)
2. Verify Docker still serving traffic
3. Remove PM2 from startup
4. Archive PM2 logs

**Acceptance Criteria:**
- PM2 processes stopped
- Docker containers still running
- Public site still accessible
- No service interruption

---

### Phase 6: Cleanup (Remote)
**Duration:** 5 minutes
**Risk:** LOW

1. Remove old PM2 configuration
2. Remove PM2 globally (optional)
3. Clean up old log files
4. Update documentation
5. Verify disk space freed

**Acceptance Criteria:**
- Old PM2 config removed
- Disk space reclaimed
- Documentation updated
- Clean deployment state

---

### Phase 7: Monitoring (Remote)
**Duration:** 24 hours
**Risk:** LOW

1. Monitor Docker container health
2. Monitor resource usage (CPU, memory)
3. Check logs for errors
4. Verify automated backups running
5. Test rollback procedure (dry run)

**Acceptance Criteria:**
- No container restarts
- Resource usage normal (< 50% memory, < 30% CPU)
- Logs clean
- Backups completing successfully

---

## Rollback Plan

### Immediate Rollback (< 5 minutes)

**Scenario:** Docker deployment fails or has critical issues

**Steps:**
```bash
# 1. Update Caddy back to PM2
sudo sed -i 's/localhost:3000/localhost:3002/g' /etc/caddy/Caddyfile
sudo systemctl reload caddy

# 2. Stop Docker
cd /home/claude/apps/megasena-analyser
docker compose down

# 3. Restore database from backup
cp db/backups/pre-docker-migration-*.db db/mega-sena.db

# 4. Restart PM2
source ~/.nvm/nvm.sh
pm2 restart ecosystem.config.js

# 5. Verify
pm2 status
curl http://localhost:3002
curl https://conhecendotudo.online/megasena-analyzer
```

**Expected Time:** 3-5 minutes
**Success Criteria:** Site accessible via PM2, no data loss

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Database corruption | LOW | HIGH | Pre-migration backup, atomic operations |
| Port conflicts | LOW | MEDIUM | Deploy Docker on different ports initially |
| Caddy misconfiguration | LOW | HIGH | Backup config, test before apply |
| Docker fails to start | MEDIUM | HIGH | PM2 still running during cutover |
| Resource exhaustion | LOW | MEDIUM | Resource limits in docker-compose |
| Data loss during migration | VERY LOW | CRITICAL | Multiple backups, volume mounts |

---

## Success Criteria

### Technical Metrics
- ✅ Docker containers running with `restart: unless-stopped`
- ✅ Health checks passing every 30 seconds
- ✅ API response time < 200ms
- ✅ Memory usage < 512 MB
- ✅ CPU usage < 50%
- ✅ Zero downtime during migration

### Business Metrics
- ✅ Public site accessible throughout migration
- ✅ No user-facing errors
- ✅ Database integrity maintained
- ✅ All features working post-migration

---

## Communication Plan

### Before Migration
- [ ] Notify stakeholders (if any)
- [ ] Schedule maintenance window (optional, should be zero downtime)
- [ ] Document current state

### During Migration
- [ ] Real-time monitoring via SSH
- [ ] Log all actions
- [ ] Screenshot key verification steps

### After Migration
- [ ] Status update (success/rollback)
- [ ] Performance report
- [ ] Lessons learned

---

## Detailed Step-by-Step Execution

### STEP 1: Create Docker Deployment Script

**File:** `scripts/deploy-docker.sh`

**Features:**
- SSH to VPS
- Build Docker image (or pull from registry)
- Deploy via docker-compose
- Run database migrations
- Health check verification
- Automated rollback on failure

---

### STEP 2: Create Migration Orchestration Script

**File:** `scripts/migrate-to-docker.sh`

**Features:**
- Pre-flight checks (Docker installed, PM2 running)
- Database backup
- Parallel deployment (Docker + PM2)
- Traffic cutover
- PM2 shutdown
- Verification
- Automatic rollback on any failure

---

### STEP 3: Create PM2 Cleanup Script

**File:** `scripts/cleanup-pm2.sh`

**Features:**
- Stop PM2 processes
- Remove PM2 configuration
- Archive PM2 logs
- Clean up old files
- Optional: uninstall PM2 globally

---

### STEP 4: Install Docker on VPS

**Commands:**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker claude
newgrp docker

# Install Docker Compose (if not included)
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Verify
docker --version
docker compose version
```

---

### STEP 5: Execute Migration

**Command:**
```bash
# From local machine
bash scripts/migrate-to-docker.sh
```

**Expected Output:**
```
✓ Pre-flight checks passed
✓ Database backed up (116 KB)
✓ Docker containers deployed
✓ Health checks passing
✓ Caddy updated
✓ Traffic cutover complete
✓ PM2 processes stopped
✓ Migration complete
```

---

## Post-Migration Tasks

### Immediate (Day 1)
- [ ] Monitor container health for 24 hours
- [ ] Verify backups running
- [ ] Check logs for anomalies
- [ ] Test all functionality

### Week 1
- [ ] Remove PM2 configuration files
- [ ] Update documentation
- [ ] Archive old deployment scripts
- [ ] Performance tuning (if needed)

### Week 2
- [ ] Full PM2 cleanup (optional uninstall)
- [ ] Verify CI/CD pipeline
- [ ] Load testing (optional)
- [ ] Create runbook

---

## Documentation Updates Required

- [x] `docs/DEPLOY_VPS/DEPLOY.md` - Mark as deprecated, link to Docker guide
- [x] `docs/DEPLOY_VPS/DEPLOY_DOCKER.md` - Mark as current deployment method
- [ ] `README.md` - Update deployment instructions
- [ ] `CHANGELOG.md` - Add migration notes

---

## Testing Checklist

### Pre-Migration Testing (Local)
- [ ] Build Docker image successfully
- [ ] Start containers locally
- [ ] Verify health checks
- [ ] Test API endpoints
- [ ] Test Next.js pages
- [ ] Verify database access

### Post-Migration Testing (VPS)
- [ ] Public URL accessible
- [ ] All pages load correctly
- [ ] API endpoints responding
- [ ] Database queries working
- [ ] Backups completing
- [ ] Logs clean

---

## Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Preparation (Local) | 5 min | 5 min |
| VPS Preparation | 10 min | 15 min |
| Parallel Deployment | 5 min | 20 min |
| Traffic Cutover | 2 min | 22 min |
| PM2 Shutdown | 2 min | 24 min |
| Cleanup | 5 min | 29 min |
| **Total Migration** | **< 30 min** | **30 min** |
| Monitoring Period | 24 hours | - |

---

## Emergency Contacts

- **VPS Access:** SSH claude@212.85.2.24
- **Caddy Logs:** `sudo journalctl -u caddy -f`
- **Docker Logs:** `docker compose logs -f`
- **PM2 Logs:** `pm2 logs`

---

## Sign-off

### Before Migration
- [ ] Plan reviewed and approved
- [ ] Rollback procedure tested
- [ ] Backup verified
- [ ] All scripts created and tested

### After Migration
- [ ] Migration completed successfully
- [ ] Public site verified working
- [ ] No errors in logs
- [ ] Performance acceptable
- [ ] Documentation updated

---

**Document Version:** 1.0
**Last Updated:** 2025-10-01
**Status:** Ready for Execution
**Approved By:** Pending Carmack Review
