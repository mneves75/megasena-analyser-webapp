import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from '@/components/seo/json-ld';

describe('serializeJsonLd', () => {
  it('escapa tags para impedir fechamento prematuro de script', () => {
    const serialized = serializeJsonLd({
      name: '</script><script>alert(1)</script>',
    });

    expect(serialized).toContain('\\u003c/script>');
    expect(serialized).not.toContain('</script>');
  });
});
