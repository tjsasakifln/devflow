import { describe, it, expect } from "vitest";
import { getVersion } from "../../src/kernel/utils/version.js";

describe("Version", () => {
  it("returns a version string", () => {
    const version = getVersion();
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
  });

  it("returns a valid semver", () => {
    const version = getVersion();
    // semver pattern: major.minor.patch or major.minor.patch-prerelease
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("returns cached value on subsequent calls", () => {
    const v1 = getVersion();
    const v2 = getVersion();
    expect(v1).toBe(v2);
  });
});
