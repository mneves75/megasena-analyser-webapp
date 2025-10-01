#!/usr/bin/env bun

import { getDatabase, closeDatabase } from '@/lib/db';

async function main() {
  console.log('Optimizing SQLite database...\n');

  const db = getDatabase();

  try {
    // Checkpoint WAL file to merge changes back to main database
    console.log('1. Checkpointing WAL file...');
    db.run('PRAGMA wal_checkpoint(TRUNCATE)');
    console.log('   ✓ WAL checkpoint complete');

    // Optimize database by rebuilding to reclaim space
    console.log('\n2. Running VACUUM to reclaim space...');
    db.run('VACUUM');
    console.log('   ✓ VACUUM complete');

    // Analyze tables for query optimization
    console.log('\n3. Analyzing tables...');
    db.run('ANALYZE');
    console.log('   ✓ ANALYZE complete');

    // Show database size
    const stats = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get() as { size: number };
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`\n✓ Database optimized successfully`);
    console.log(`  Current size: ${sizeMB} MB`);

  } catch (error) {
    console.error('\n✗ Error during optimization:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

main();
