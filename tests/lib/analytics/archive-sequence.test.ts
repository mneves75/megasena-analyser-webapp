import { describe, expect, it } from 'vitest';
import { assertContiguousArchive } from '@/lib/analytics/archive-sequence';

describe('assertContiguousArchive', () => {
  it('accepts a complete range over an empty archive', () => {
    expect(() => assertContiguousArchive([1, 2, 3], 0)).not.toThrow();
  });

  it('accepts a range that continues the stored archive', () => {
    expect(() => assertContiguousArchive([101, 102, 103], 100)).not.toThrow();
  });

  it('accepts a missing tail, which is what --allow-partial exists for', () => {
    expect(() => assertContiguousArchive([101, 102, 103], 100)).not.toThrow();
  });

  it('rejects an interior gap even when the fetched contests are offset', () => {
    expect(() => assertContiguousArchive([101, 103], 100)).toThrow(/buraco entre os concursos 101 e 103/);
  });

  it('rejects a range that would leave a hole at the archive boundary', () => {
    // Two consecutive contests, no interior gap, but 101 is skipped entirely.
    expect(() => assertContiguousArchive([102, 103], 100)).toThrow(/começaria no concurso 102/);
  });

  it('rejects a first pull that starts past contest 1', () => {
    expect(() => assertContiguousArchive([2, 3], 0)).toThrow(/começaria no concurso 2/);
  });

  it('accepts an empty fetch so a no-op run stays a no-op', () => {
    expect(() => assertContiguousArchive([], 3073)).not.toThrow();
  });
});
