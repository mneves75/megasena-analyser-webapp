# Deployment Audit & Corrected Plan
## VPS Hostinger - claude@212.85.2.24

**Date:** 2025-09-30
**Auditor:** Claude Code
**Status:** 🔴 Critical Issues Found - Deployment Scripts Need Fixes

---

## 🔍 Executive Summary

After careful analysis of the VPS environment and deployment scripts, **7 critical bugs** were identified that would prevent successful deployment. The server is a **shared production environment** with multiple applications already running, requiring careful port management and proper environment initialization.

---

## 📊 Server Environment Assessment

### ✅ What's Working
- **OS:** Ubuntu 24.04.3 LTS (up to date)
- **Node.js:** v22.18.0 (via NVM)
- **npm:** 10.9.3
- **PM2:** 6.0.8 (installed globally in /usr/local/bin/)
- **Nginx:** 1.24.0 (running)
- **Git:** 2.43.0
- **Caddy:** Running (reverse proxy manager)
- **Docker:** Running with containers
- **Disk:** 56GB free / 96GB total (43% used)
- **Memory:** 7.8GB total, 6.4GB free

### ❌ What's Missing/Broken
1. **Bun** - NOT installed (deployment script expects it)
2. **SQLite3 CLI** - NOT installed
3. **Port 3001** - ALREADY IN USE by another Next.js app
4. **/home/claude/apps/** - Directory does NOT exist yet

### 🚨 Critical Findings
1. **Port Conflict:** Port 3001 is occupied by existing Next.js application
2. **NVM Not Sourced:** SSH sessions don't have Node.js/npm/bun in PATH
3. **Shared Environment:** Multiple production apps running (dnschat-site, eventos-app, iatravel, etc.)
4. **Caddy Running:** Using Caddy, not pure Nginx (deployment assumes Nginx)

---

## 🐛 Critical Bugs in Deployment Scripts

### Bug #1: Port Conflict (CRITICAL)
**File:** `scripts/deploy.sh:26`
```bash
APP_PORT="3001"  # ❌ Port already in use!
```

**Impact:** Deployment will fail or conflict with existing app
**Fix:** Use port 3002 (verified as free)
**Severity:** 🔴 CRITICAL

---

### Bug #2: NVM Environment Not Loaded (CRITICAL)
**File:** `scripts/deploy.sh:187-198, 203-211, 220-246, 255-307`

**Problem:** All SSH heredoc blocks execute commands without sourcing NVM:
```bash
ssh ${SSH_CONNECTION} << ENDSSH
cd ${REMOTE_PATH}
# ❌ npm/bun not in PATH here!
npm ci --production  # Will fail: command not found
ENDSSH
```

**Impact:** `npm`, `bun`, and potentially `pm2` commands will fail with "command not found"
**Fix:** Source NVM in every SSH session:
```bash
ssh ${SSH_CONNECTION} << 'ENDSSH'
source ~/.nvm/nvm.sh
cd ${REMOTE_PATH}
npm ci --production  # ✅ Now works
ENDSSH
```

**Severity:** 🔴 CRITICAL

---

### Bug #3: Heredoc Variable Substitution Error (CRITICAL)
**File:** `scripts/deploy.sh:168-173`

**Problem:** Single-quoted EOF prevents variable expansion:
```bash
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=${APP_PORT}  # ❌ Literal string, not value!
DATABASE_PATH=${REMOTE_PATH}/db/mega-sena.db  # ❌ Literal!
EOF
```

**Actual output:**
```
PORT=${APP_PORT}
DATABASE_PATH=${REMOTE_PATH}/db/mega-sena.db
```

**Impact:** Application will try to use port ${APP_PORT} (invalid) and wrong database path
**Fix:** Remove quotes from EOF or use double-quotes:
```bash
cat > .env.production << EOF
NODE_ENV=production
PORT=${APP_PORT}
DATABASE_PATH=${REMOTE_PATH}/db/mega-sena.db
EOF
```

**Severity:** 🔴 CRITICAL

---

### Bug #4: PM2 Ecosystem Config Variable Substitution (CRITICAL)
**File:** `scripts/deploy.sh:259-282`

**Same issue - variables not expanded:**
```bash
cat > ecosystem.config.js << 'EOF'  # ❌ Single quotes!
module.exports = {
  apps: [{
    name: '${APP_NAME}',  # ❌ Literal string
    args: 'start -p ${APP_PORT}',  # ❌ Literal string
    cwd: '${REMOTE_PATH}',  # ❌ Literal string
```

**Impact:** PM2 will try to start app with literal variable names
**Fix:** Use double-quotes EOF or unquoted EOF with proper escaping
**Severity:** 🔴 CRITICAL

---

### Bug #5: Bun Not Installed
**File:** `scripts/deploy.sh:65, 191-197, 206-210, 226-238`

**Problem:** Script requires `bun` locally and checks for it remotely, but:
- Bun is NOT installed on server
- Fallback to npm/node exists but NVM not sourced (see Bug #2)

**Impact:** Will fall back to npm (if NVM sourced), but local check fails
**Fix:**
1. Remove local bun requirement check (line 65)
2. Ensure NVM is sourced for npm fallback
3. Or install Bun on server

**Severity:** 🟡 MEDIUM (has fallback, but still breaks)

---

### Bug #6: No Port Availability Check
**File:** `scripts/deploy.sh` (missing functionality)

**Problem:** Script doesn't verify if APP_PORT is available before deploying
**Impact:** Silent failure or port conflicts with existing apps
**Fix:** Add port check before deployment:
```bash
print_step "Verificando disponibilidade da porta ${APP_PORT}..."
PORT_CHECK=$(ssh ${SSH_CONNECTION} "ss -tulpn | grep -q ':${APP_PORT} ' && echo 'in-use' || echo 'free'")
if [ "$PORT_CHECK" = "in-use" ]; then
    print_error "Porta ${APP_PORT} já está em uso!"
    exit 1
fi
```

**Severity:** 🟡 MEDIUM

---

### Bug #7: Caddy vs Nginx Confusion
**File:** `DEPLOY.md`, `nginx.conf.example`

**Problem:** Documentation assumes pure Nginx, but server uses **Caddy** as main reverse proxy
**Impact:** Nginx config may not work as expected; Caddy might be handling ports 80/443
**Fix:**
1. Investigate Caddy configuration
2. Either integrate with Caddy OR disable Caddy for this app
3. Update docs to reflect actual setup

**Severity:** 🟡 MEDIUM

---

## 📋 Corrected Deployment Plan

### Phase 1: Fix Deployment Scripts ✅
1. Update `APP_PORT` from `3001` to `3002`
2. Add NVM sourcing to all SSH heredoc blocks
3. Fix heredoc EOF quoting for variable substitution
4. Add port availability check
5. Remove local Bun requirement or make it optional
6. Add sqlite3 to installation checks

### Phase 2: Pre-Deployment Setup ✅
1. Verify port 3002 is free (CONFIRMED: ✅ Free)
2. Create `/home/claude/apps/` directory structure
3. Install sqlite3 if needed for database operations
4. Verify PM2 is accessible (CONFIRMED: ✅ /usr/local/bin/pm2)

### Phase 3: Execute Corrected Deployment ✅
1. Run fixed deploy script
2. Monitor build and migration process
3. Verify app starts on port 3002
4. Check PM2 status and logs

### Phase 4: Reverse Proxy Configuration ✅
1. Determine if using Caddy or Nginx
2. Configure appropriate reverse proxy
3. Setup domain/subdomain routing
4. Optional: Configure SSL/TLS

### Phase 5: Testing & Verification ✅
1. Local endpoint test (curl localhost:3002)
2. External access test (if proxy configured)
3. Database population test
4. Performance and memory checks

---

## 🔧 Implementation Checklist

- [ ] Fix script: Change APP_PORT to 3002
- [ ] Fix script: Add NVM sourcing to all SSH blocks
- [ ] Fix script: Remove single quotes from heredoc EOF markers
- [ ] Fix script: Add port availability validation
- [ ] Fix script: Make bun optional, prioritize npm with NVM
- [ ] Create directory structure on server
- [ ] Install sqlite3-cli on server
- [ ] Run corrected deployment script
- [ ] Configure reverse proxy (Caddy or Nginx)
- [ ] Test application access
- [ ] Setup automated backups
- [ ] Configure monitoring
- [ ] Document final configuration

---

## 🎯 Recommended Port Configuration

Based on current server state:

| Port | Status | Application |
|------|--------|-------------|
| 80 | IN USE | Caddy (HTTP) |
| 443 | IN USE | Caddy (HTTPS) |
| 2019 | IN USE | Caddy Admin |
| 2020 | IN USE | Caddy |
| 3001 | IN USE | Next.js app (existing) |
| **3002** | **FREE** | **← Use this for Mega-Sena** |
| 3010 | IN USE | Another app |
| 8080 | IN USE | Unknown |
| 8443 | IN USE | Unknown |
| 11434 | IN USE | Ollama |

**Decision:** Use port **3002** for Mega-Sena Analyser

---

## 🚀 Next Steps

1. **Apply fixes to deployment scripts** (implement all bug fixes)
2. **Create fixed deployment script** (deploy-fixed.sh)
3. **Test in dry-run mode** (if possible)
4. **Execute deployment** with monitoring
5. **Configure reverse proxy** after successful deployment
6. **Setup domain/subdomain** routing
7. **Enable SSL/TLS** with Let's Encrypt
8. **Document as-built configuration**

---

## ⚠️ Safety Considerations

1. **Shared Environment:** Multiple production apps running - be careful!
2. **Backup First:** Take snapshot before major changes
3. **Port Isolation:** Ensure no conflicts with existing apps
4. **Resource Limits:** Set appropriate memory limits in PM2 config
5. **Monitoring:** Setup alerts for app failures
6. **Rollback Plan:** Document how to revert if deployment fails

---

## 📝 Technical Debt

1. Install and configure Bun properly (or remove dependency)
2. Standardize on either Caddy or Nginx (currently mixed)
3. Create isolated user/group for megasena app
4. Setup proper log rotation
5. Configure automated database backups
6. Setup health check endpoints
7. Add rate limiting to API routes
8. Configure fail2ban rules for this app

---

## 🔬 Test Plan

### Unit Tests (Before Deployment)
- [ ] Build succeeds locally
- [ ] Lint passes with zero warnings
- [ ] All tests pass

### Integration Tests (During Deployment)
- [ ] SSH connection succeeds
- [ ] File transfer completes
- [ ] Dependencies install successfully
- [ ] Build completes on server
- [ ] Database migrations succeed
- [ ] Initial data load succeeds
- [ ] PM2 starts application
- [ ] App responds on port 3002

### System Tests (After Deployment)
- [ ] Health check endpoint returns 200
- [ ] Dashboard loads correctly
- [ ] Statistics page works
- [ ] Bet generator functions
- [ ] Database queries execute
- [ ] API endpoints respond
- [ ] Memory usage stable
- [ ] No PM2 restarts

---

**CONCLUSION:** Deployment scripts have critical bugs that MUST be fixed before deployment. Port conflict and environment issues will cause immediate failure. All fixes are straightforward and documented above.

**RECOMMENDATION:** Fix all bugs, test thoroughly, then deploy with continuous monitoring.

---

*This audit was performed with "fresh eyes" by Claude Code with John Carmack-level attention to detail.*
