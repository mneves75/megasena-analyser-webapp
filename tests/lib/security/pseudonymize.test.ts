import { createHash, createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { hashForAudit, isHmacEnabled, pseudonymizeClient, safeStringEqual } from '@/lib/security/pseudonymize';

const STRONG_SECRET = 'a'.repeat(64);
const SALT_EPOCH_MS = Date.parse('2026-01-01T00:00:00.000Z');
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

describe('pseudonymizeClient', () => {
  const salt = Buffer.alloc(32, 7);
  const subject = '203.0.113.42';

  it('usa HMAC com janela de 30 dias quando o segredo é forte', () => {
    const result = pseudonymizeClient(subject, STRONG_SECRET, salt, SALT_EPOCH_MS);
    expect(result).toBe(
      `hmac-sha256:v1:0:${createHmac('sha256', STRONG_SECRET).update(`v1:0:${subject}`).digest('hex')}`
    );
    expect(result).not.toContain(subject);
  });

  it('nunca cai para SHA-256 sem sal, que é reversível para IPv4', () => {
    for (const secret of [undefined, '', 'short', `  ${'a'.repeat(31)}  `]) {
      const result = pseudonymizeClient(subject, secret, salt, SALT_EPOCH_MS);
      expect(result).toBe(`salted-sha256:${createHmac('sha256', salt).update(subject).digest('hex')}`);
      expect(result).not.toContain(createHash('sha256').update(subject).digest('hex'));
    }
  });

  it('roda a janela a cada 30 dias e mantém o hash estável dentro dela', () => {
    const a = pseudonymizeClient(subject, STRONG_SECRET, salt, SALT_EPOCH_MS + 1000);
    const b = pseudonymizeClient(subject, STRONG_SECRET, salt, SALT_EPOCH_MS + 2000);
    const c = pseudonymizeClient(subject, STRONG_SECRET, salt, SALT_EPOCH_MS + WINDOW_MS + 1);
    expect(a).toBe(b);
    expect(c.startsWith('hmac-sha256:v1:1:')).toBe(true);
    expect(c).not.toBe(a);
  });

  it('trata instantes anteriores à época como janela 0', () => {
    expect(pseudonymizeClient(subject, STRONG_SECRET, salt, SALT_EPOCH_MS - WINDOW_MS)).toBe(
      pseudonymizeClient(subject, STRONG_SECRET, salt, SALT_EPOCH_MS)
    );
  });

  it('distingue sujeitos diferentes', () => {
    expect(pseudonymizeClient('203.0.113.1', STRONG_SECRET, salt)).not.toBe(
      pseudonymizeClient('203.0.113.2', STRONG_SECRET, salt)
    );
  });
});

describe('isHmacEnabled', () => {
  const originalSecret = process.env['IP_HASH_SECRET'];

  afterEach(() => {
    if (typeof originalSecret === 'string') {
      process.env['IP_HASH_SECRET'] = originalSecret;
    } else {
      delete process.env['IP_HASH_SECRET'];
    }
  });

  it('reflete presença e tamanho do segredo', () => {
    delete process.env['IP_HASH_SECRET'];
    expect(isHmacEnabled()).toBe(false);
    process.env['IP_HASH_SECRET'] = 'short';
    expect(isHmacEnabled()).toBe(false);
    process.env['IP_HASH_SECRET'] = STRONG_SECRET;
    expect(isHmacEnabled()).toBe(true);
  });
});

describe('hashForAudit', () => {
  it('emite SHA-256 prefixado', () => {
    const value = 'numbers=1,2,3,4,5,6';
    const result = hashForAudit(value);
    expect(result.startsWith('sha256:')).toBe(true);
    expect(result.length).toBe('sha256:'.length + 64);
  });

  it('é determinístico para a mesma entrada', () => {
    const value = 'numbers=1,2,3,4,5,6';
    expect(hashForAudit(value)).toBe(hashForAudit(value));
  });

  it('trunca entradas acima do limite antes de hash', () => {
    const long = 'x'.repeat(2_000);
    const short = 'x'.repeat(500);
    expect(hashForAudit(long, 500)).toBe(hashForAudit(short, 500));
  });
});

describe('safeStringEqual', () => {
  it('aceita strings idênticas', () => {
    expect(safeStringEqual('abc123', 'abc123')).toBe(true);
  });

  it('rejeita strings de tamanhos diferentes sem comparar byte a byte', () => {
    expect(safeStringEqual('abc', 'abcd')).toBe(false);
  });

  it('rejeita strings de mesmo tamanho com conteúdo diferente', () => {
    expect(safeStringEqual('abc123', 'abc124')).toBe(false);
  });

  it('rejeita tamanhos UTF-8 diferentes sem lançar erro', () => {
    expect(safeStringEqual('a', 'é')).toBe(false);
    expect(safeStringEqual('é', 'é')).toBe(true);
  });
});
