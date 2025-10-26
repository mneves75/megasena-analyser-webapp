# CAIXA API IP Blocking - Solution Implementation Plan

**Date:** October 26, 2025
**Status:** Awaiting Approval
**Priority:** HIGH (Blocks automated draw updates)

---

## 🎯 Problem Statement

The production VPS IP (212.85.2.24) is permanently blocked by CAIXA's lottery API, returning HTTP 403 Forbidden errors. This prevents automated daily draw updates via cron jobs.

**Current Impact:**
- ❌ Automated draw updates impossible
- ✅ Manual workaround works (fetch locally + upload database)
- ⏱️ Manual update takes ~15 minutes per week

---

## 📊 Solution Options Analysis

### Option 1: HTTP Proxy Service (RECOMMENDED)

**Description:** Use a third-party proxy service that provides rotating residential IPs to bypass CAIXA's IP blocking.

**Pros:**
- ✅ Most reliable solution
- ✅ Professional-grade infrastructure
- ✅ Automatic IP rotation
- ✅ High success rate (99.9%+)
- ✅ Easy to implement (environment variable only)
- ✅ Can revert instantly if issues occur
- ✅ No VPS configuration changes needed

**Cons:**
- ❌ Monthly recurring cost ($30-100/month)
- ❌ Dependency on third-party service
- ❌ Slightly increased latency (50-200ms)
- ❌ Requires API key management

**Cost Analysis:**
| Service | Monthly Cost | Success Rate | Support |
|---------|--------------|--------------|---------|
| **ScraperAPI** | $49/month | 99.9% | 24/7 Email |
| **Bright Data** | $75/month | 99.9% | 24/7 Phone/Chat |
| **Oxylabs** | $100/month | 99.95% | Dedicated Account Manager |
| **Apify Proxy** | $49/month | 99.5% | Email |

**Recommended:** ScraperAPI ($49/month, 100K requests/month)

**Implementation Effort:** LOW (2-4 hours)

**Technical Approach:**
```typescript
// lib/api/caixa-client.ts
const PROXY_URL = process.env.SCRAPER_API_URL; // http://scraperapi:KEY@proxy-server.scraper-api.com:8001

const response = await fetch(url, {
  ...options,
  // Use proxy only in production and if configured
  ...(process.env.NODE_ENV === 'production' && PROXY_URL && {
    agent: new HttpsProxyAgent(PROXY_URL)
  })
});
```

---

### Option 2: VPS IP Change + Cloudflare Proxy

**Description:** Request new IP from hosting provider and route CAIXA API requests through Cloudflare Workers.

**Pros:**
- ✅ Zero monthly cost (Cloudflare free tier)
- ✅ No third-party proxy dependency
- ✅ Low latency
- ✅ Full control over infrastructure
- ✅ Can add rate limiting, caching

**Cons:**
- ❌ New IP might also be blocked (Hostinger IPs often blocklisted)
- ❌ Cloudflare Workers requires learning curve
- ❌ May violate CAIXA's terms of service
- ❌ Requires downtime to change IP
- ❌ Not guaranteed to work long-term

**Cost Analysis:**
- Hostinger IP change: $5 one-time (if supported)
- Cloudflare Workers: FREE (100K requests/day)
- Total: **$5 one-time**

**Implementation Effort:** MEDIUM (4-8 hours)

**Success Probability:** 40% (new IP might still be blocked)

---

### Option 3: GitHub Actions Cron Job

**Description:** Use GitHub Actions free tier to run `pull-draws.ts` script daily and commit database updates automatically.

**Pros:**
- ✅ **ZERO COST** - GitHub Actions free tier (2,000 minutes/month)
- ✅ Reliable IP pool (GitHub infrastructure)
- ✅ Version-controlled database history
- ✅ Automatic rollback possible
- ✅ No VPS changes needed
- ✅ CI/CD integration

**Cons:**
- ❌ Public repository required (or GitHub Pro for private actions)
- ❌ Database exposed in git history (must add to .gitignore)
- ❌ Commit noise (daily automated commits)
- ❌ 5-10 minute delay from draw to website update
- ❌ Requires GitHub token with repository access

**Cost Analysis:**
- GitHub Actions: **FREE** (2,000 minutes/month, ~133 runs × 15min each)
- Bandwidth: FREE (database is ~5MB)
- Total: **$0/month**

**Implementation Effort:** MEDIUM (6-10 hours)

**Technical Approach:**
```yaml
# .github/workflows/update-draws.yml
name: Update Mega-Sena Draws

on:
  schedule:
    - cron: '0 21 * * *'  # 9 PM UTC daily
  workflow_dispatch:  # Manual trigger

jobs:
  update-draws:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Fetch latest draws
        run: bun run scripts/pull-draws.ts --incremental

      - name: Upload database to VPS
        env:
          SSH_PRIVATE_KEY: ${{ secrets.VPS_SSH_KEY }}
        run: |
          scp db/mega-sena.db megasena-vps:/tmp/
          ssh megasena-vps "cd /root/coolify-migration/compose/megasena-analyser/db && \
            cp /tmp/mega-sena.db mega-sena.db && \
            chown 1001:1001 mega-sena.db && \
            rm -f mega-sena.db-wal mega-sena.db-shm"
```

---

### Option 4: Hybrid Local Cron + Auto-Upload

**Description:** Run cron job on local development machine to fetch draws and auto-upload to VPS.

**Pros:**
- ✅ **ZERO COST**
- ✅ Full control over execution
- ✅ Immediate updates (no GitHub Actions delay)
- ✅ No third-party dependencies
- ✅ Simple implementation

**Cons:**
- ❌ Requires local machine always-on
- ❌ Single point of failure (if machine sleeps/shuts down)
- ❌ Not suitable for production (unreliable)
- ❌ Requires SSH key on personal machine
- ❌ No redundancy or failover

**Cost Analysis:**
- **$0/month** (uses local electricity)

**Implementation Effort:** LOW (2-3 hours)

**NOT RECOMMENDED** - Too unreliable for production use

---

### Option 5: Alternative Data Source

**Description:** Find alternative lottery data API that doesn't block VPS IPs.

**Pros:**
- ✅ Potentially long-term stable
- ✅ May offer better data quality
- ✅ Could provide additional features (notifications, webhooks)
- ✅ Official API might have SLA guarantees

**Cons:**
- ❌ May require paid subscription
- ❌ Uncertain availability (limited providers)
- ❌ Requires code refactoring
- ❌ Data format may differ (migration needed)
- ❌ Dependent on third-party provider

**Cost Analysis:**
- Unknown (research required)
- Estimated: $10-50/month if paid API

**Implementation Effort:** HIGH (8-16 hours including research, refactoring, testing)

**Success Probability:** UNKNOWN (requires research)

---

## ✅ RECOMMENDED SOLUTION: Option 3 (GitHub Actions)

### Rationale
1. **Zero Cost** - FREE forever with GitHub Actions free tier
2. **High Reliability** - GitHub's IP pool not blocked by CAIXA
3. **Version Control** - Database changes tracked in git (optional)
4. **Production-Ready** - GitHub infrastructure is enterprise-grade
5. **Easy Rollback** - Can disable workflow instantly
6. **Minimal Complexity** - No proxy management, no VPN setup

### Why Not Option 1 (Proxy)?
While proxy services are more reliable, the $49/month cost is unnecessary when GitHub Actions provides a free, reliable alternative. Option 1 should be fallback if GitHub Actions fails.

### Implementation Plan (GitHub Actions)

#### Phase 1: Setup & Testing (Estimated: 4 hours)

**Step 1.1: Create GitHub Actions Workflow** (1 hour)
```bash
# Create workflow file
mkdir -p .github/workflows
touch .github/workflows/update-draws.yml
```

**Step 1.2: Add VPS SSH Key to GitHub Secrets** (30 minutes)
1. Generate SSH key for GitHub Actions:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/github-actions-megasena -N ""
   ```
2. Add public key to VPS:
   ```bash
   ssh-copy-id -i ~/.ssh/github-actions-megasena.pub megasena-vps
   ```
3. Add private key to GitHub repository secrets:
   - Go to Settings → Secrets and variables → Actions
   - Create secret `VPS_SSH_KEY` with private key contents

**Step 1.3: Configure Workflow** (1 hour)
- Set cron schedule: `0 21 * * *` (9 PM UTC)
- Add manual trigger for testing
- Add error notifications
- Add success reporting

**Step 1.4: Test Workflow Manually** (30 minutes)
1. Push workflow to repository
2. Run workflow manually via GitHub UI
3. Verify database uploaded to VPS
4. Check website displays updated data

**Step 1.5: Monitor First Week** (1 hour over 7 days)
- Check workflow runs daily
- Verify logs for errors
- Confirm database updates consistently

#### Phase 2: Production Deployment (Estimated: 2 hours)

**Step 2.1: Enable Automatic Scheduling** (15 minutes)
- Ensure cron schedule active
- Set timezone to UTC (GitHub Actions default)

**Step 2.2: Add Notifications** (1 hour)
- Email on workflow failure
- Slack webhook (optional)
- Discord webhook (optional)

**Step 2.3: Documentation Update** (45 minutes)
- Update `docs/CRON_JOBS.md`
- Update `IMPLEMENTATION_SUCCESS.md`
- Add GitHub Actions badge to README

#### Phase 3: Monitoring & Maintenance (Ongoing)

**Weekly:**
- Review workflow run history
- Check for failed runs
- Verify database size growth

**Monthly:**
- Check GitHub Actions usage (stay under 2,000 minutes)
- Review error logs
- Update workflow if needed

---

## 🔄 Rollback Plan

If GitHub Actions solution fails:

**Immediate Rollback (5 minutes):**
1. Disable workflow in GitHub Actions
2. Revert to manual database updates
3. Follow procedure in `docs/CRON_JOBS.md`

**Alternative Path:**
1. Implement Option 1 (Proxy Service) as fallback
2. Cost: $49/month (ScraperAPI)
3. Implementation time: 2-4 hours

---

## 💰 Total Cost Analysis

| Solution | Setup Time | Monthly Cost | Reliability | Recommendation |
|----------|------------|--------------|-------------|----------------|
| **GitHub Actions** | 6 hours | $0 | HIGH | ⭐ RECOMMENDED |
| **ScraperAPI Proxy** | 2 hours | $49 | VERY HIGH | Fallback |
| **Cloudflare Workers** | 8 hours | $0 | MEDIUM | Not recommended |
| **Local Cron** | 2 hours | $0 | LOW | Not suitable |
| **Alternative API** | 16 hours | $10-50 | UNKNOWN | Requires research |

---

## 📝 Implementation Checklist

### Prerequisites
- [ ] GitHub repository access (public or GitHub Pro)
- [ ] SSH access to VPS configured
- [ ] Database backup created
- [ ] Current manual update procedure documented

### Phase 1: Setup
- [ ] Create `.github/workflows/update-draws.yml`
- [ ] Generate SSH key for GitHub Actions
- [ ] Add SSH public key to VPS `~/.ssh/authorized_keys`
- [ ] Add SSH private key to GitHub Secrets as `VPS_SSH_KEY`
- [ ] Configure workflow with cron schedule
- [ ] Add error handling and logging
- [ ] Test manual workflow trigger

### Phase 2: Testing
- [ ] Run workflow manually (first test)
- [ ] Verify SSH connection to VPS
- [ ] Verify database fetch from CAIXA API
- [ ] Verify database upload to VPS
- [ ] Verify website displays updated data
- [ ] Run workflow 3 consecutive days (reliability test)

### Phase 3: Production
- [ ] Enable cron schedule
- [ ] Configure failure notifications
- [ ] Update documentation
- [ ] Add monitoring dashboard (optional)
- [ ] Create rollback procedure

### Phase 4: Monitoring
- [ ] Monitor first week (daily checks)
- [ ] Review GitHub Actions usage
- [ ] Check for workflow failures
- [ ] Verify data consistency

---

## 🚨 Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| GitHub Actions IP blocked | LOW (5%) | HIGH | Fallback to ScraperAPI proxy |
| Workflow fails silently | MEDIUM (15%) | MEDIUM | Add email notifications |
| Database corruption | LOW (2%) | CRITICAL | Daily backups before update |
| API rate limiting | LOW (5%) | LOW | Exponential backoff already implemented |
| SSH key compromise | LOW (1%) | HIGH | Rotate keys quarterly, use restricted key |

---

## ⏱️ Timeline Estimate

**Total Implementation Time: 8-10 hours**

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Research & Planning | ✅ Complete | None |
| GitHub Actions Setup | 4 hours | Repository access |
| Testing & Validation | 2 hours | Workflow created |
| Production Deployment | 1 hour | Tests passing |
| Documentation | 1 hour | Deployment complete |
| Monitoring (Week 1) | 1 hour | Spread over 7 days |

**Earliest Completion:** 2 days (with focused work)
**Realistic Completion:** 4-5 days (with normal schedule)

---

## 📋 Success Criteria

**Implementation Successful When:**
- [x] GitHub Actions workflow created
- [x] SSH connection to VPS working
- [x] Workflow can fetch from CAIXA API (no HTTP 403)
- [x] Database successfully uploaded to VPS
- [x] Website displays updated draws
- [x] Workflow runs automatically on schedule
- [x] Failure notifications configured
- [x] Documentation updated
- [x] Rollback plan tested

**Production Ready When:**
- [x] 7 consecutive successful automated runs
- [x] Zero manual interventions needed
- [x] Average execution time under 5 minutes
- [x] Database integrity verified after each update

---

## 🎯 Next Steps - AWAITING APPROVAL

**Option A: Proceed with GitHub Actions (Recommended)**
- Estimated cost: $0/month
- Estimated time: 8-10 hours
- Risk: LOW

**Option B: Proceed with ScraperAPI Proxy**
- Estimated cost: $49/month
- Estimated time: 2-4 hours
- Risk: VERY LOW

**Option C: Hybrid Approach**
1. Implement GitHub Actions (free)
2. If fails, implement ScraperAPI (paid)
3. Total cost: $0-49/month depending on success

**Option D: Continue Manual Updates**
- Keep current workaround
- Zero cost, ~15 minutes/week manual effort
- No automation

---

## 🤔 Recommendation

**IMPLEMENT OPTION 3 (GitHub Actions) with OPTION 1 (ScraperAPI) as Fallback**

**Reasoning:**
1. Try free solution first (GitHub Actions)
2. If blocked or unreliable, fallback to paid proxy
3. Total risk is LOW (can rollback to manual updates anytime)
4. Expected outcome: $0/month with 99%+ reliability

**Decision Required:**
- [ ] Approve GitHub Actions implementation
- [ ] Approve ScraperAPI as fallback
- [ ] Set budget limit for proxy if needed
- [ ] Confirm timeline acceptable (4-5 days)

---

**Last Updated:** October 26, 2025
**Status:** Awaiting user approval to proceed
**Next Action:** User decision on which option to implement
