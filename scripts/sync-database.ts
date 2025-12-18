#!/usr/bin/env bun
/**
 * Database Sync Script
 *
 * Syncs the local Mega-Sena database with the VPS.
 *
 * Usage:
 *   bun scripts/sync-database.ts              # Pull from VPS, update, push back
 *   bun scripts/sync-database.ts --pull-only  # Only download VPS database
 *   bun scripts/sync-database.ts --push-only  # Only upload local database
 *   bun scripts/sync-database.ts --update-only # Only update local database with new draws
 *
 * Prerequisites:
 *   - SSH alias 'megasena-vps' configured in ~/.ssh/config
 *   - VPS path: /home/claude/apps/megasena-analyser
 */

import { $ } from 'bun';
import { Database } from 'bun:sqlite';
import { existsSync } from 'fs';

const VPS_HOST = 'megasena-vps';
const VPS_DB_PATH = '/home/claude/apps/megasena-analyser/db/mega-sena.db';
const LOCAL_DB_PATH = 'db/mega-sena.db';
const COMPOSE_FILE = 'docker-compose.coolify.yml';
const VPS_APP_PATH = '/home/claude/apps/megasena-analyser';

interface SyncOptions {
  pullOnly: boolean;
  pushOnly: boolean;
  updateOnly: boolean;
}

function parseArgs(): SyncOptions {
  const args = process.argv.slice(2);
  return {
    pullOnly: args.includes('--pull-only'),
    pushOnly: args.includes('--push-only'),
    updateOnly: args.includes('--update-only'),
  };
}

async function getLocalDbStats(): Promise<{ maxContest: number; total: number }> {
  if (!existsSync(LOCAL_DB_PATH)) {
    return { maxContest: 0, total: 0 };
  }
  const db = new Database(LOCAL_DB_PATH, { readonly: true });
  const result = db.query('SELECT MAX(contest_number) as max, COUNT(*) as total FROM draws').get() as {
    max: number;
    total: number;
  };
  db.close();
  return { maxContest: result.max || 0, total: result.total };
}

async function getVpsDbStats(): Promise<{ maxContest: number; total: number }> {
  const result =
    await $`ssh ${VPS_HOST} "docker exec megasena-analyzer bun -e \\"const db = require('bun:sqlite').Database; const d = new db('/app/db/mega-sena.db'); console.log(JSON.stringify(d.query('SELECT MAX(contest_number) as max, COUNT(*) as total FROM draws').get()));\\"" 2>/dev/null`.text();
  const parsed = JSON.parse(result.trim());
  return { maxContest: parsed.max || 0, total: parsed.total };
}

async function stopVpsContainer(): Promise<void> {
  console.log('[SYNC] Stopping VPS container...');
  await $`ssh ${VPS_HOST} "cd ${VPS_APP_PATH} && docker compose -f ${COMPOSE_FILE} stop"`;
  console.log('[OK] Container stopped');
}

async function startVpsContainer(): Promise<void> {
  console.log('[SYNC] Starting VPS container...');
  await $`ssh ${VPS_HOST} "cd ${VPS_APP_PATH} && docker compose -f ${COMPOSE_FILE} start"`;
  // Wait for container to be healthy
  console.log('[SYNC] Waiting for container to be healthy...');
  await Bun.sleep(10000);
  console.log('[OK] Container started');
}

async function backupVpsDb(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  console.log(`[SYNC] Creating VPS backup: mega-sena.db.backup-${timestamp}`);
  await $`ssh ${VPS_HOST} "cp ${VPS_DB_PATH} ${VPS_APP_PATH}/db/backups/mega-sena.db.backup-${timestamp}"`;
}

async function pullFromVps(): Promise<void> {
  console.log('[SYNC] Downloading database from VPS...');
  await $`scp ${VPS_HOST}:${VPS_DB_PATH} ${LOCAL_DB_PATH}`;
  console.log('[OK] Database downloaded');
}

async function pushToVps(): Promise<void> {
  console.log('[SYNC] Checkpointing WAL...');
  const db = new Database(LOCAL_DB_PATH);
  db.run('PRAGMA wal_checkpoint(TRUNCATE)');
  db.close();

  console.log('[SYNC] Uploading database to VPS...');
  await $`scp ${LOCAL_DB_PATH} ${VPS_HOST}:${VPS_DB_PATH}`;
  console.log('[OK] Database uploaded');
}

async function updateLocalDb(): Promise<void> {
  const stats = await getLocalDbStats();
  const startContest = stats.maxContest + 1;

  console.log(`[SYNC] Updating local DB from contest #${startContest}...`);
  await $`bun scripts/pull-draws.ts --start ${startContest}`;
  console.log('[OK] Local database updated');
}

async function optimizeDb(): Promise<void> {
  console.log('[SYNC] Optimizing database...');
  await $`bun scripts/optimize-db.ts`;
}

async function verifyVpsHealth(): Promise<boolean> {
  try {
    const result =
      await $`ssh ${VPS_HOST} "docker exec megasena-analyzer bun -e \\"console.log(await (await fetch('http://localhost:3201/api/health')).text())\\""`.text();
    const health = JSON.parse(result.trim());
    return health.status === 'healthy';
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('============================================================');
  console.log('Mega-Sena Database Sync');
  console.log('============================================================\n');

  try {
    // Get current stats
    const localStats = await getLocalDbStats();
    console.log(`Local DB: ${localStats.total} draws, max contest #${localStats.maxContest}`);

    if (!options.updateOnly && !options.pushOnly) {
      const vpsStats = await getVpsDbStats();
      console.log(`VPS DB: ${vpsStats.total} draws, max contest #${vpsStats.maxContest}`);
    }

    console.log('');

    if (options.pullOnly) {
      // Pull only mode
      await stopVpsContainer();
      await pullFromVps();
      await startVpsContainer();
    } else if (options.pushOnly) {
      // Push only mode
      await stopVpsContainer();
      await backupVpsDb();
      await pushToVps();
      await startVpsContainer();
    } else if (options.updateOnly) {
      // Update only mode
      await updateLocalDb();
      await optimizeDb();
    } else {
      // Full sync: update local, push to VPS
      await updateLocalDb();
      await optimizeDb();
      await stopVpsContainer();
      await backupVpsDb();
      await pushToVps();
      await startVpsContainer();
    }

    // Verify health
    if (!options.updateOnly) {
      console.log('\n[SYNC] Verifying VPS health...');
      const healthy = await verifyVpsHealth();
      if (healthy) {
        console.log('[OK] VPS is healthy');
      } else {
        console.log('[WARN] VPS health check failed - please verify manually');
      }
    }

    // Final stats
    const finalStats = await getLocalDbStats();
    console.log('\n============================================================');
    console.log('Sync Complete');
    console.log('============================================================');
    console.log(`Final DB: ${finalStats.total} draws, max contest #${finalStats.maxContest}`);
  } catch (error) {
    console.error('\n[ERROR] Sync failed:', error);
    process.exit(1);
  }
}

main();
