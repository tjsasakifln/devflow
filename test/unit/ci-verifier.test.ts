import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExecSync = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execSync: mockExecSync }));

import { isCIRequired, isCIUnavailableBlocking, isCIGreen, isCIAvailable, verifyCIStatus } from "../../src/kernel/ci/verifier.js";
import type { CIStatus } from "../../src/kernel/types/state.js";

describe("CI Verifier", () => {
  describe("isCIRequired", () => {
    it("returns true for strict mode", () => {
      expect(isCIRequired("strict")).toBe(true);
    });

    it("returns true for release mode", () => {
      expect(isCIRequired("release")).toBe(true);
    });

    it("returns false for local mode", () => {
      expect(isCIRequired("local")).toBe(false);
    });

    it("returns false for experimental mode", () => {
      expect(isCIRequired("experimental")).toBe(false);
    });
  });

  describe("isCIUnavailableBlocking", () => {
    it("returns true for strict mode", () => {
      expect(isCIUnavailableBlocking("strict")).toBe(true);
    });

    it("returns true for release mode", () => {
      expect(isCIUnavailableBlocking("release")).toBe(true);
    });

    it("returns false for local mode", () => {
      expect(isCIUnavailableBlocking("local")).toBe(false);
    });

    it("returns false for experimental mode", () => {
      expect(isCIUnavailableBlocking("experimental")).toBe(false);
    });
  });

  describe("isCIGreen", () => {
    it("returns true when all statuses are success", () => {
      const statuses: CIStatus[] = [
        { workflow: "ci", conclusion: "success", runId: 1, htmlUrl: null, headSha: null, timestamp: "", branch: "main" },
        { workflow: "lint", conclusion: "success", runId: 2, htmlUrl: null, headSha: null, timestamp: "", branch: "main" },
      ];
      expect(isCIGreen(statuses)).toBe(true);
    });

    it("returns false when any status is not success", () => {
      const statuses: CIStatus[] = [
        { workflow: "ci", conclusion: "success", runId: 1, htmlUrl: null, headSha: null, timestamp: "", branch: "main" },
        { workflow: "lint", conclusion: "failure", runId: 2, htmlUrl: null, headSha: null, timestamp: "", branch: "main" },
      ];
      expect(isCIGreen(statuses)).toBe(false);
    });

    it("returns false when conclusion is null", () => {
      const statuses: CIStatus[] = [
        { workflow: "ci", conclusion: null, runId: null, htmlUrl: null, headSha: null, timestamp: "", branch: "main" },
      ];
      expect(isCIGreen(statuses)).toBe(false);
    });

    it("returns false for empty array", () => {
      expect(isCIGreen([])).toBe(false);
    });

    it("returns false when conclusion is 'failure'", () => {
      const statuses: CIStatus[] = [
        { workflow: "ci", conclusion: "failure", runId: 1, htmlUrl: null, headSha: null, timestamp: "", branch: "main" },
      ];
      expect(isCIGreen(statuses)).toBe(false);
    });

    it("returns true when conclusion is 'success' regardless of other fields", () => {
      const statuses: CIStatus[] = [
        { workflow: "deploy", conclusion: "success", runId: 42, htmlUrl: "https://example.com", headSha: "abc123", timestamp: "2026-01-01", branch: "feature/test" },
      ];
      expect(isCIGreen(statuses)).toBe(true);
    });
  });

  describe("isCIAvailable", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns true when gh CLI is available", () => {
      mockExecSync.mockReturnValueOnce("");
      expect(isCIAvailable()).toBe(true);
    });

    it("returns false when gh CLI is not available", () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error("gh not found");
      });
      expect(isCIAvailable()).toBe(false);
    });
  });

  describe("verifyCIStatus", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns skipped when CI integration is disabled", async () => {
      const config = { ciIntegration: { enabled: false, requiredChecks: [] as string[], timeoutSeconds: 30 } } as any;
      const result = await verifyCIStatus("/fake/project", config);
      expect(result.conclusion).toBe("skipped");
    });

    it("returns workflow runs when gh CLI succeeds", async () => {
      mockExecSync
        .mockReturnValueOnce("feature-branch\n") // branch
        .mockReturnValueOnce(JSON.stringify([
          { conclusion: "success", databaseId: 42, headSha: "abc123", url: "https://github.com/run/42" },
        ]));

      const config = {
        ciIntegration: { enabled: true, requiredChecks: ["ci"], timeoutSeconds: 30 },
      } as any;
      const result = await verifyCIStatus("/fake/project", config);
      expect(result.workflow).toBe("ci");
      expect(result.conclusion).toBe("success");
      expect(result.runId).toBe(42);
    });

    it("returns pending when gh CLI returns empty array", async () => {
      mockExecSync
        .mockReturnValueOnce("feature-branch\n")
        .mockReturnValueOnce("[]");

      const config = {
        ciIntegration: { enabled: true, requiredChecks: ["ci"], timeoutSeconds: 30 },
      } as any;
      const result = await verifyCIStatus("/fake/project", config);
      expect(result.conclusion).toBeNull();
    });

    it("returns null conclusion when gh CLI throws", async () => {
      mockExecSync
        .mockReturnValueOnce("feature-branch\n")
        .mockImplementationOnce(() => { throw new Error("gh not found"); });

      const config = {
        ciIntegration: { enabled: true, requiredChecks: ["ci"], timeoutSeconds: 30 },
      } as any;
      const result = await verifyCIStatus("/fake/project", config);
      expect(result.conclusion).toBeNull();
    });

    it("falls back to first required check as workflow name", async () => {
      mockExecSync
        .mockReturnValueOnce("main\n")
        .mockReturnValueOnce("[]");

      const config = {
        ciIntegration: { enabled: true, requiredChecks: ["test-workflow"], timeoutSeconds: 30 },
      } as any;
      const result = await verifyCIStatus("/fake/project", config);
      expect(result.workflow).toBe("test-workflow");
    });
  });

  describe("getCurrentBranch (via verifyCIStatus)", () => {
    it("uses 'unknown' when git branch command fails", async () => {
      mockExecSync
        .mockImplementationOnce(() => { throw new Error("not a git repo"); })
        .mockReturnValueOnce(JSON.stringify([{ conclusion: "success", databaseId: 1, headSha: "a", url: "u" }]));

      const config = {
        ciIntegration: { enabled: true, requiredChecks: ["ci"], timeoutSeconds: 30 },
      } as any;
      const result = await verifyCIStatus("/fake/project", config);
      expect(result.branch).toBe("unknown");
    });

    it("includes branch name in result", async () => {
      mockExecSync
        .mockReturnValueOnce("my-branch\n")
        .mockReturnValueOnce("[]");

      const config = {
        ciIntegration: { enabled: true, requiredChecks: ["ci"], timeoutSeconds: 30 },
      } as any;
      const result = await verifyCIStatus("/fake/project", config);
      expect(result.branch).toBe("my-branch");
    });
  });
});
