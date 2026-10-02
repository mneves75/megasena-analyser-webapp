import { describe, expect, it } from 'vitest';
import '../../lib/log-context.runtime';
import { logger, runWithLogSink } from '../../lib/logger';

describe('request-scoped logging', () => {
  it('keeps overlapping asynchronous requests in their own sinks', async () => {
    const first: string[] = [];
    const second: string[] = [];
    await Promise.all([
      runWithLogSink(entry => { first.push(entry.event); }, async () => {
        await Promise.resolve();
        logger.info('first');
      }),
      runWithLogSink(entry => { second.push(entry.event); }, async () => {
        await Promise.resolve();
        logger.info('second');
      }),
    ]);
    expect(first).toEqual(['first']);
    expect(second).toEqual(['second']);
  });
});
