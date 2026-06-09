import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashForAudit, isHmacEnabled, pseudonymizeIp, safeStringEqual } from '@/lib/security/pseudonymize';

const STRONG_SECRET = 'a'.repeat(64);
const SALT_EPOCH_MS = Date.parse('2026-01-01T00:00:00.000Z');
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

describe('pseudonymizeIp', () => {
  const originalSecret = process.env['IP_HASH_SECRET'];

  beforeEach(() => {
    delete process.env['IP_HASH_SECRET'];
  });

  afterEach(() => {
    if (typeof originalSecret === 'string') {
      process.env['IP_HASH_SECRET'] = originalSecret;
    } else {
      delete process.env['IP_HASH_SECRET'];
    }
  });

  it('retorna sentinela para entrada vazia', () => {
    expect(pseudonymizeIp('')).toBe('sha256:unknown');
  });

  it('usa SHA-256 cru como fallback quando IP_HASH_SECRET ausente', () => {
    const result = pseudonymizeIp('203.0.113.42');
    expect(result.startsWith('sha256:')).toBe(true);
    expect(result).not.toContain('hmac-sha256:');
  });

  it('rejeita segredo muito curto e cai para fallback', () => {
    process.env['IP_HASH_SECRET'] = 'short';
    const result = pseudonymizeIp('203.0.113.42');
    expect(result.startsWith('sha256:')).toBe(true);
    expect(result).not.toContain('hmac-sha256:');
  });

  it('usa HMAC-SHA256 quando IP_HASH_SECRET está configurado', () => {
    process.env['IP_HASH_SECRET'] = STRONG_SECRET;
    const result = pseudonymizeIp('203.0.113.42', SALT_EPOCH_MS);
    expect(result.startsWith('hmac-sha256:v1:0:')).toBe(true);
  });

  it('produz hashes diferentes em janelas diferentes (rotação de salt)', () => {
    process.env['IP_HASH_SECRET'] = STRONG_SECRET;
    const a = pseudonymizeIp('203.0.113.42', SALT_EPOCH_MS);
    const b = pseudonymizeIp('203.0.113.42', SALT_EPOCH_MS + WINDOW_MS + 1);
    expect(a).not.toBe(b);
    expect(a.startsWith('hmac-sha256:v1:0:')).toBe(true);
    expect(b.startsWith('hmac-sha256:v1:1:')).toBe(true);
  });

  it('produz hashes determinísticos dentro da mesma janela', () => {
    process.env['IP_HASH_SECRET'] = STRONG_SECRET;
    const a = pseudonymizeIp('203.0.113.42', SALT_EPOCH_MS + 1000);
    const b = pseudonymizeIp('203.0.113.42', SALT_EPOCH_MS + 2000);
    expect(a).toBe(b);
  });

  it('produz hashes distintos para IPs diferentes na mesma janela', () => {
    process.env['IP_HASH_SECRET'] = STRONG_SECRET;
    const a = pseudonymizeIp('203.0.113.1', SALT_EPOCH_MS);
    const b = pseudonymizeIp('203.0.113.2', SALT_EPOCH_MS);
    expect(a).not.toBe(b);
  });

  it('isHmacEnabled reflete presença e tamanho do segredo', () => {
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
});
