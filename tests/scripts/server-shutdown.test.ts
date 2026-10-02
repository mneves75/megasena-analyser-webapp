import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { describe, expect, it } from 'vitest';

describe('API process shutdown', () => {
  it('persists its final lifecycle event before closing SQLite', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'megasena-shutdown-'));
    const port = await new Promise<number>((resolve, reject) => {
      const listener = createServer();
      listener.on('error', reject);
      listener.listen(0, '127.0.0.1', () => {
        const address = listener.address();
        if (!address || typeof address === 'string') { reject(new Error('Missing test port')); return; }
        listener.close(() => { resolve(address.port); });
      });
    });
    const env = { ...process.env, DATABASE_PATH: path.join(directory, 'fixture.db'),
      API_PORT: String(port), NODE_ENV: 'production', IP_HASH_SECRET: 'public-shutdown-test-only-secret-0123456789',
      VITEST: '', VITEST_FORCE_FILE_DB: '1' };
    try {
      const outcome = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
        const child = spawn('bun', ['server.ts'], { cwd: process.cwd(), env });
        let output = '';
        let signaled = false;
        const deadline = setTimeout(() => { child.kill('SIGKILL'); }, 10000);
        child.stdout.on('data', (data) => {
          output += String(data);
          if (!signaled && output.includes('api.server_started')) {
            signaled = true;
            // Startup output precedes signal-handler registration in this CLI.
            setTimeout(() => { child.kill('SIGTERM'); }, 50);
          }
        });
        child.stderr.on('data', (data) => { output += String(data); });
        child.on('error', reject);
        child.on('close', (code) => { clearTimeout(deadline); resolve({ code, output }); });
      });
      expect(outcome.code, outcome.output).toBe(0);
      const checked = spawnSync('bun', ['-e', `
        import {Database} from 'bun:sqlite';
        const db=new Database(process.env.DATABASE_PATH,{readonly:true});
        console.log(db.query("SELECT count(*) n FROM log_events WHERE event='system.shutdown_complete'").get().n);
        db.close();
      `], { cwd: process.cwd(), env, encoding: 'utf8', timeout: 5000 });
      expect(checked.status, checked.stderr).toBe(0);
      expect(checked.stdout.trim()).toBe('1');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
