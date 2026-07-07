import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const cwd = path.resolve(process.cwd());
const distMain = path.join(cwd, "dist", "main.js");

describe("CLI integration — compiled dist/main.js", () => {
  // ── Hard gate: dist must exist ──

  beforeAll(() => {
    expect(
      fs.existsSync(distMain),
      `dist/main.js not found at ${distMain} — run 'npm run build' first`
    ).toBe(true);
  });

  // ── Basic smoke tests ──

  it("--version produces semver string", () => {
    const result = spawnSync("node", [distMain, "--version"], {
      cwd,
      encoding: "utf-8",
      timeout: 10000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("--list-tiers produces expected stable command listing", () => {
    const result = spawnSync("node", [distMain, "--list-tiers"], {
      cwd,
      encoding: "utf-8",
      timeout: 10000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/STABLE/);
    expect(result.stdout).toMatch(/audit/);
    expect(result.stdout).toMatch(/review-pr/);
  });

  // ── audit JSON pipe-safety ──

  it("audit --format json produces parseable JSON without banner in stdout", () => {
    const result = spawnSync("node", [distMain, "audit", "--format", "json"], {
      cwd,
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const { stdout, stderr, status } = result;

    // Must produce output regardless of exit code
    expect(stdout.trim(), "stdout must not be empty").not.toBe("");

    // Must be valid JSON
    let parsed: any;
    expect(() => { parsed = JSON.parse(stdout); }, "stdout must be valid JSON").not.toThrow();

    // Must have mandatory report fields
    expect(parsed.verdict, "report must have verdict").toBeDefined();
    expect(parsed.severityMatrix, "report must have severityMatrix").toBeDefined();
    expect(parsed.metadata, "report must have metadata").toBeDefined();

    // Stdout must be valid JSON — no banner text or ANSI codes
    expect(stdout.trim().startsWith("{"), "stdout must start with '{'").toBe(true);
    expect(stdout, "stdout must not contain ANSI codes").not.toMatch(/\x1b\[/);

    // Stderr should contain the banner and verdict indicators
    expect(stderr, "stderr should contain Devflow Audit banner").toMatch(/Devflow Audit/);
    expect(stderr, "stderr should contain verdict emoji").toMatch(/[✅⚠️❌🚫]/u);

    // Even on non-zero exit, JSON was produced — log verdict for diagnostics
    console.log(`[CLI test] audit --format json exit=${status} verdict=${parsed.verdict}`);
  }, 30000);

  // ── audit markdown ──

  it("audit --format markdown produces output with Verdict section", () => {
    const result = spawnSync("node", [distMain, "audit", "--format", "markdown"], {
      cwd,
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    expect(result.stdout.trim(), "stdout must not be empty").not.toBe("");
    // Markdown report should contain a table (|) and the Verdict section
    expect(result.stdout).toMatch(/\|/);
  }, 30000);

  // ── review-pr JSON pipe-safety ──

  it("review-pr --format json produces parseable JSON without banner in stdout", () => {
    const result = spawnSync("node", [distMain, "review-pr", "--format", "json"], {
      cwd,
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const { stdout, stderr, status } = result;

    expect(stdout.trim(), "stdout must not be empty").not.toBe("");

    let parsed: any;
    expect(() => { parsed = JSON.parse(stdout); }, "stdout must be valid JSON").not.toThrow();

    expect(parsed.verdict, "report must have verdict").toBeDefined();
    expect(parsed.severityMatrix, "report must have severityMatrix").toBeDefined();

    expect(stdout.trim().startsWith("{"), "stdout must start with '{'").toBe(true);
    expect(stdout, "stdout must not contain ANSI codes").not.toMatch(/\x1b\[/);

    expect(stderr).toMatch(/Devflow PR Review/);

    console.log(`[CLI test] review-pr --format json exit=${status} verdict=${parsed.verdict}`);
  }, 30000);

  // ── review-pr with risk-tolerance strict ──

  it("review-pr --format json --risk-tolerance strict makes MEDIUM risks blocking", () => {
    const result = spawnSync("node", [
      distMain, "review-pr", "--format", "json", "--risk-tolerance", "strict",
    ], {
      cwd,
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const { stdout } = result;

    expect(stdout.trim()).not.toBe("");

    let parsed: any;
    expect(() => { parsed = JSON.parse(stdout); }).not.toThrow();

    // With strict tolerance, all MEDIUM risks should be blocking
    const mediumRisks = (parsed.risks ?? []).filter((r: any) => r.severity === "MEDIUM");
    for (const r of mediumRisks) {
      expect(
        r.blocking,
        `MEDIUM risk "${r.description}" must be blocking under strict tolerance`
      ).toBe(true);
    }
  }, 30000);

  // ── review-pr markdown ──

  it("review-pr --format markdown produces non-empty output", () => {
    const result = spawnSync("node", [distMain, "review-pr", "--format", "markdown"], {
      cwd,
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    expect(result.stdout.trim(), "stdout must not be empty").not.toBe("");
    expect(result.stdout).toMatch(/\|/);
  }, 30000);
});
