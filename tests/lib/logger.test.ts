import { describe, it, expect, vi, afterEach } from 'vitest';

const originalEnv = { ...process.env };

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    if (typeof value === 'string') {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
});

async function importFreshLogger() {
  vi.resetModules();
  const mod = await import('@/lib/logger');
  return mod.logger;
}

describe('logger', () => {
  it('redacts secret-like metadata keys', async () => {
    process.env.NODE_ENV = 'production';
    const logger = await importFreshLogger();

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('logger.test_redaction', {
      token: 'should-not-appear',
      password: 'should-not-appear',
      authorization: 'Bearer should-not-appear',
      cookie: 'should-not-appear',
      normalKey: 'ok',
      multiline: 'a\nb\r\nc',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [payload] = logSpy.mock.calls[0];
    const entry = JSON.parse(String(payload)) as { event: string; level: string; metadata?: Record<string, unknown> };

    expect(entry.event).toBe('logger.test_redaction');
    expect(entry.level).toBe('info');
    expect(entry.metadata?.token).toBe('[REDACTED]');
    expect(entry.metadata?.password).toBe('[REDACTED]');
    expect(entry.metadata?.authorization).toBe('[REDACTED]');
    expect(entry.metadata?.cookie).toBe('[REDACTED]');
    expect(entry.metadata?.normalKey).toBe('ok');
    expect(entry.metadata?.multiline).toBe('a b  c');
  });

  it('truncates error message and suppresses stack in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DEBUG;

    const logger = await importFreshLogger();

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.error('logger.test_error', new Error('x'.repeat(200)));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [payload] = errorSpy.mock.calls[0];
    const entry = JSON.parse(String(payload)) as {
      event: string;
      level: string;
      error?: { message: string; stack?: string };
    };

    expect(entry.event).toBe('logger.test_error');
    expect(entry.level).toBe('error');
    expect(entry.error?.message.length).toBeLessThanOrEqual(120);
    expect(entry.error?.stack).toBeUndefined();
  });
});
