import { describe, it, expect } from "vitest";

/**
 * Mirrors the IIFE in +page.svelte that parses the `?age=` URL param.
 * Extracted here as a pure function so we can regression-test the NaN guard
 * that prevents invalid age values from zeroing out the criteria table.
 */
function parseAge(raw: string | null): number | null {
  if (raw === null) return null;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

describe("criteria age parsing (Bug 3 regression)", () => {
  it("returns null for null input", () => {
    expect(parseAge(null)).toBeNull();
  });

  it("parses valid integer '25' → 25", () => {
    expect(parseAge("25")).toBe(25);
  });

  it("returns null for non-numeric 'foo' → null", () => {
    expect(parseAge("foo")).toBeNull();
  });

  it("returns null for empty string '' → null", () => {
    expect(parseAge("")).toBeNull();
  });

  it("parses '0' → 0", () => {
    expect(parseAge("0")).toBe(0);
  });

  it("truncates decimal '42.7' → 42", () => {
    expect(parseAge("42.7")).toBe(42);
  });
});
