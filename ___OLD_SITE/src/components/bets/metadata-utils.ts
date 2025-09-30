const MAX_DEPTH = 3;
const MAX_KEYS = 8;
const MAX_ARRAY_ITEMS = 6;

export function sanitizeMetadata(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (depth >= MAX_DEPTH) {
    if (Array.isArray(value)) {
      return "[…]";
    }
    if (typeof value === "object") {
      return "{…}";
    }
    return value;
  }

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeMetadata(item, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push("…");
    }
    return items;
  }

  if (typeof value === "object") {
    if (seen.has(value as object)) {
      return "{…}";
    }
    seen.add(value as object);
    const entries = Object.entries(value as Record<string, unknown>);
    const limited = entries
      .slice(0, MAX_KEYS)
      .map(
        ([key, val]) => [key, sanitizeMetadata(val, depth + 1, seen)] as const,
      );
    if (entries.length > MAX_KEYS) {
      limited.push(["…", "(truncado)"]);
    }
    return Object.fromEntries(limited);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return String(value);
    }
    return value;
  }

  if (typeof value === "string" && value.length > 160) {
    return `${value.slice(0, 157)}…`;
  }

  return value;
}

export function stringifyMetadata(value: unknown): string {
  try {
    const sanitized = sanitizeMetadata(value);
    return JSON.stringify(sanitized, null, 2);
  } catch (error) {
    console.warn("ticket-metadata: falha ao serializar metadados", error);
    return '{\n  "erro": "não foi possível exibir os metadados"\n}';
  }
}
