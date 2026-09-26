import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * End-to-end tests for `scripts/indexnow-submit.ts`, which tells IndexNow
 * engines (Bing and partners) which pages changed after a data refresh. The CLI
 * runs under Bun against a temporary SQLite file and a local fake endpoint.
 *
 * Failure modes (written before the implementation):
 * 1. INDEXNOW_KEY missing or malformed            → exit 1, nothing sent
 * 2. --contests missing or not a list of integers → exit 1, nothing sent
 * 3. a contest that is not in the database        → exit 1, nothing sent
 * 4. the endpoint answers with an error status    → exit 1 naming the status
 * 5. --dry-run                                     → prints the plan, nothing sent
 * 6. success                                       → one POST with host, key,
 *    keyLocation and exactly the pages the new contests changed
 */

const REPO = process.cwd();
const SITE = 'https://megasena-analyzer.com.br';
const KEY = 'test-indexnow-key-0123456789';

interface Captured {
  method: string | undefined;
  contentType: string | undefined;
  body: {
    host?: string;
    key?: string;
    keyLocation?: string;
    urlList?: string[];
  };
}

let tempDir: string;
let dbPath: string;
let server: http.Server;
let endpoint: string;
let captured: Captured[];
let replyStatus: number;

function seedDatabase(): void {
  const script = [
    "const { runMigrations, getDatabase, closeDatabase } = await import('./lib/db.ts');",
    'runMigrations();',
    'const db = getDatabase();',
    "const insert = db.prepare('INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');",
    "insert.run(3060, '2025-12-30', 1, 2, 3, 4, 5, 6);",
    "insert.run(3061, '2026-01-01', 7, 8, 9, 10, 11, 12);",
    "insert.run(3062, '2026-01-03', 13, 14, 15, 16, 17, 18);",
    'closeDatabase();',
  ].join('\n');
  const result = spawnSync('bun', ['-e', script], {
    cwd: REPO,
    env: { ...process.env, DATABASE_PATH: dbPath, VITEST: '', NODE_ENV: 'test' },
    encoding: 'utf8',
  });
  expect(result.status, result.stderr).toBe(0);
}

function submit(
  args: string[],
  env: Record<string, string | undefined> = {}
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('bun', ['run', 'scripts/indexnow-submit.ts', ...args], {
      cwd: REPO,
      env: {
        ...process.env,
        DATABASE_PATH: dbPath,
        VITEST: '',
        NODE_ENV: 'test',
        NEXT_PUBLIC_BASE_URL: SITE,
        INDEXNOW_ENDPOINT: endpoint,
        INDEXNOW_KEY: KEY,
        ...env,
      },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

beforeEach(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-indexnow-'));
  dbPath = path.join(tempDir, 'indexnow.db');
  seedDatabase();
  captured = [];
  replyStatus = 202;
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      captured.push({
        method: req.method,
        contentType: req.headers['content-type'],
        body: raw ? (JSON.parse(raw) as Captured['body']) : {},
      });
      res.writeHead(replyStatus);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/indexnow`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('indexnow-submit CLI', () => {
  it.each([
    ['missing', undefined],
    ['too short', 'abc'],
    ['with invalid characters', 'bad key with spaces!'],
  ])('refuses to send when the key is %s', async (_label, key) => {
    const result = await submit(['--contests', '3062'], { INDEXNOW_KEY: key });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/INDEXNOW_KEY/);
    expect(captured).toHaveLength(0);
  });

  it.each([[[]], [['--contests']], [['--contests', '3062,abc']], [['--contests', '0']]])(
    'refuses to send without a valid contest list (%j)',
    async (args) => {
      const result = await submit(args);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/--contests/);
      expect(captured).toHaveLength(0);
    }
  );

  it('refuses a contest that is not in the database', async () => {
    const result = await submit(['--contests', '3063']);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/3063/);
    expect(captured).toHaveLength(0);
  });

  it('fails when the endpoint rejects the submission', async () => {
    replyStatus = 422;
    const result = await submit(['--contests', '3062']);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/422/);
    expect(captured).toHaveLength(1);
  });

  it('prints the plan on --dry-run without sending, never echoing the key', async () => {
    const result = await submit(['--contests', '3062', '--dry-run']);
    expect(result.status, result.stderr).toBe(0);
    expect(captured).toHaveLength(0);
    expect(result.stdout).toContain(`${SITE}/concurso/3062`);
    expect(result.stdout).not.toContain(KEY);
  });

  it('submits exactly the pages the new contests changed', async () => {
    const result = await submit(['--contests', '3061,3062']);
    expect(result.status, result.stderr).toBe(0);
    expect(captured).toHaveLength(1);
    const [request] = captured;
    expect(request?.method).toBe('POST');
    expect(request?.contentType).toMatch(/^application\/json/);
    expect(request?.body.host).toBe('megasena-analyzer.com.br');
    expect(request?.body.key).toBe(KEY);
    expect(request?.body.keyLocation).toBe(`${SITE}/indexnow-key.txt`);

    const urls = request?.body.urlList ?? [];
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of [
      SITE,
      `${SITE}/resultados`,
      `${SITE}/numeros`,
      `${SITE}/concurso/3060`, // gains its "Próximo concurso" link
      `${SITE}/concurso/3061`,
      `${SITE}/concurso/3062`,
      `${SITE}/resultados/2025`, // its last draw's page changed
      `${SITE}/resultados/2026`,
      `${SITE}/numeros/1`,
      `${SITE}/numeros/60`,
    ]) {
      expect(urls, url).toContain(url);
    }
    expect(urls).not.toContain(`${SITE}/concurso/3059`);
    expect(urls.filter((url) => url.startsWith(`${SITE}/numeros/`))).toHaveLength(60);
  });
});
