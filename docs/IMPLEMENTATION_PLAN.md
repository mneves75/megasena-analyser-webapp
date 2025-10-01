# Docker Deployment & Bug Fixes - Implementation Plan
**Date:** 2025-10-01
**Reviewer:** John Carmack
**Status:** 🚀 IN PROGRESS

---

## Mission Statement

Transform the Mega-Sena Analyser from manual PM2 deployment to a fully Dockerized, CI/CD-enabled production system with zero bugs and comprehensive automation.

**Quality Bar:** Production-ready code that John Carmack would approve ✓

---

## Phase 1: Critical Bug Fixes (BLOCKING)
**Priority:** 🔴 CRITICAL - Must be completed first

### Task 1.1: Fix Linting Error in lib/db.ts
**Issue:** Unused `importBunSqlite` function breaks CI
**Location:** `lib/db.ts:371`
**Impact:** Blocks automated builds

**Action:**
- Remove unused async `importBunSqlite` function
- Keep synchronous `initializeDatabase` (works fine)
- Verify linting passes: `bun run lint`

**Acceptance Criteria:**
- ✅ `bun run lint` exits with code 0
- ✅ No TypeScript errors
- ✅ No unused variables/functions

---

### Task 1.2: Fix Production API Rewrite Configuration
**Issue:** Hardcoded `localhost` in `next.config.js` breaks Docker/distributed deployments
**Location:** `next.config.js:14`
**Impact:** API calls fail in containerized environments

**Action:**
- Add environment variables: `API_HOST`, `API_PORT`
- Update `next.config.js` to use env vars with sensible defaults
- Update `.env.example` with new variables
- Test in both local and Docker contexts

**Acceptance Criteria:**
- ✅ API rewrites work with `API_HOST=localhost`
- ✅ API rewrites work with `API_HOST=api-container`
- ✅ Defaults to `localhost:3201` if env vars missing
- ✅ Documentation updated

---

## Phase 2: Docker Infrastructure
**Priority:** 🟡 HIGH - Core deployment mechanism

### Task 2.1: Create Multi-Stage Dockerfile
**Goal:** Optimized production-ready Docker image <300MB

**Requirements:**
- Multi-stage build (deps → builder → runner)
- Alpine-based for minimal size
- Non-root user (security)
- Proper signal handling (dumb-init)
- Health checks built-in

**Acceptance Criteria:**
- ✅ Image builds successfully
- ✅ Image size < 300MB compressed
- ✅ Runs as non-root user
- ✅ Graceful shutdown on SIGTERM
- ✅ Both Next.js (3000) and API (3201) ports exposed

---

### Task 2.2: Create Docker Compose Configuration
**Goal:** Easy local development and production deployment

**Files to create:**
- `docker-compose.yml` - Development setup
- `docker-compose.prod.yml` - Production overrides
- `Caddyfile.local` - Local reverse proxy testing

**Acceptance Criteria:**
- ✅ `docker compose up` starts all services
- ✅ Health checks pass
- ✅ Database persists across restarts (volumes)
- ✅ Environment variables properly configured
- ✅ Resource limits defined for production

---

### Task 2.3: Create Docker Startup Script
**Goal:** Manage both Next.js and API server in container

**File:** `scripts/start-docker.ts`

**Requirements:**
- Start API server first (port 3201)
- Wait for API to be ready
- Start Next.js server (port 3000)
- Handle graceful shutdown (SIGTERM/SIGINT)
- Proper error logging

**Acceptance Criteria:**
- ✅ Both servers start successfully
- ✅ Graceful shutdown works
- ✅ Logs are clear and informative
- ✅ Process exits cleanly on error

---

### Task 2.4: Create .dockerignore
**Goal:** Reduce build context size and improve security

**Acceptance Criteria:**
- ✅ Excludes node_modules, .git, logs
- ✅ Excludes secrets and environment files
- ✅ Excludes build artifacts
- ✅ Build context < 50MB

---

## Phase 3: Automation & CI/CD
**Priority:** 🟡 HIGH - Enable automated deployments

### Task 3.1: Automated Database Backup Script
**Goal:** Daily backups with retention policy

**File:** `scripts/backup-database.ts`

**Requirements:**
- Create timestamped backups
- Retention: 30 days or 50 backups (whichever comes first)
- Automatic cleanup of old backups
- Comprehensive logging
- Docker-compatible

**Acceptance Criteria:**
- ✅ Creates backup successfully
- ✅ Cleans up old backups
- ✅ Works in Docker container
- ✅ Logs are clear
- ✅ Error handling robust

---

### Task 3.2: GitHub Actions CI/CD Pipeline
**Goal:** Automated testing, building, and deployment

**File:** `.github/workflows/ci-cd.yml`

**Jobs:**
1. Lint & Type Check
2. Unit Tests (with coverage)
3. Build Docker Image
4. Deploy to Production (main branch only)

**Acceptance Criteria:**
- ✅ All jobs pass successfully
- ✅ Docker image pushed to GHCR
- ✅ Deployment triggers on main branch push
- ✅ SSH deployment works correctly
- ✅ Health check validates deployment

---

### Task 3.3: Add CORS Configuration to API Server
**Goal:** Enable cross-origin requests for future mobile apps

**File:** `server.ts`

**Acceptance Criteria:**
- ✅ CORS headers added to responses
- ✅ Configurable via `ALLOWED_ORIGIN` env var
- ✅ OPTIONS preflight requests handled
- ✅ Default allows localhost and production domain

---

## Phase 4: Documentation
**Priority:** 🟢 MEDIUM - Essential for maintainability

### Task 4.1: Docker Deployment Guide
**File:** `docs/DEPLOY_VPS/DEPLOY_DOCKER.md`

**Contents:**
- Prerequisites and setup
- Building Docker images
- Environment configuration
- Volume management
- Backup/restore procedures
- Migration from PM2
- Troubleshooting

**Acceptance Criteria:**
- ✅ Complete step-by-step instructions
- ✅ All commands tested and verified
- ✅ Common issues documented
- ✅ Examples provided

---

### Task 4.2: Update CHANGELOG.md
**Goal:** Document all changes

**Additions:**
- Version 1.1.0 entry
- Docker support
- Bug fixes
- CI/CD pipeline
- Breaking changes (if any)

**Acceptance Criteria:**
- ✅ Follows Keep a Changelog format
- ✅ All changes documented
- ✅ Migration notes for breaking changes
- ✅ Links to relevant docs

---

### Task 4.3: Update README.md
**Goal:** Reflect new Docker-first workflow

**Updates:**
- Add Docker quick start
- Update development setup
- Add CI/CD badge
- Update deployment instructions

**Acceptance Criteria:**
- ✅ Docker commands documented
- ✅ Quick start works for new developers
- ✅ Badges display correctly
- ✅ Links are valid

---

## Phase 5: Testing & Validation
**Priority:** 🔴 CRITICAL - Ensure quality

### Task 5.1: Local Docker Testing
**Goal:** Verify Docker setup works end-to-end

**Tests:**
1. Build image successfully
2. Start containers with `docker compose up`
3. Access Next.js on localhost:3000
4. Access API on localhost:3201
5. Run database migrations
6. Create test bets
7. Graceful shutdown
8. Database persists across restarts

**Acceptance Criteria:**
- ✅ All manual tests pass
- ✅ No errors in logs
- ✅ Performance acceptable
- ✅ Resource usage reasonable

---

### Task 5.2: Production Deployment Test
**Goal:** Deploy to VPS successfully

**Steps:**
1. Build production image
2. Push to registry
3. Deploy via Docker Compose
4. Verify health endpoint
5. Test all functionality
6. Monitor for 1 hour
7. Check logs for errors

**Acceptance Criteria:**
- ✅ Deployment completes without errors
- ✅ Application accessible at production URL
- ✅ All features working
- ✅ No performance degradation
- ✅ Logs clean

---

### Task 5.3: Rollback Test
**Goal:** Verify we can roll back if needed

**Steps:**
1. Deploy new version
2. Simulate failure
3. Rollback to previous version
4. Restore database backup
5. Verify application works

**Acceptance Criteria:**
- ✅ Rollback completes in < 5 minutes
- ✅ No data loss
- ✅ Application functional
- ✅ Process documented

---

## Phase 6: Performance & Optimization
**Priority:** 🟢 MEDIUM - Nice to have

### Task 6.1: Optimize Docker Image Size
**Goal:** Minimize image size and layers

**Actions:**
- Combine RUN commands where possible
- Remove unnecessary files
- Use .dockerignore effectively
- Enable BuildKit caching

**Acceptance Criteria:**
- ✅ Image size < 250MB (stretch goal)
- ✅ Build time < 3 minutes
- ✅ Layer caching effective

---

### Task 6.2: Add Container Monitoring
**Goal:** Observability in production

**Tools:**
- Health check endpoint (already exists)
- Docker stats
- Log aggregation

**Acceptance Criteria:**
- ✅ Health check responds correctly
- ✅ Resource usage monitored
- ✅ Logs accessible and searchable

---

## Success Metrics

### Technical Metrics
- ✅ Zero linting errors
- ✅ Zero TypeScript errors
- ✅ All tests passing
- ✅ Docker image size < 300MB
- ✅ Build time < 3 minutes
- ✅ Container startup < 30 seconds
- ✅ Health check passing

### Quality Metrics
- ✅ Code follows project conventions
- ✅ Documentation complete and accurate
- ✅ No security vulnerabilities
- ✅ Proper error handling
- ✅ Comprehensive logging

### Deployment Metrics
- ✅ Zero-downtime deployment possible
- ✅ Rollback works reliably
- ✅ Automated backups running
- ✅ CI/CD pipeline green
- ✅ Production stable for 24 hours

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Docker build fails | Test locally first, keep PM2 fallback |
| Database corruption | Automated backups before each deploy |
| Container won't start | Health checks + auto-restart policy |
| Performance degradation | Resource limits + monitoring |
| Deployment downtime | Blue-green deployment strategy |
| CI/CD pipeline breaks | Branch protection + required checks |

---

## Rollback Strategy

If any phase fails:
1. **STOP** - Don't proceed to next phase
2. **ANALYZE** - Understand root cause
3. **FIX** - Resolve issue properly
4. **TEST** - Verify fix works
5. **DOCUMENT** - Update plan if needed
6. **CONTINUE** - Resume implementation

Emergency rollback:
```bash
# Stop Docker
docker compose down

# Restore database
cp db/backups/latest.db db/mega-sena.db

# Restart PM2
pm2 restart ecosystem.config.js

# Verify
curl http://localhost:3002
```

---

## Timeline

**Total Estimated Time:** 1 working day (8 hours)

- **Phase 1 (Bug Fixes):** 30 minutes
- **Phase 2 (Docker):** 2 hours
- **Phase 3 (Automation):** 2 hours
- **Phase 4 (Documentation):** 1.5 hours
- **Phase 5 (Testing):** 1.5 hours
- **Phase 6 (Optimization):** 30 minutes
- **Buffer:** 30 minutes

---

## Current Status

### Completed ✅
- [x] Fresh eyes code review
- [x] Identified critical bugs
- [x] Created comprehensive plan
- [x] Ready to execute

### In Progress 🚧
- [ ] Phase 1: Bug Fixes
- [ ] Phase 2: Docker Infrastructure
- [ ] Phase 3: Automation & CI/CD
- [ ] Phase 4: Documentation
- [ ] Phase 5: Testing & Validation
- [ ] Phase 6: Performance & Optimization

### Blocked ⛔
- None

---

## Notes for John Carmack Review

**Code Quality Focus:**
- Simple, clear, maintainable code
- No unnecessary abstractions
- Proper error handling everywhere
- Comprehensive logging
- Security best practices

**Engineering Principles:**
- Fail fast with clear errors
- Graceful degradation
- Defense in depth
- Measure everything
- Document decisions

**Testing Philosophy:**
- Test what matters
- Automate repetitive tests
- Manual testing for UX
- Load testing for performance
- Chaos testing for resilience

---

**Last Updated:** 2025-10-01
**Next Review:** After Phase 5 completion
**Sign-off Required:** After all phases complete
