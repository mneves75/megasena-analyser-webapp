# 🔐 SSH Security Guide - Mega-Sena Analyser

**Purpose:** Secure authentication and deployment using SSH keys
**Status:** ✅ ACTIVE (password authentication removed)
**Last Updated:** 2025-10-01

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [SSH Key Configuration](#ssh-key-configuration)
3. [Daily Usage](#daily-usage)
4. [Security Best Practices](#security-best-practices)
5. [Troubleshooting](#troubleshooting)
6. [Maintenance](#maintenance)
7. [Emergency Procedures](#emergency-procedures)

---

## Overview

### Why SSH Keys?

SSH keys provide **cryptographic authentication** without exposing passwords:

- **No password transmission** over network
- **Stronger security** than passwords (2048-4096 bit keys)
- **Automation-friendly** for deployment scripts
- **Auditable** via server logs (which key accessed when)
- **Revocable** without changing passwords

### Current Configuration

| Component | Value |
|-----------|-------|
| **Key Type** | Ed25519 (256-bit, equivalent to RSA 3072-bit) |
| **Private Key** | `~/.ssh/id_megasena_vps` |
| **Public Key** | `~/.ssh/id_megasena_vps.pub` |
| **SSH Config Alias** | `megasena-vps` |
| **Server** | claude@212.85.2.24 |
| **Fingerprint** | `SHA256:OwfEGIYXRYTB6BYqO7qb7fWEx77HN0AWH0xp9cSqLu4` |

---

## SSH Key Configuration

### Local Setup (Already Completed)

The SSH environment is configured with:

**1. SSH Key Pair**
```bash
~/.ssh/id_megasena_vps       # Private key (600 permissions)
~/.ssh/id_megasena_vps.pub   # Public key (644 permissions)
```

**2. SSH Config** (`~/.ssh/config`)
```ssh-config
# Mega-Sena Analyser VPS
Host megasena-vps
    HostName 212.85.2.24
    User claude
    IdentityFile ~/.ssh/id_megasena_vps
    IdentitiesOnly yes
    AddKeysToAgent yes
    ForwardAgent no
```

**What each directive means:**
- `IdentityFile`: Path to private key for this host
- `IdentitiesOnly yes`: Only use specified key (not all keys in ~/.ssh)
- `AddKeysToAgent yes`: Add key to ssh-agent for session reuse
- `ForwardAgent no`: Don't forward authentication (security)

### Server Setup (Requires Manual Installation)

**Public key must be installed on VPS:**

```bash
# Option 1: Using ssh-copy-id
ssh-copy-id -i ~/.ssh/id_megasena_vps.pub claude@212.85.2.24

# Option 2: Manual installation
cat ~/.ssh/id_megasena_vps.pub | ssh claude@212.85.2.24 \
  "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

# Option 3: Via helper script
bash scripts/install-ssh-key.sh
```

**Verify installation:**
```bash
ssh megasena-vps "echo 'SSH key working!'"
# Should connect WITHOUT password prompt
```

---

## Daily Usage

### Connecting to VPS

**Method 1: Using alias (recommended)**
```bash
ssh megasena-vps
```

**Method 2: Using key directly**
```bash
ssh -i ~/.ssh/id_megasena_vps claude@212.85.2.24
```

**Method 3: Standard SSH (if config is set)**
```bash
ssh claude@212.85.2.24
# Will use configured key automatically
```

### Running Remote Commands

```bash
# Single command
ssh megasena-vps "pm2 status"

# Multiple commands
ssh megasena-vps "cd /home/claude/apps/megasena-analyser && pm2 logs --lines 50"

# Interactive session
ssh megasena-vps
# Now you're on the server
```

### Deployment

The deploy script (`scripts/deploy.sh`) now uses SSH keys automatically:

```bash
# Full deployment
bash scripts/deploy.sh

# Skip build (use existing)
bash scripts/deploy.sh --skip-build

# Dry run (test without executing)
bash scripts/deploy.sh --dry-run
```

### File Transfer

**Using rsync (preferred)**
```bash
# Upload files
rsync -avz -e "ssh -i ~/.ssh/id_megasena_vps" \
  ./local-file.txt claude@212.85.2.24:/home/claude/

# Download files
rsync -avz -e "ssh -i ~/.ssh/id_megasena_vps" \
  claude@212.85.2.24:/home/claude/remote-file.txt ./
```

**Using scp**
```bash
# Upload
scp -i ~/.ssh/id_megasena_vps ./file.txt claude@212.85.2.24:/home/claude/

# Download
scp -i ~/.ssh/id_megasena_vps claude@212.85.2.24:/home/claude/file.txt ./
```

---

## Security Best Practices

### 🔒 Key Protection

**DO:**
- ✅ Keep private key (`id_megasena_vps`) on your local machine ONLY
- ✅ Set correct permissions: `chmod 600 ~/.ssh/id_megasena_vps`
- ✅ Never commit private keys to Git
- ✅ Backup private key to secure location (encrypted external drive, password manager)
- ✅ Use different keys for different servers/projects

**DON'T:**
- ❌ Never share private key via email, Slack, cloud storage
- ❌ Never upload private key to servers
- ❌ Never commit to GitHub/GitLab
- ❌ Never store in unencrypted backups

### 🔐 Passphrase Protection

**Current setup:** Key was generated without passphrase for automation

**To add passphrase later (recommended for production):**
```bash
ssh-keygen -p -f ~/.ssh/id_megasena_vps
# Enter new passphrase when prompted
```

**Trade-offs:**
- ✅ **With passphrase:** Extra protection if laptop stolen
- ❌ **With passphrase:** Must type passphrase each use (or use ssh-agent)
- ✅ **Without passphrase:** Automated deployment scripts work
- ❌ **Without passphrase:** Key alone grants access if stolen

**Recommendation:** Use ssh-agent for best of both worlds:
```bash
# Start ssh-agent
eval "$(ssh-agent -s)"

# Add key (enter passphrase once)
ssh-add ~/.ssh/id_megasena_vps

# Future SSH commands won't prompt for passphrase this session
```

### 🛡️ Server Hardening (Optional)

**After SSH keys are working, consider:**

**1. Disable password authentication**
```bash
# On VPS (ONLY after confirming SSH key works!)
sudo nano /etc/ssh/sshd_config

# Change:
PasswordAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes

# Restart SSH
sudo systemctl restart sshd
```

**⚠️ WARNING:** Do this ONLY after verifying SSH key access works perfectly!

**2. Install Fail2Ban (rate limiting)**
```bash
# On VPS
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

**3. Change SSH port (obscurity layer)**
```bash
# On VPS
sudo nano /etc/ssh/sshd_config

# Change Port 22 to Port 2222 (or other)
# Then update local ~/.ssh/config:
# Port 2222

sudo systemctl restart sshd
```

---

## Troubleshooting

### Problem: "Permission denied (publickey)"

**Cause:** SSH key not installed on server or permissions incorrect

**Solutions:**

**1. Verify key is installed on server:**
```bash
ssh claude@212.85.2.24 "cat ~/.ssh/authorized_keys | grep 'megasena-deploy'"
# Should show your public key
```

**2. Check key permissions locally:**
```bash
ls -la ~/.ssh/id_megasena_vps
# Should be: -rw------- (600)

# Fix if needed:
chmod 600 ~/.ssh/id_megasena_vps
chmod 644 ~/.ssh/id_megasena_vps.pub
chmod 700 ~/.ssh
```

**3. Check server-side permissions:**
```bash
ssh claude@212.85.2.24 "ls -la ~/.ssh/"
# ~/.ssh should be 700 (drwx------)
# ~/.ssh/authorized_keys should be 600 (-rw-------)

# Fix if needed:
ssh claude@212.85.2.24 "chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

**4. Verify SSH server accepts publickey auth:**
```bash
ssh -v claude@212.85.2.24
# Look for:
# debug1: Offering public key: /Users/you/.ssh/id_megasena_vps
# debug1: Server accepts key
```

---

### Problem: "Too many authentication failures"

**Cause:** ssh-agent has too many keys loaded

**Solution:** Use `IdentitiesOnly`
```bash
# Temporary fix
ssh -o IdentitiesOnly=yes -i ~/.ssh/id_megasena_vps claude@212.85.2.24

# Permanent fix: Add to ~/.ssh/config (already done!)
Host megasena-vps
    IdentitiesOnly yes
```

---

### Problem: "WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!"

**Cause:** Server SSH fingerprint changed (server reinstalled or MITM attack)

**Safe scenario:** You reinstalled the VPS
```bash
# Remove old fingerprint
ssh-keygen -R 212.85.2.24

# Connect again (will ask to verify new fingerprint)
ssh megasena-vps
```

**Unsafe scenario:** You didn't change anything
```
⚠️ SECURITY WARNING: Possible man-in-the-middle attack!
DO NOT CONNECT until you verify with hosting provider.
```

---

### Problem: "Connection timed out"

**Causes:**
1. Server is offline
2. Firewall blocking port 22
3. Network issue

**Diagnostics:**
```bash
# Test if server is reachable
ping 212.85.2.24

# Test if SSH port is open
nc -zv 212.85.2.24 22

# Try with verbose output
ssh -vvv megasena-vps
```

---

### Problem: Deploy script asks for password

**Cause:** Script is still using old sshpass method

**Solution:** Ensure `scripts/deploy.sh` has been updated:
```bash
# Check script content
grep "SSH_KEY" scripts/deploy.sh
# Should show: SSH_KEY="$HOME/.ssh/id_megasena_vps"

# Should NOT show:
grep "SSH_PASSWORD" scripts/deploy.sh
# (should return nothing)
```

---

## Maintenance

### Key Rotation (Recommended: Every 1-2 years)

**Why?** Limits exposure window if key is compromised

**Procedure:**

**1. Generate new key pair**
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_megasena_vps_new -C "megasena-deploy-$(date +%Y)"
```

**2. Install new key on server**
```bash
ssh-copy-id -i ~/.ssh/id_megasena_vps_new.pub claude@212.85.2.24
```

**3. Test new key**
```bash
ssh -i ~/.ssh/id_megasena_vps_new claude@212.85.2.24 "echo 'New key works!'"
```

**4. Update config**
```bash
# Update ~/.ssh/config
# Change IdentityFile to: ~/.ssh/id_megasena_vps_new

# Update scripts/deploy.sh
# Change SSH_KEY to: $HOME/.ssh/id_megasena_vps_new
```

**5. Remove old key from server**
```bash
ssh megasena-vps
nano ~/.ssh/authorized_keys
# Delete the old key line
```

**6. Archive old key**
```bash
mkdir -p ~/.ssh/archive
mv ~/.ssh/id_megasena_vps* ~/.ssh/archive/
```

---

### Backup Strategy

**What to backup:**
- ✅ Private key: `~/.ssh/id_megasena_vps`
- ✅ SSH config: `~/.ssh/config`
- ✅ Public key fingerprint (for verification)

**Where to backup:**
1. **Encrypted external drive** (recommended)
2. **Password manager** (1Password, Bitwarden, etc.)
3. **Encrypted cloud storage** (with strong encryption)

**How to backup:**
```bash
# Create encrypted backup
tar -czf ~/ssh-backup-$(date +%Y%m%d).tar.gz ~/.ssh/id_megasena_vps*
gpg -c ~/ssh-backup-*.tar.gz  # Enter passphrase
rm ~/ssh-backup-*.tar.gz      # Keep only .gpg encrypted file

# Store ssh-backup-*.tar.gz.gpg in secure location
```

**How to restore:**
```bash
# Decrypt backup
gpg -d ssh-backup-20251001.tar.gz.gpg > ssh-backup.tar.gz

# Extract
tar -xzf ssh-backup.tar.gz -C ~/

# Fix permissions
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_megasena_vps
chmod 644 ~/.ssh/id_megasena_vps.pub
```

---

### Audit Logs

**Check who accessed server and when:**

**On VPS:**
```bash
# SSH authentication logs
sudo grep "Accepted publickey" /var/log/auth.log

# See which key was used
sudo grep "megasena-deploy" /var/log/auth.log
```

**Example output:**
```
Oct 01 14:23:15 vps sshd[12345]: Accepted publickey for claude from 192.168.1.100 port 54321 ssh2: ED25519 SHA256:OwfEGIYXRYTB6BYqO7qb7fWEx77HN0AWH0xp9cSqLu4
```

---

## Emergency Procedures

### Scenario 1: Key Compromised (Laptop Stolen)

**IMMEDIATE ACTIONS:**

**1. Remove key from server (from another machine):**
```bash
# SSH to server using password (if still enabled) or another key
ssh claude@212.85.2.24

# Edit authorized_keys
nano ~/.ssh/authorized_keys

# DELETE the compromised key line
# Save (Ctrl+O, Enter, Ctrl+X)
```

**2. Generate new key pair:**
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_megasena_vps_emergency -C "emergency-key-$(date +%Y%m%d)"
```

**3. Install new key:**
```bash
ssh-copy-id -i ~/.ssh/id_megasena_vps_emergency.pub claude@212.85.2.24
```

**4. Update deployment scripts with new key path**

**5. Audit server logs for unauthorized access:**
```bash
sudo grep "Accepted publickey" /var/log/auth.log | tail -50
```

---

### Scenario 2: Lost Access (Key Deleted/Corrupted)

**Option 1: Restore from backup**
```bash
# See "Backup Strategy" section above
```

**Option 2: Re-enable password auth temporarily**
```bash
# Contact VPS hosting provider to:
# - Access server console
# - Edit /etc/ssh/sshd_config
# - Set PasswordAuthentication yes
# - Restart sshd

# Then SSH with password and install new key
```

---

### Scenario 3: Server Reinstalled

**When VPS is reinstalled, SSH fingerprint changes:**

**1. Remove old fingerprint:**
```bash
ssh-keygen -R 212.85.2.24
```

**2. Reinstall public key:**
```bash
ssh-copy-id -i ~/.ssh/id_megasena_vps.pub claude@212.85.2.24
# Use password provided by hosting
```

**3. Verify new fingerprint:**
```bash
ssh-keygen -l -f ~/.ssh/id_megasena_vps.pub
```

---

## Quick Reference

### Essential Commands

```bash
# Connect to VPS
ssh megasena-vps

# Deploy application
bash scripts/deploy.sh

# Run remote command
ssh megasena-vps "pm2 status"

# Copy files to server
rsync -avz -e "ssh -i ~/.ssh/id_megasena_vps" ./ claude@212.85.2.24:/path/

# Check key fingerprint
ssh-keygen -l -f ~/.ssh/id_megasena_vps.pub

# Test SSH connection
ssh -v megasena-vps

# Add key to ssh-agent
ssh-add ~/.ssh/id_megasena_vps
```

### File Locations

| File | Purpose | Permissions |
|------|---------|-------------|
| `~/.ssh/id_megasena_vps` | Private key | 600 (-rw-------) |
| `~/.ssh/id_megasena_vps.pub` | Public key | 644 (-rw-r--r--) |
| `~/.ssh/config` | SSH client config | 600 (-rw-------) |
| `~/.ssh/known_hosts` | Server fingerprints | 644 (-rw-r--r--) |
| `/home/claude/.ssh/authorized_keys` (VPS) | Allowed public keys | 600 (-rw-------) |

---

## Additional Resources

- **OpenSSH Manual:** https://www.openssh.com/manual.html
- **SSH Academy:** https://www.ssh.com/academy/ssh/keygen
- **GitHub SSH Guide:** https://docs.github.com/en/authentication/connecting-to-github-with-ssh
- **DigitalOcean Tutorial:** https://www.digitalocean.com/community/tutorials/how-to-configure-ssh-key-based-authentication-on-a-linux-server

---

**Document Version:** 1.0
**Last Updated:** 2025-10-01
**Status:** ✅ Active - Password authentication replaced with SSH keys
