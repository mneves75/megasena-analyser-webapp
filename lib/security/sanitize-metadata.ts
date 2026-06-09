const REDACTION_KEY_PATTERN = /(authorization|token|secret|password|cookie|set-cookie)/i;
const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_MAX_ARRAY_ITEMS = 25;
const DEFAULT_MAX_STRING_LENGTH = 500;

export interface MetadataSanitizerOptions {
  maxDepth?: number;
  maxArrayItems?: number;
  maxStringLength?: number;
}

function sanitizeString(value: string, maxLength: number): string {
  const normalized = value.replace(/[\r\n\t]/g, ' ');
  return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength);
}

function sanitizeMetadataValue(
  key: string,
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
  options: Required<MetadataSanitizerOptions>
): unknown {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (REDACTION_KEY_PATTERN.test(key)) {
    return '[REDACTED]';
  }

  if (typeof value === 'string') {
    return sanitizeString(value, options.maxStringLength);
  }

  if (value === null || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (depth >= options.maxDepth) {
    return '[TRUNCATED]';
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, options.maxArrayItems)
      .map((item, index) => sanitizeMetadataValue(String(index), item, depth + 1, seen, options))
      .filter((item) => typeof item !== 'undefined');
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[CIRCULAR]';
    }
    seen.add(value);

    const sanitized: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      const sanitizedValue = sanitizeMetadataValue(childKey, childValue, depth + 1, seen, options);
      if (typeof sanitizedValue !== 'undefined') {
        sanitized[childKey] = sanitizedValue;
      }
    }

    seen.delete(value);
    return sanitized;
  }

  return sanitizeString(String(value), options.maxStringLength);
}

export function sanitizeStructuredMetadata(
  metadata: Record<string, unknown> | undefined,
  sanitizerOptions: MetadataSanitizerOptions = {}
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  const options: Required<MetadataSanitizerOptions> = {
    maxDepth: sanitizerOptions.maxDepth ?? DEFAULT_MAX_DEPTH,
    maxArrayItems: sanitizerOptions.maxArrayItems ?? DEFAULT_MAX_ARRAY_ITEMS,
    maxStringLength: sanitizerOptions.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH,
  };

  const sanitized = sanitizeMetadataValue('metadata', metadata, 0, new WeakSet<object>(), options);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
    return null;
  }

  return Object.keys(sanitized).length > 0 ? (sanitized as Record<string, unknown>) : null;
}
