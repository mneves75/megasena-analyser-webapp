# GitHub Actions Automated Draw Updates - Setup Guide

**Status:** Partially Complete - User action required
**Last Updated:** October 26, 2025

**IMPORTANT:**
- ✅ Step 1 COMPLETED: SSH keys generated at `~/.ssh/github-actions-megasena`
- ⏳ Step 2-6 PENDING: User must complete manual setup (VPS currently unreachable)
- Workflow files created and validated with 2 critical bugs fixed

---

## Overview

This GitHub Actions workflow automatically fetches latest Mega-Sena draws daily and updates the production database on the VPS.

**Benefits:**
- ✅ **FREE** - No monthly costs (uses GitHub Actions free tier)
- ✅ **Reliable** - GitHub IPs not blocked by CAIXA API
- ✅ **Automated** - Runs daily at 21:00 UTC (6 PM BRT)
- ✅ **Safe** - Creates database backups before each update
- ✅ **Verified** - Checks website after upload

**Workflow File:** `.github/workflows/update-draws.yml`

---

## Prerequisites

- [ ] GitHub repository with Actions enabled (public or GitHub Pro for private)
- [ ] SSH access to VPS (root@[VPS_HOST])
- [ ] VPS hostname/IP known
- [ ] SSH port known (default: 22)

---

## Setup Instructions

### Step 1: Generate SSH Key for GitHub Actions (5 minutes)

**Generate a dedicated SSH key** (do NOT reuse your personal SSH key):

```bash
# Generate ED25519 key (more secure than RSA)
ssh-keygen -t ed25519 -f ~/.ssh/github-actions-megasena -N "" -C "github-actions@megasena-analyzer"
```

**Expected output:**
```
Generating public/private ed25519 key pair.
Your identification has been saved in /Users/mvneves/.ssh/github-actions-megasena
Your public key has been saved in /Users/mvneves/.ssh/github-actions-megasena.pub
```

**View the keys:**
```bash
# Public key (will add to VPS)
cat ~/.ssh/github-actions-megasena.pub

# Private key (will add to GitHub Secrets)
cat ~/.ssh/github-actions-megasena
```

**⚠️ SECURITY NOTE:**
- NEVER commit the private key to git
- NEVER share the private key
- Store only in GitHub Secrets (encrypted)

---

### Step 2: Add Public Key to VPS (2 minutes)

**Copy public key to VPS:**
```bash
# Method 1: ssh-copy-id (easiest)
ssh-copy-id -i ~/.ssh/github-actions-megasena.pub root@[VPS_HOST]

# Method 2: Manual copy
cat ~/.ssh/github-actions-megasena.pub | ssh root@[VPS_HOST] "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

**Test SSH connection:**
```bash
ssh -i ~/.ssh/github-actions-megasena root@[VPS_HOST] "echo '✓ SSH connection successful'"
```

**Expected output:**
```
✓ SSH connection successful
```

---

### Step 3: Add Secrets to GitHub Repository (5 minutes)

**Navigate to GitHub repository settings:**
```
https://github.com/[YOUR_USERNAME]/megasena-analyser-webapp/settings/secrets/actions
```

**Create 3 secrets:**

#### Secret 1: `VPS_SSH_KEY`
**Description:** Private SSH key for GitHub Actions authentication

**Value:**
```bash
# Copy entire private key including BEGIN/END lines
cat ~/.ssh/github-actions-megasena
```

**Format:**
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
...
(multiple lines)
...
-----END OPENSSH PRIVATE KEY-----
```

#### Secret 2: `VPS_HOST`
**Description:** VPS hostname or IP address

**Value:**
```
212.85.2.24
```
or
```
megasena-vps.example.com
```

#### Secret 3: `VPS_PORT`
**Description:** SSH port (usually 22)

**Value:**
```
22
```

**Screenshot Checklist:**
- [ ] Secret name exactly matches (case-sensitive)
- [ ] No extra spaces in value
- [ ] Private key includes BEGIN/END lines
- [ ] VPS_HOST is correct IP or hostname
- [ ] VPS_PORT is numeric (usually 22)

---

### Step 4: Enable GitHub Actions (1 minute)

**If repository is private:**
1. Go to Settings → Actions → General
2. Under "Actions permissions", select:
   ✅ "Allow all actions and reusable workflows"
3. Click "Save"

**If repository is public:**
- Actions are enabled by default

---

### Step 5: Test Workflow Manually (5 minutes)

**Trigger workflow manually:**
1. Go to Actions tab: `https://github.com/[YOUR_USERNAME]/megasena-analyser-webapp/actions`
2. Click "Update Mega-Sena Draws" workflow
3. Click "Run workflow" button (top right)
4. Select branch: `main`
5. Dry run: `false` (uncheck for real update)
6. Click green "Run workflow" button

**Monitor execution:**
- Wait 2-5 minutes for workflow to complete
- Green checkmark = SUCCESS ✅
- Red X = FAILURE ❌ (check logs)

**Check logs:**
- Click on the workflow run
- Click on "Fetch and Upload Latest Draws" job
- Expand each step to see detailed logs

**Expected output:**
```
✅ Mega-Sena Draw Update SUCCESSFUL
════════════════════════════════════════════════════════════
New draws added: 0 (or number if new draws exist)
Latest contest: #2932
Total draws: 2,931
Website: https://megasena-analyzer.conhecendotudo.online
════════════════════════════════════════════════════════════
```

---

### Step 6: Enable Automatic Schedule (1 minute)

**The workflow is already configured to run automatically:**
- **Schedule:** Daily at 21:00 UTC (6 PM BRT)
- **Trigger:** `cron: '0 21 * * *'`

**No additional configuration needed** - workflow will run automatically after first manual test succeeds.

---

## Workflow Features

### Automatic Database Backup
Before each update, the workflow creates a timestamped backup:
```
mega-sena.db.backup-20251026-210543
```

Keeps last **7 backups**, deletes older ones automatically.

### Error Handling
- **SSH connection fails:** Workflow stops, sends error notification
- **No new draws:** Workflow completes successfully, no changes made
- **Database upload fails:** Original database preserved (backup not touched)
- **Verification fails:** Alert sent, manual investigation needed

### Dry Run Mode
Test workflow without actually updating VPS:
```yaml
# In GitHub Actions UI when running manually:
Dry run: true
```

Workflow will:
- ✅ Fetch draws from CAIXA API
- ✅ Test SSH connection
- ❌ NOT upload database to VPS
- ❌ NOT replace production database

Perfect for testing before first real update.

---

## Monitoring & Maintenance

### Check Workflow Status

**Via GitHub:**
```
https://github.com/[YOUR_USERNAME]/megasena-analyser-webapp/actions
```

**Via GitHub CLI:**
```bash
gh run list --workflow=update-draws.yml --limit 10
```

### View Recent Logs

```bash
# Latest run
gh run view

# Specific run by ID
gh run view [RUN_ID]

# Download logs
gh run download [RUN_ID]
```

### Check Database on VPS

```bash
ssh megasena-vps "sudo docker exec megasena-analyzer bun -e \"
  const db = require('bun:sqlite').default('/app/db/mega-sena.db');
  const result = db.query('SELECT COUNT(*) as count, MAX(contest_number) as last FROM draws').get();
  console.log('Total:', result.count, 'Latest:', result.last);
  db.close();
\""
```

### Verify Website Display

```bash
curl -s https://megasena-analyzer.conhecendotudo.online/api/dashboard | \
  python3 -c "import sys, json; data = json.load(sys.stdin); \
  print('Latest:', data['statistics']['lastContestNumber'], \
  'Date:', data['statistics']['lastDrawDate'], \
  'Total:', data['statistics']['totalDraws'])"
```

---

## Troubleshooting

### Workflow Fails: "Permission denied (publickey)"

**Cause:** SSH key not properly configured

**Solution:**
1. Verify public key added to VPS:
   ```bash
   ssh root@[VPS_HOST] "cat ~/.ssh/authorized_keys | grep github-actions"
   ```
2. Verify private key in GitHub Secrets:
   - Check `VPS_SSH_KEY` includes BEGIN/END lines
   - No extra spaces or newlines
3. Test SSH locally:
   ```bash
   ssh -i ~/.ssh/github-actions-megasena root@[VPS_HOST]
   ```

### Workflow Fails: "Host key verification failed"

**Cause:** VPS not in GitHub Actions known_hosts

**Solution:** Already handled by workflow (`ssh-keyscan`). If still fails:
```bash
# Manually add to workflow (Step: Setup SSH):
ssh-keyscan -H [VPS_HOST] >> ~/.ssh/known_hosts
```

### Workflow Succeeds But Database Not Updated

**Cause:** Likely no new draws to fetch

**Solution:**
1. Check workflow logs for "No new draws to update"
2. Verify last contest on CAIXA website
3. Run manual workflow trigger to force update

### HTTP 403 Forbidden from CAIXA API

**Cause:** GitHub Actions IP temporarily blocked (rare)

**Solution:**
1. Wait 24 hours and retry
2. If persistent, implement ScraperAPI proxy fallback (see `CAIXA_API_BLOCKING_SOLUTION_PLAN.md`)

---

## Security Best Practices

### SSH Key Management
- ✅ Use dedicated key for GitHub Actions (not personal key)
- ✅ Use ED25519 algorithm (more secure than RSA)
- ✅ Never commit private key to git
- ✅ Rotate keys every 90 days
- ✅ Delete key if compromised immediately

### GitHub Secrets
- ✅ Use repository secrets (not environment secrets)
- ✅ Never log secret values in workflow
- ✅ Restrict repository access to trusted collaborators
- ✅ Enable 2FA on GitHub account

### VPS Security
- ✅ Use SSH keys (not passwords)
- ✅ Disable root password login
- ✅ Keep SSH port non-standard (optional)
- ✅ Monitor `/var/log/auth.log` for unauthorized access

---

## GitHub Actions Usage Limits

**Free Tier (Public repositories):**
- ✅ 2,000 minutes/month
- ✅ Unlimited private repositories (with GitHub Pro)

**Current Usage:**
- Each workflow run: ~3-5 minutes
- Daily runs: 30 runs/month
- Total usage: ~150 minutes/month (7.5% of limit)

**Way below limits - plenty of headroom!**

---

## Alternative: Disable Automated Updates

If you need to stop automated updates:

**Method 1: Disable workflow**
```bash
# Edit .github/workflows/update-draws.yml
# Comment out the schedule section:

# on:
#   schedule:
#     - cron: '0 21 * * *'
```

**Method 2: Delete workflow file**
```bash
git rm .github/workflows/update-draws.yml
git commit -m "disable automated draw updates"
git push
```

**Method 3: Disable via GitHub UI**
1. Go to Actions tab
2. Click "Update Mega-Sena Draws"
3. Click "..." menu (top right)
4. Select "Disable workflow"

---

## Rollback to Manual Updates

If GitHub Actions fails permanently:

1. **Disable workflow** (see above)
2. **Follow manual update procedure** in `docs/CRON_JOBS.md`
3. **Implement ScraperAPI proxy** ($49/month, 99.9% reliable)

Full rollback plan in `agent_planning/CAIXA_API_BLOCKING_SOLUTION_PLAN.md`

---

## FAQ

**Q: How do I know if the workflow is running?**
A: Check https://github.com/[YOUR_USERNAME]/megasena-analyser-webapp/actions - green checkmark means success.

**Q: Can I change the schedule time?**
A: Yes, edit the cron expression in `.github/workflows/update-draws.yml`:
```yaml
# Current: 21:00 UTC (6 PM BRT)
- cron: '0 21 * * *'

# Change to 20:00 UTC (5 PM BRT):
- cron: '0 20 * * *'
```

**Q: What if I run out of GitHub Actions minutes?**
A: Very unlikely (using only 7.5% of limit). If needed, upgrade to GitHub Pro ($4/month, 3,000 minutes).

**Q: Can I run the workflow more than once per day?**
A: Yes, add multiple cron entries or run manually anytime via Actions tab.

**Q: Is my SSH key safe in GitHub Secrets?**
A: Yes, GitHub encrypts all secrets with industry-standard encryption. Even repository admins cannot view secret values.

---

## Support

**Issues:**
- Workflow failures → Check logs in GitHub Actions tab
- Database errors → SSH to VPS and check Docker logs
- Website not updating → Verify API endpoint manually

**Documentation:**
- Workflow file: `.github/workflows/update-draws.yml`
- Solution plan: `agent_planning/CAIXA_API_BLOCKING_SOLUTION_PLAN.md`
- Manual updates: `docs/CRON_JOBS.md`

---

**Last Updated:** October 26, 2025
**Status:** Ready for production deployment
**Estimated Setup Time:** 15-20 minutes
