import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const cwd = path.resolve(process.cwd());
const distMain = path.join(cwd, "dist", "main.js");

describe("CLI integration — Batch 3 commands (Story 4.3)", () => {
  beforeAll(() => {
    expect(
      fs.existsSync(distMain),
      `dist/main.js not found at ${distMain} — run 'npm run build' first`,
    ).toBe(true);
  });

  describe("adversarial-review-ai", () => {
    it("falls back to deterministic review when no AI provider is available", () => {
      // Without AI provider env vars, this should fall back to deterministic
      const result = spawnSync("node", [distMain, "adversarial-review-ai", "test-nonexistent"], {
        cwd,
        encoding: "utf-8",
        timeout: 15000,
      });
      const { stdout, stderr } = result;

      // Even with a non-existent feature, it should produce JSON output
      expect(stdout.trim()).not.toBe("");

      // Should be valid JSON
      let parsed: unknown;
      expect(() => { parsed = JSON.parse(stdout); }, "stdout must be valid JSON").not.toThrow();

      const output = parsed as Record<string, unknown>;
      expect(output.command).toBe("adversarial-review-ai");
      expect(output.status).toBe("fallback");
      expect(output.deterministicResults).toBeDefined();

      // Stderr should indicate fallback (either "fallback" or "falling back")
      expect(stderr).toMatch(/fall(back|ing)/i);
    });

    it("produces pipe-safe JSON output", () => {
      const result = spawnSync("node", [distMain, "adversarial-review-ai", "test-pipe"], {
        cwd,
        encoding: "utf-8",
        timeout: 15000,
      });
      const { stdout } = result;

      // Must start with '{' (pure JSON, no banner on stdout)
      expect(stdout.trim().startsWith("{"), "stdout must start with '{'").toBe(true);
      // Must not contain ANSI codes
      expect(stdout, "stdout must not contain ANSI codes").not.toMatch(/\x1b\[/);

      const parsed = JSON.parse(stdout) as Record<string, unknown>;
      expect(parsed.command).toBe("adversarial-review-ai");
      expect(parsed.timestamp).toBeDefined();
    });
  });

  describe("trace", () => {
    it("--format=json produces parseable JSON", () => {
      const result = spawnSync("node", [distMain, "trace", "--format", "json"], {
        cwd,
        encoding: "utf-8",
        timeout: 15000,
      });
      const { stdout, stderr } = result;

      expect(stdout.trim(), "stdout must not be empty").not.toBe("");

      // Must be valid JSON
      let parsed: unknown;
      expect(() => { parsed = JSON.parse(stdout); }, "stdout must be valid JSON").not.toThrow();

      const output = parsed as Record<string, unknown>;
      expect(output.command).toBe("trace");
      expect(output.status).toBeDefined();
      expect(output.entries).toBeDefined();
      expect(output.summary).toBeDefined();
    });

    it("produces pipe-safe JSON (no ANSI on stdout)", () => {
      const result = spawnSync("node", [distMain, "trace", "--format", "json"], {
        cwd,
        encoding: "utf-8",
        timeout: 15000,
      });
      const { stdout } = result;

      expect(stdout.trim().startsWith("{"), "stdout must start with '{'").toBe(true);
      expect(stdout, "stdout must not contain ANSI codes").not.toMatch(/\x1b\[/);
    });

    it("--format terminal shows timeline header", () => {
      const result = spawnSync("node", [distMain, "trace", "--format", "terminal"], {
        cwd,
        encoding: "utf-8",
        timeout: 15000,
      });
      // Terminal format writes human-readable output to stderr
      expect(result.stderr).toMatch(/Devflow Execution Trace/i);
    });
  });

  describe("promote", () => {
    it("rejects invalid --to environment", () => {
      const result = spawnSync("node", [distMain, "promote", "test-feature", "--to", "invalid"], {
        cwd,
        encoding: "utf-8",
        timeout: 15000,
      });
      const { stdout, stderr } = result;

      expect(stdout.trim()).not.toBe("");
      expect(() => { JSON.parse(stdout); }, "stdout must be valid JSON").not.toThrow();

      const parsed = JSON.parse(stdout) as Record<string, unknown>;
      expect(parsed.command).toBe("promote");
      expect(parsed.status).toBe("error");
      expect(stderr).toMatch(/invalid/i);
    });

    it("promotes to local (no gates required)", () => {
      const result = spawnSync("node", [distMain, "promote", "test-local", "--to", "local"], {
        cwd,
        encoding: "utf-8",
        timeout: 15000,
      });
      const { stdout } = result;

      expect(() => { JSON.parse(stdout); }, "stdout must be valid JSON").not.toThrow();
      const parsed = JSON.parse(stdout) as Record<string, unknown>;
      expect(parsed.command).toBe("promote");
      expect(parsed.status).toBeDefined();
      expect(parsed.gates).toBeDefined();
    });

    it("promote with --to=staging checks CI gates", () => {
      const result = spawnSync("node", [distMain, "promote", "test-staging", "--to", "staging"], {
        cwd,
        encoding: "utf-8",
        timeout: 15000,
      });
      const { stdout } = result;

      expect(() => { JSON.parse(stdout); }, "stdout must be valid JSON").not.toThrow();
      const parsed = JSON.parse(stdout) as Record<string, unknown>;
      expect(parsed.command).toBe("promote");
      expect(parsed.status).toBeDefined();
      const gates = parsed.gates as Array<Record<string, unknown>>;
      // Should have local gates + CI gate
      expect(gates.length).toBeGreaterThanOrEqual(4);
    });

    it("produces pipe-safe JSON output", () => {
      const result = spawnSync("node", [distMain, "promote", "test-pipe", "--to", "local"], {
        cwd,
        encoding: "utf-8",
        timeout: 15000,
      });
      const { stdout } = result;

      expect(stdout.trim().startsWith("{"), "stdout must start with '{'").toBe(true);
      expect(stdout, "stdout must not contain ANSI codes").not.toMatch(/\x1b\[/);
    });
  });

  describe("tier system removal (regression)", () => {
    it("--list-tiers shows deprecation message", () => {
      const result = spawnSync("node", [distMain, "--list-tiers"], {
        cwd,
        encoding: "utf-8",
        timeout: 10000,
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/STABLE/i);
      expect(result.stdout).toMatch(/v1\.0\.0/);
    });

    it("existing commands still work after tier system removal", () => {
      // Smoke test key commands
      const result = spawnSync("node", [distMain, "--version"], {
        cwd,
        encoding: "utf-8",
        timeout: 10000,
      });
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    });
  });
});
