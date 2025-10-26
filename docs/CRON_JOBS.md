# Cron Jobs Configuration

## ⚠️ CRITICAL WARNING: CAIXA API IP BLOCKING

**The VPS IP (212.85.2.24) is BLOCKED by CAIXA API, returning HTTP 403 Forbidden.**

**Impact:**
- ❌ Daily draw updates cron job WILL FAIL
- ✅ Weekly database optimization works fine (local only)

**Current Solution:** Manual database updates (see `IMPLEMENTATION_SUCCESS.md` for procedure)

**See Section:** "CAIXA API IP Blocking Issue" at bottom of this document

---

## Configured Cron Jobs

### 1. Daily Draw Updates (9 PM every day) ⚠️ NOT WORKING - API BLOCKED

```bash
# ⚠️ THIS WILL FAIL WITH HTTP 403 ERRORS
# DO NOT ENABLE UNTIL PROXY/VPN SOLUTION IMPLEMENTED
# 0 21 * * * docker exec megasena-analyzer bun run scripts/pull-draws.ts --incremental >> /var/log/megasena/daily-update.log 2>&1
```

- **Schedule**: Would run at 21:00 (9 PM) UTC daily
- **Mode**: Uses `--incremental` flag to only add new draws (INSERT OR IGNORE)
- **Logs**: `/var/log/megasena/daily-update.log`
- **Status**: ❌ DISABLED - VPS IP blocked by CAIXA API (HTTP 403)
- **Alternative**: Manual database update procedure (see below)

### 2. Weekly Database Optimization (Sunday 2 AM)

```bash
0 2 * * 0 docker exec megasena-analyzer bun run scripts/optimize-db.ts >> /var/log/megasena/weekly-optimize.log 2>&1
```

- **Schedule**: Runs at 02:00 (2 AM) UTC every Sunday
- **Operations**: Performs WAL checkpoint, VACUUM, and ANALYZE operations
- **Logs**: `/var/log/megasena/weekly-optimize.log`

## How to Monitor Cron Jobs

### View configured cron jobs

```bash
ssh megasena-vps "crontab -l | grep megasena"
```

### Check daily update logs

```bash
ssh megasena-vps "tail -f /var/log/megasena/daily-update.log"
```

### Check weekly optimization logs

```bash
ssh megasena-vps "tail -f /var/log/megasena/weekly-optimize.log"
```

## Manual Testing

### Test daily update manually

```bash
ssh megasena-vps "docker exec megasena-analyzer bun run scripts/pull-draws.ts --incremental"
```

### Test weekly optimization manually

```bash
ssh megasena-vps "docker exec megasena-analyzer bun run scripts/optimize-db.ts"
```

## Timezone Note

The cron jobs use UTC timezone. Brazil (BRT = UTC-3):
- **9 PM BRT** = 00:00 UTC (next day)
- **2 AM BRT** = 05:00 UTC

To adjust cron times for Brazil time:
- For 9 PM BRT: Use `0 0 * * *` (midnight UTC)
- For 2 AM BRT Sunday: Use `0 5 * * 0` (5 AM UTC Sunday)

---

## 🚨 CAIXA API IP Blocking Issue

### Problem Summary
The production VPS IP address (212.85.2.24) is permanently blocked by CAIXA's lottery API, returning HTTP 403 Forbidden errors on all draw fetch requests.

### Evidence
```bash
# Local machine (works):
curl https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena
→ HTTP 200 OK ✅

# VPS (blocked):
curl https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena
→ HTTP 403 Forbidden ❌
```

### Root Cause
CAIXA implements IP-based anti-scraping protection. VPS/cloud provider IPs are often blocklisted to prevent automated scraping.

### Impact on Automation
- ❌ **Daily draw updates:** CANNOT run automatically from VPS
- ✅ **Weekly optimization:** Works fine (local database only)

### Current Workaround: Manual Database Updates

**Frequency:** Perform weekly or when new draws are published

**Procedure:**

1. **Check for new draws:**
   ```bash
   # Visit CAIXA website to see latest contest number
   open https://loterias.caixa.gov.br/
   ```

2. **Fetch locally (where API works):**
   ```bash
   cd /Users/mvneves/dev/PROJETOS/megasena-analyser-webapp

   # Example: Fetch draws 2933-2940 (adjust numbers as needed)
   bun run scripts/pull-draws.ts --start 2933 --end 2940

   # Or fetch all new draws incrementally:
   bun run scripts/pull-draws.ts --incremental
   ```

3. **Upload database to VPS:**
   ```bash
   scp db/mega-sena.db megasena-vps:/tmp/mega-sena.db
   ```

4. **Replace database on VPS:**
   ```bash
   ssh megasena-vps

   cd /root/coolify-migration/compose/megasena-analyser/db

   # Backup current database
   cp mega-sena.db mega-sena.db.backup-$(date +%Y%m%d)

   # Replace with updated database
   cp /tmp/mega-sena.db mega-sena.db

   # Fix permissions (container user UID 1001)
   chown 1001:1001 mega-sena.db

   # Remove WAL/SHM files (force clean state)
   rm -f mega-sena.db-wal mega-sena.db-shm

   # Cleanup
   rm /tmp/mega-sena.db
   ```

5. **Verify update:**
   ```bash
   # Check database in container
   sudo docker exec megasena-analyzer bun -e "
   const db = require('bun:sqlite').default('/app/db/mega-sena.db');
   const result = db.query('SELECT COUNT(*) as count, MAX(contest_number) as last FROM draws').get();
   console.log(JSON.stringify(result, null, 2));
   db.close();
   "

   # Check public website
   curl -s https://megasena-analyzer.conhecendotudo.online/api/dashboard | \
     python3 -c "import sys, json; data = json.load(sys.stdin); \
     print('Latest:', data['statistics']['lastContestNumber'], \
     'Date:', data['statistics']['lastDrawDate'])"
   ```

### Long-Term Solution: GitHub Actions (IMPLEMENTED)

**Status:** ✅ **READY FOR DEPLOYMENT**

**Solution:** GitHub Actions workflow automatically fetches draws daily and uploads to VPS.

**Setup Instructions:** See `docs/GITHUB_ACTIONS_SETUP.md`

**Benefits:**
- ✅ **FREE** - No monthly costs (GitHub Actions free tier)
- ✅ **Reliable** - GitHub IPs not blocked by CAIXA
- ✅ **Automated** - Runs daily at 21:00 UTC
- ✅ **Safe** - Creates backups before each update

**Files:**
- Workflow: `.github/workflows/update-draws.yml`
- Setup guide: `docs/GITHUB_ACTIONS_SETUP.md`
- Solution plan: `agent_planning/CAIXA_API_BLOCKING_SOLUTION_PLAN.md`

**Alternative Solutions (Fallback):**
1. **Proxy Service** ($49/month, 99.9% reliable)
2. **VPN with IP Rotation** (less reliable)
3. **Manual Updates** (current workaround, zero cost)
4. **Alternative Data Source** (requires research)

### Update History

| Date | Contests Added | Latest Contest | Total Draws | Method |
|------|----------------|----------------|-------------|--------|
| 2025-10-26 | 2922-2932 (11) | #2932 (25/10/2025) | 2,931 | Manual local fetch + SCP |

---

**For complete documentation, see:** `IMPLEMENTATION_SUCCESS.md` section "CRITICAL: CAIXA API IP BLOCKING ISSUE"
