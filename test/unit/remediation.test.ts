import { describe, it, expect } from "vitest";
import { missingFileRemediation, toolNotInstalledRemediation, toolFailedRemediation, renderRemediationList } from "../../src/kernel/errors/remediation.js";

describe("Remediation", () => {
  describe("missingFileRemediation", () => {
    it("creates blocking remediation for missing file", () => {
      const r = missingFileRemediation("requirements.md", "Required for spec validation");
      expect(r.title).toContain("requirements.md");
      expect(r.severity).toBe("blocking");
      expect(r.whyMatters).toBe("Required for spec validation");
    });

    it("includes impact message with file name", () => {
      const r = missingFileRemediation("test.md", "testing");
      expect(r.impact).toContain("test.md");
    });

    it("suggests creating the file", () => {
      const r = missingFileRemediation("roadmap.md", "planning");
      expect(r.suggestedFix).toContain("roadmap.md");
    });

    it("provides minimal example", () => {
      const r = missingFileRemediation("file.md", "reason");
      expect(r.minimalExample).toContain("file.md");
    });
  });

  describe("toolNotInstalledRemediation", () => {
    it("creates advisory remediation", () => {
      const r = toolNotInstalledRemediation("typescript", "npm install -g typescript");
      expect(r.severity).toBe("advisory");
      expect(r.title).toContain("typescript");
    });

    it("includes copyable command", () => {
      const r = toolNotInstalledRemediation("eslint", "npm install -g eslint");
      expect(r.copyableCommand).toBe("npm install -g eslint");
    });

    it("explains why it matters", () => {
      const r = toolNotInstalledRemediation("vitest", "npm install -g vitest");
      expect(r.whyMatters).toContain("vitest");
    });
  });

  describe("toolFailedRemediation", () => {
    it("creates blocking remediation by default", () => {
      const r = toolFailedRemediation("tsc", "tsc --noEmit", "Type errors found");
      expect(r.severity).toBe("blocking");
      expect(r.title).toContain("tsc");
    });

    it("accepts custom severity", () => {
      const r = toolFailedRemediation("lint", "npm run lint", "Errors found", "advisory");
      expect(r.severity).toBe("advisory");
    });

    it("includes the detail as minimal example", () => {
      const detail = "Found 3 errors in src/index.ts";
      const r = toolFailedRemediation("tsc", "tsc --noEmit", detail);
      expect(r.minimalExample).toBe(detail);
    });

    it("includes copyable command", () => {
      const r = toolFailedRemediation("test", "npm test", "Tests failed");
      expect(r.copyableCommand).toBe("npm test");
    });
  });

  describe("renderRemediationList", () => {
    it("returns empty string for empty list", () => {
      expect(renderRemediationList([])).toBe("");
    });

    it("renders with custom title", () => {
      const result = renderRemediationList(
        [missingFileRemediation("test.md", "testing")],
        "Custom Title"
      );
      expect(result).toContain("Custom Title");
      expect(result).toContain("test.md");
    });

    it("groups by severity", () => {
      const result = renderRemediationList([
        missingFileRemediation("req.md", "req"),
        toolNotInstalledRemediation("tool", "install"),
      ]);
      expect(result).toContain("Blocking");
      expect(result).toContain("Advisory");
    });
  });
});
