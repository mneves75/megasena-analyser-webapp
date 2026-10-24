import { describe, expect, it } from 'vitest';
import { rateLimitSubject } from '@/lib/security/http';

describe('rateLimitSubject', () => {
  it('leaves IPv4 addresses unchanged', () => {
    expect(rateLimitSubject('203.0.113.10')).toBe('203.0.113.10');
  });

  it('collapses IPv4-mapped IPv6 addresses to their IPv4 form', () => {
    expect(rateLimitSubject('::ffff:203.0.113.10')).toBe('203.0.113.10');
  });

  it('collapses a full IPv6 address to its /64 prefix', () => {
    expect(rateLimitSubject('2001:db8:abcd:1234:5678:9abc:def0:1234')).toBe(
      '2001:db8:abcd:1234::/64'
    );
  });

  it('produces one subject for every address in the same /64', () => {
    const first = rateLimitSubject('2001:db8:abcd:1234:5678:9abc:def0:1234');
    const second = rateLimitSubject('2001:db8:abcd:1234::1');
    const third = rateLimitSubject('2001:0db8:abcd:1234:ffff:ffff:ffff:ffff');

    expect(new Set([first, second, third]).size).toBe(1);
  });

  it('separates addresses from different /64 prefixes', () => {
    expect(rateLimitSubject('2001:db8:abcd:1234::1')).not.toBe(
      rateLimitSubject('2001:db8:abcd:1235::1')
    );
  });

  it('normalizes the unspecified and loopback shorthands', () => {
    expect(rateLimitSubject('::1')).toBe('0:0:0:0::/64');
    expect(rateLimitSubject('::')).toBe('0:0:0:0::/64');
  });

  it('strips a zone identifier before grouping', () => {
    expect(rateLimitSubject('fe80::1%en0')).toBe('fe80:0:0:0::/64');
  });

  it('returns an empty subject for an empty address', () => {
    expect(rateLimitSubject('   ')).toBe('');
  });
});
