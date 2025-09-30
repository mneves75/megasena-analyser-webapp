#!/usr/bin/env bun

import { runMigrations, closeDatabase } from '@/lib/db';

async function main() {
  console.log('Running database migrations...');
  
  try {
    runMigrations();
    console.log('✓ All migrations completed successfully');
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

main();

