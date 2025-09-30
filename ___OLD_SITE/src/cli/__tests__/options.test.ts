import { afterEach, describe, expect, it } from "vitest";

import {
  parseOptionalBoolean,
  parseOptionalInteger,
  parseAmountToCents,
  parseOptionalDate,
  resolveJsonMode,
} from "@/cli/options";
import { shouldUseSilentSync } from "@/cli/commands/sync";

describe("resolveJsonMode", () => {
  it("prefers pretty-json when both flags provided", () => {
    expect(resolveJsonMode({ json: true, prettyJson: true })).toBe("pretty");
  });

  it("falls back to compact when only json is true", () => {
    expect(resolveJsonMode({ json: true })).toBe("compact");
  });

  it("returns off by default", () => {
    expect(resolveJsonMode({})).toBe("off");
  });
});

describe("parseOptionalInteger", () => {
  it("parses valid integers and enforces min", () => {
    expect(parseOptionalInteger("10", { min: 5 })).toBe(10);
  });

  it("returns undefined when value is empty", () => {
    expect(parseOptionalInteger(undefined)).toBeUndefined();
  });

  it("throws when below min", () => {
    expect(() => parseOptionalInteger("2", { min: 3 })).toThrow(/>= 3/);
  });
});

describe("parseOptionalBoolean", () => {
  it("supports truthy strings", () => {
    expect(parseOptionalBoolean("yes")).toBe(true);
  });

  it("supports falsy strings", () => {
    expect(parseOptionalBoolean("0")).toBe(false);
  });

  it("returns undefined for empty values", () => {
    expect(parseOptionalBoolean(null)).toBeUndefined();
  });
});

describe("shouldUseSilentSync", () => {
  const originalCi = process.env.CI;

  afterEach(() => {
    process.env.CI = originalCi;
  });

  it("forces silent when explicit flag provided", () => {
    process.env.CI = "0";
    expect(shouldUseSilentSync("off", true)).toBe(true);
  });

  it("enables silent in CI even without flag", () => {
    process.env.CI = "true";
    expect(shouldUseSilentSync("off")).toBe(true);
  });

  it("enables silent when JSON output requested", () => {
    process.env.CI = "0";
    expect(shouldUseSilentSync("compact")).toBe(true);
  });

  it("allows verbose UI when non-CI and json off", () => {
    process.env.CI = "";
    expect(shouldUseSilentSync("off")).toBe(false);
  });
});

describe("parseAmountToCents", () => {
  it("parses decimal strings with comma", () => {
    expect(parseAmountToCents("12,50")).toBe(1_250);
  });

  it("respect min constraint", () => {
    expect(() => parseAmountToCents("3", { minCents: 400 })).toThrow();
  });
});

describe("parseOptionalDate", () => {
  it("returns undefined when value absent", () => {
    expect(parseOptionalDate(undefined)).toBeUndefined();
  });

  it("throws for invalid date", () => {
    expect(() => parseOptionalDate("invalid")).toThrow();
  });

  it("parses ISO strings", () => {
    expect(parseOptionalDate("2025-01-01")?.toISOString()).toBe(
      "2025-01-01T00:00:00.000Z",
    );
  });
});
