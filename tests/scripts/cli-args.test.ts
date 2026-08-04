import { describe, expect, it } from 'vitest';

import { parsePositiveIntegerArg } from '@/scripts/cli-args';

describe('parsePositiveIntegerArg', () => {
  it('returns a positive integer value', () => {
    expect(parsePositiveIntegerArg(['--limit', '10'], '--limit')).toBe(10);
  });

  it('returns undefined when the flag is absent', () => {
    expect(parsePositiveIntegerArg([], '--limit')).toBeUndefined();
  });

  it.each(['', '0', '-1', '10x', '1.5', `${Number.MAX_SAFE_INTEGER + 1}`])(
    'rejects invalid value %j',
    (value) => {
      expect(() => parsePositiveIntegerArg(['--limit', value], '--limit')).toThrow();
    }
  );
});
