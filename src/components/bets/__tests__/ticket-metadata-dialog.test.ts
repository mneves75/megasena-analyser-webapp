import { describe, expect, it } from "vitest";

import {
  sanitizeMetadata,
  stringifyMetadata,
} from "@/components/bets/metadata-utils";

describe("sanitizeMetadata", () => {
  it("truncates deep nested objects", () => {
    const value = { a: { b: { c: { d: 1 } } } };
    expect(sanitizeMetadata(value)).toEqual({ a: { b: { c: "{…}" } } });
  });

  it("limits array length", () => {
    const arr = Array.from({ length: 10 }, (_, index) => index + 1);
    expect(sanitizeMetadata(arr)).toEqual([1, 2, 3, 4, 5, 6, "…"]);
  });

  it("truncates long strings", () => {
    const long = "x".repeat(200);
    const result = sanitizeMetadata(long);
    expect(typeof result).toBe("string");
    expect((result as string).endsWith("…")).toBe(true);
    expect((result as string).length).toBeLessThanOrEqual(161);
  });
});

describe("stringifyMetadata", () => {
  it("returns pretty printed JSON", () => {
    const output = stringifyMetadata({ foo: "bar" });
    expect(output).toBe('{\n  "foo": "bar"\n}');
  });

  it("handles circular references gracefully", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const output = stringifyMetadata(circular);
    expect(output).toContain('{\n  "self": "{…}"\n}');
  });
});
