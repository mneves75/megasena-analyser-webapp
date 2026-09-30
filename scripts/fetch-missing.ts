#!/usr/bin/env bun

import { getDatabase, closeDatabase } from '@/lib/db';
import { pullDraws } from '@/scripts/pull-draws';

const db = getDatabase();
const lastContest = db.prepare('SELECT MAX(contest_number) AS max FROM draws').get() as { max: number | null };
closeDatabase();

// Keep this legacy entry point on the validated, transactional ingestion path.
await pullDraws(['--incremental', '--start', String((lastContest.max ?? 0) + 1)]);
