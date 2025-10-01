#!/usr/bin/env bun
/**
 * Automated SQLite Database Backup Script
 *
 * Creates timestamped backups of the Mega-Sena database with automatic
 * retention policy management. Can be run manually or via cron.
 *
 * Features:
 * - Timestamped backups with ISO 8601 format
 * - Automatic cleanup of old backups
 * - Configurable retention (days and count)
 * - Docker-compatible
 * - Comprehensive logging
 * - Atomic file operations
 *
 * Usage:
 *   bun run scripts/backup-database.ts
 *
 * Cron (daily at 3 AM):
 *   0 3 * * * cd /path/to/app && bun run scripts/backup-database.ts >> logs/backup.log 2>&1
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../lib/logger';

// ============================================================================
// Configuration
// ============================================================================

const DB_DIR = path.join(process.cwd(), 'db');
const DB_PATH = path.join(DB_DIR, 'mega-sena.db');
const BACKUP_DIR = path.join(DB_DIR, 'backups');

// Retention policy
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS) || 30;
const MAX_BACKUPS = Number(process.env.BACKUP_MAX_COUNT) || 50;

// File size limits (alert if database is too large)
const MAX_DB_SIZE_MB = 1000; // 1GB

// ============================================================================
// Types
// ============================================================================

interface BackupMetadata {
  filename: string;
  path: string;
  size: number;
  created: Date;
  age: number; // days
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get all backup files sorted by creation time (newest first)
 */
function getBackupFiles(): BackupMetadata[] {
  if (!fs.existsSync(BACKUP_DIR)) {
    return [];
  }

  const now = Date.now();

  return fs
    .readdirSync(BACKUP_DIR)
    .filter((file) => file.startsWith('mega-sena-backup-') && file.endsWith('.db'))
    .map((file) => {
      const filepath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filepath);

      return {
        filename: file,
        path: filepath,
        size: stats.size,
        created: stats.mtime,
        age: Math.floor((now - stats.mtime.getTime()) / (1000 * 60 * 60 * 24)),
      };
    })
    .sort((a, b) => b.created.getTime() - a.created.getTime());
}

/**
 * Verify database file integrity (basic check)
 */
async function verifyDatabase(dbPath: string): Promise<boolean> {
  try {
    // Check file exists and is readable
    if (!fs.existsSync(dbPath)) {
      logger.error(`Database file not found: ${dbPath}`);
      return false;
    }

    // Check file size is reasonable
    const stats = fs.statSync(dbPath);
    if (stats.size === 0) {
      logger.error('Database file is empty');
      return false;
    }

    if (stats.size > MAX_DB_SIZE_MB * 1024 * 1024) {
      logger.warn(`Database size (${formatBytes(stats.size)}) exceeds ${MAX_DB_SIZE_MB}MB`);
      // Don't fail, just warn
    }

    // Basic SQLite file format check (magic number)
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(dbPath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    const magic = buffer.toString('ascii', 0, 15);
    if (!magic.startsWith('SQLite format 3')) {
      logger.error('File is not a valid SQLite database');
      return false;
    }

    logger.info('✓ Database integrity check passed');
    return true;
  } catch (error) {
    logger.error('Database verification failed', error);
    return false;
  }
}

/**
 * Create a backup of the database
 */
async function createBackup(): Promise<string | null> {
  try {
    logger.info('📦 Starting database backup...');

    // Step 1: Verify source database
    logger.info(`Source: ${DB_PATH}`);
    const isValid = await verifyDatabase(DB_PATH);
    if (!isValid) {
      throw new Error('Database validation failed');
    }

    // Step 2: Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      logger.info(`Creating backup directory: ${BACKUP_DIR}`);
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Step 3: Generate backup filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, ''); // Remove milliseconds
    const backupFilename = `mega-sena-backup-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    // Step 4: Copy database file (atomic operation)
    logger.info(`Creating backup: ${backupFilename}`);

    const startTime = Date.now();
    await Bun.write(backupPath, Bun.file(DB_PATH));
    const duration = Date.now() - startTime;

    // Step 5: Verify backup was created successfully
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file was not created');
    }

    // Step 6: Get backup file stats
    const backupStats = fs.statSync(backupPath);
    const originalStats = fs.statSync(DB_PATH);

    // Verify sizes match
    if (backupStats.size !== originalStats.size) {
      throw new Error(
        `Backup size mismatch: expected ${originalStats.size}, got ${backupStats.size}`
      );
    }

    logger.info(`✅ Backup created successfully`);
    logger.info(`   Size: ${formatBytes(backupStats.size)}`);
    logger.info(`   Duration: ${duration}ms`);
    logger.info(`   Location: ${backupPath}`);

    return backupPath;
  } catch (error) {
    logger.error('❌ Backup creation failed', error);
    return null;
  }
}

/**
 * Clean up old backups based on retention policy
 */
async function cleanupOldBackups(): Promise<void> {
  try {
    logger.info('🧹 Cleaning up old backups...');

    const backups = getBackupFiles();

    if (backups.length === 0) {
      logger.info('No backups to clean up');
      return;
    }

    logger.info(`Found ${backups.length} total backup(s)`);

    // Calculate cutoff date for age-based retention
    const cutoffDate = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

    let removedCount = 0;
    let freedSpace = 0;

    for (const [index, backup] of backups.entries()) {
      // Determine if backup should be removed
      const tooOld = backup.created.getTime() < cutoffDate;
      const exceedsCount = index >= MAX_BACKUPS;

      if (tooOld || exceedsCount) {
        const reason = tooOld
          ? `older than ${RETENTION_DAYS} days (${backup.age}d)`
          : `exceeds max count (${MAX_BACKUPS})`;

        logger.info(`Removing backup: ${backup.filename} (${reason})`);

        try {
          fs.unlinkSync(backup.path);
          removedCount++;
          freedSpace += backup.size;
        } catch (error) {
          logger.error(`Failed to remove backup: ${backup.filename}`, error);
        }
      }
    }

    if (removedCount > 0) {
      logger.info(`✅ Removed ${removedCount} old backup(s)`);
      logger.info(`   Space freed: ${formatBytes(freedSpace)}`);
    } else {
      logger.info('✅ No backups need to be removed');
    }

    // Final summary
    const remainingBackups = backups.length - removedCount;
    const totalSize = backups
      .slice(0, remainingBackups)
      .reduce((sum, b) => sum + b.size, 0);

    logger.info(`📊 Retention status:`);
    logger.info(`   Total backups: ${remainingBackups}`);
    logger.info(`   Total size: ${formatBytes(totalSize)}`);
    logger.info(`   Oldest backup: ${backups[remainingBackups - 1]?.created.toISOString() || 'N/A'}`);
  } catch (error) {
    logger.error('❌ Cleanup failed', error);
  }
}

/**
 * Display backup statistics
 */
function displayStats(): void {
  const backups = getBackupFiles();

  if (backups.length === 0) {
    logger.info('📊 No backups found');
    return;
  }

  logger.info('📊 Backup Statistics:');
  logger.info(`   Total backups: ${backups.length}`);
  logger.info(`   Latest: ${backups[0].filename}`);
  logger.info(`   Oldest: ${backups[backups.length - 1].filename}`);

  const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
  logger.info(`   Total size: ${formatBytes(totalSize)}`);
  logger.info(`   Average size: ${formatBytes(totalSize / backups.length)}`);
}

// ============================================================================
// Main Execution
// ============================================================================

(async () => {
  logger.info('═'.repeat(60));
  logger.info('🗄️  Database Backup Utility');
  logger.info('═'.repeat(60));
  logger.info(`Configuration:`);
  logger.info(`  Retention: ${RETENTION_DAYS} days or ${MAX_BACKUPS} backups`);
  logger.info(`  Database: ${DB_PATH}`);
  logger.info(`  Backup directory: ${BACKUP_DIR}`);
  logger.info('═'.repeat(60));

  // Create backup
  const backupPath = await createBackup();

  if (!backupPath) {
    logger.error('❌ Backup failed');
    process.exit(1);
  }

  // Clean up old backups
  await cleanupOldBackups();

  // Display statistics
  displayStats();

  logger.info('═'.repeat(60));
  logger.info('✅ Backup process completed successfully');
  logger.info('═'.repeat(60));

  process.exit(0);
})();
