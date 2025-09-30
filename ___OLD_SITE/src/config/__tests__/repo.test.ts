import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_BASE = process.env.NEXT_PUBLIC_REPO_BASE;

describe("REPO_BASE_URL", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_REPO_BASE;
  });

  afterEach(() => {
    if (ORIGINAL_BASE !== undefined) {
      process.env.NEXT_PUBLIC_REPO_BASE = ORIGINAL_BASE;
    } else {
      delete process.env.NEXT_PUBLIC_REPO_BASE;
    }
  });

  it("usa fallback com repositório oficial megasena-analyser-nextjs", async () => {
    const { REPO_BASE_URL } = await import("@/config/repo");
    expect(REPO_BASE_URL).toContain("megasena-analyser-nextjs");
  });
});
