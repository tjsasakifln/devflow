import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const cwd = path.resolve(process.cwd());

/** Resolve local tsx binary — no npx, no registry lookup. */
function tsxBin(): string {
  return path.join(cwd, "node_modules", ".bin", "tsx");
}

const mainTs = path.join(cwd, "src", "main.ts");

describe("CLI — ai init (pipe-safe JSON)", () => {
  it("ai init --help produces valid help text (exit 0)", () => {
    const result = spawnSync(tsxBin(), [mainTs, "ai", "init", "--help"], {
      cwd,
      encoding: "utf-8",
      timeout: 10000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Configure AI provider/);
  });

  it("ai init -y produces pipe-safe JSON stdout with banner in stderr", () => {
    const result = spawnSync(tsxBin(), [mainTs, "ai", "init", "-y"], {
      cwd,
      encoding: "utf-8",
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024,
    });

    // stdout must be valid JSON
    expect(result.stdout.trim(), "stdout must not be empty").not.toBe("");
    expect(() => JSON.parse(result.stdout), "stdout must be valid JSON").not.toThrow();

    const parsed = JSON.parse(result.stdout);

    // Must have expected fields
    expect(parsed.success).toBeDefined();
    expect(parsed.configured).toBeDefined();
    expect(parsed.failed).toBeDefined();
    expect(parsed.envPath).toBeDefined();
    expect(parsed.details).toBeInstanceOf(Array);

    // stdout must start with { — pipe safety
    expect(result.stdout.trim().startsWith("{")).toBe(true);
    expect(result.stdout).not.toMatch(/\x1b\[/);

    // stderr should contain the banner
    expect(result.stderr).toMatch(/Devflow AI Init/);
  });

  it("ai init --provider unknown fails with clear error", () => {
    // Passing an unrecognized provider should not crash
    const result = spawnSync(tsxBin(), [mainTs, "ai", "init", "-y"], {
      cwd,
      encoding: "utf-8",
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024,
    });

    // stdout must still be valid JSON
    expect(result.stdout.trim()).not.toBe("");
    expect(() => JSON.parse(result.stdout)).not.toThrow();
  });
});

describe("CLI — requirements audit (pipe-safe JSON)", () => {
  it("requirements audit on non-existent feature returns JSON error", () => {
    const result = spawnSync(
      tsxBin(),
      [mainTs, "requirements", "audit", "non-existent-feature-12345"],
      {
        cwd,
        encoding: "utf-8",
        timeout: 15000,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    // stdout must be valid JSON
    expect(result.stdout.trim(), "stdout must not be empty").not.toBe("");
    expect(() => JSON.parse(result.stdout), "stdout must be valid JSON").not.toThrow();

    const parsed = JSON.parse(result.stdout);

    // Must have expected error structure
    expect(parsed.score).toBe(0);
    expect(parsed.featureId).toBe("non-existent-feature-12345");
    expect(parsed.issues).toBeInstanceOf(Array);
    expect(parsed.issues.length).toBeGreaterThan(0);
    expect(parsed.issues[0].severity).toBe("error");

    // Pipe safety
    expect(result.stdout.trim().startsWith("{")).toBe(true);
    expect(result.stdout).not.toMatch(/\x1b\[/);

    // stderr should contain the banner
    expect(result.stderr).toMatch(/Requirements Audit/);
  });

  it("requirements audit has expected JSON schema", () => {
    const result = spawnSync(
      tsxBin(),
      [mainTs, "requirements", "audit", "non-existent"],
      {
        cwd,
        encoding: "utf-8",
        timeout: 15000,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const parsed = JSON.parse(result.stdout);

    // Validate schema
    expect(parsed).toHaveProperty("score");
    expect(parsed).toHaveProperty("maxScore");
    expect(parsed).toHaveProperty("issues");
    expect(parsed).toHaveProperty("summary");
    expect(parsed.summary).toHaveProperty("clarity");
    expect(parsed.summary).toHaveProperty("coverage");
    expect(parsed.summary).toHaveProperty("testability");
    expect(parsed).toHaveProperty("featureId");
  });

  it("requirements audit --help shows command usage", () => {
    const result = spawnSync(tsxBin(), [mainTs, "requirements", "audit", "--help"], {
      cwd,
      encoding: "utf-8",
      timeout: 10000,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/audit/);
  });
});

describe("CLI — design review (pipe-safe JSON)", () => {
  it("design review on non-existent feature returns JSON error", () => {
    const result = spawnSync(
      tsxBin(),
      [mainTs, "design", "review", "non-existent-feature-12345"],
      {
        cwd,
        encoding: "utf-8",
        timeout: 15000,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    // stdout must be valid JSON
    expect(result.stdout.trim(), "stdout must not be empty").not.toBe("");
    expect(() => JSON.parse(result.stdout), "stdout must be valid JSON").not.toThrow();

    const parsed = JSON.parse(result.stdout);

    // Must have expected error structure
    expect(parsed.score).toBe(0);
    expect(parsed.featureId).toBe("non-existent-feature-12345");
    expect(parsed.issues).toBeInstanceOf(Array);
    expect(parsed.issues.length).toBeGreaterThan(0);
    expect(parsed.issues[0].severity).toBe("error");

    // Pipe safety
    expect(result.stdout.trim().startsWith("{")).toBe(true);
    expect(result.stdout).not.toMatch(/\x1b\[/);

    // stderr should contain the banner
    expect(result.stderr).toMatch(/Design Review/);
  });

  it("design review has expected JSON schema", () => {
    const result = spawnSync(
      tsxBin(),
      [mainTs, "design", "review", "non-existent"],
      {
        cwd,
        encoding: "utf-8",
        timeout: 15000,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const parsed = JSON.parse(result.stdout);

    // Validate schema
    expect(parsed).toHaveProperty("score");
    expect(parsed).toHaveProperty("maxScore");
    expect(parsed).toHaveProperty("issues");
    expect(parsed).toHaveProperty("summary");
    expect(parsed.summary).toHaveProperty("overEngineering");
    expect(parsed.summary).toHaveProperty("missingLayers");
    expect(parsed.summary).toHaveProperty("consistency");
    expect(parsed).toHaveProperty("featureId");
  });

  it("design review --help shows command usage", () => {
    const result = spawnSync(tsxBin(), [mainTs, "design", "review", "--help"], {
      cwd,
      encoding: "utf-8",
      timeout: 10000,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/design/);
  });
});
