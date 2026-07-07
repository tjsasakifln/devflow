import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

const cwd = path.resolve(process.cwd());

/** Resolve local tsx binary — no npx, no registry lookup. */
function tsxBin(): string {
  return path.join(cwd, "node_modules", ".bin", "tsx");
}

const mainTs = path.join(cwd, "src", "main.ts");

describe("JSON pipe-safe output via tsx (no build)", () => {
  // ── audit ──

  it("audit --format json produces parseable JSON in stdout, banner in stderr", () => {
    const result = spawnSync(tsxBin(), [mainTs, "audit", "--format", "json"], {
      cwd,
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const { stdout, stderr } = result;

    // stdout must be valid JSON — the definitive pipe-safety check
    expect(stdout.trim(), "stdout must not be empty — JSON always written").not.toBe("");
    let parsed: any;
    expect(() => { parsed = JSON.parse(stdout); }, "stdout must be valid JSON").not.toThrow();

    // Must have expected report structure
    expect(parsed!.verdict, "report must have verdict field").toBeDefined();
    expect(parsed!.severityMatrix, "report must have severityMatrix field").toBeDefined();
    expect(parsed!.metadata, "report must have metadata field").toBeDefined();

    // stdout must start with { — no free-text banner before JSON
    expect(stdout.trim().startsWith("{"), "stdout must start with '{' — no banner text mixed in").toBe(true);
    expect(stdout, "stdout must not contain ANSI escape codes").not.toMatch(/\x1b\[/);

    // stderr SHOULD contain the banner
    expect(stderr, "stderr should contain Devflow Audit banner").toMatch(/Devflow Audit/);
  }, 30000);

  // ── review-pr ──

  it("review-pr --format json produces parseable JSON in stdout, banner in stderr", () => {
    const result = spawnSync(tsxBin(), [mainTs, "review-pr", "--format", "json"], {
      cwd,
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const { stdout, stderr } = result;

    expect(stdout.trim(), "stdout must not be empty").not.toBe("");

    let parsed2: any;
    expect(() => { parsed2 = JSON.parse(stdout); }).not.toThrow();

    expect(parsed2!.verdict).toBeDefined();
    expect(parsed2!.severityMatrix).toBeDefined();

    expect(stdout, "stdout must start with '{' — no banner text mixed in").not.toMatch(/\x1b\[/);
    expect(stdout.trim().startsWith("{"), "stdout must start with '{'").toBe(true);

    expect(stderr).toMatch(/Devflow PR Review/);
  }, 30000);

  // ── review-pr with risk-tolerance strict ──

  it("review-pr --format json --risk-tolerance strict makes MEDIUM risks blocking", () => {
    const result = spawnSync(tsxBin(), [
      mainTs, "review-pr", "--format", "json", "--risk-tolerance", "strict",
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

    // With strict tolerance, MEDIUM severity risks should have blocking: true
    const mediumRisks = (parsed.risks ?? []).filter((r: any) => r.severity === "MEDIUM");
    for (const r of mediumRisks) {
      expect(r.blocking, `MEDIUM risk "${r.description}" must be blocking under strict tolerance`).toBe(true);
    }
  }, 30000);

  // ── Even on blocking verdict, stdout must have parseable JSON ──

  it("audit --format json produces parseable stdout even when command exits with non-zero", () => {
    // Audit on this very repo may find risks and exit 1 (blocking verdict).
    // Regardless, stdout must contain valid JSON.
    const result = spawnSync(tsxBin(), [mainTs, "audit", "--format", "json"], {
      cwd,
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });

    // If stdout is empty and exit is non-zero, that's a bug
    if (result.status !== 0) {
      expect(
        result.stdout.trim(),
        "Non-zero exit but stdout is empty — JSON must be produced even on blocking verdict"
      ).not.toBe("");
    }

    // In all cases, if stdout has content, it must be valid JSON
    if (result.stdout.trim()) {
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    }
  }, 30000);
});
