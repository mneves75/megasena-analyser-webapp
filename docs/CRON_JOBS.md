# Cron Jobs Configuration

## Configured Cron Jobs

### 1. Daily Draw Updates (9 PM every day)

```bash
0 21 * * * docker exec megasena-analyzer bun run scripts/pull-draws.ts --incremental >> /var/log/megasena/daily-update.log 2>&1
```

- **Schedule**: Runs at 21:00 (9 PM) UTC daily
- **Mode**: Uses `--incremental` flag to only add new draws (INSERT OR IGNORE)
- **Logs**: `/var/log/megasena/daily-update.log`

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
