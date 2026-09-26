// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { GET } from '@/app/indexnow-key.txt/route';

/**
 * The IndexNow key file must exist only when a valid key is configured: a
 * missing or malformed INDEXNOW_KEY must not publish anything.
 */
const original = process.env['INDEXNOW_KEY'];

afterEach(() => {
  if (original === undefined) {
    delete process.env['INDEXNOW_KEY'];
  } else {
    process.env['INDEXNOW_KEY'] = original;
  }
});

describe('GET /indexnow-key.txt', () => {
  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['too short', 'abc'],
    ['with forbidden characters', 'key<script>alert(1)</script>'],
  ])('answers 404 when the key is %s', async (_label, key) => {
    if (key === undefined) {
      delete process.env['INDEXNOW_KEY'];
    } else {
      process.env['INDEXNOW_KEY'] = key;
    }
    const response = GET();
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('script');
  });

  it('serves a valid key as plain text', async () => {
    process.env['INDEXNOW_KEY'] = 'valid-indexnow-key-123';
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^text\/plain/);
    expect(await response.text()).toBe('valid-indexnow-key-123');
  });
});
