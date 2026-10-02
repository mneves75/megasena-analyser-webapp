import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

describe('browser logger entry point', () => {
  it('bundles without Node runtime dependencies', () => {
    const result = spawnSync('bun', ['build', 'lib/logger.ts', '--target', 'browser'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
    });
    expect(result.status, result.stderr).toBe(0);
    const browserScript = result.stdout.replace(/export \{[\s\S]*$/, '');
    expect(() => runInNewContext(browserScript, { process: { env: { NODE_ENV: 'production' } }, console })).not.toThrow();
  });
});
