/**
 * Unit tests for resolveInvocationCommand — CLI availability detection.
 *
 * Validates the four detection modes:
 *   1. global — devflow binary in PATH
 *   2. local  — node_modules/.bin/devflow exists
 *   3. local  — @tjsasakinpm/devflow in package.json deps
 *   4. none   — no persistent install found
 *
 * Also validates the module-level cache.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { resolveInvocationCommand, _resetCache } from "../../src/kernel/utils/cli-resolver.js";

async function createTempDir(): Promise<string> {
  const tmp = path.join(
    os.tmpdir(),
    `resolver-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  await fs.mkdir(tmp, { recursive: true });
  return tmp;
}

describe("resolveInvocationCommand", () => {
  let tmpDir: string;
  let originalPath: string;

  beforeEach(async () => {
    tmpDir = await createTempDir();
    originalPath = process.env.PATH || process.env.Path || "";
    _resetCache();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    process.env.PATH = originalPath;
    _resetCache();
  });

  it("should return 'global' mode when devflow is in PATH", async () => {
    const binDir = path.join(tmpDir, "bin");
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(
      path.join(binDir, "devflow"),
      "#!/usr/bin/env node\nconsole.log('fake');\n",
      "utf-8",
    );
    await fs.chmod(path.join(binDir, "devflow"), 0o755);
    process.env.PATH = binDir + path.delimiter + (originalPath || "");

    _resetCache();
    const result = await resolveInvocationCommand(tmpDir);
    expect(result.mode).toBe("global");
    expect(result.command).toBe("devflow");
  });

  it("should return 'local' mode when node_modules/.bin/devflow exists", async () => {
    const nodeModulesBin = path.join(tmpDir, "node_modules", ".bin");
    await fs.mkdir(nodeModulesBin, { recursive: true });
    await fs.writeFile(
      path.join(nodeModulesBin, "devflow"),
      "#!/usr/bin/env node\nconsole.log('fake');\n",
      "utf-8",
    );
    await fs.chmod(path.join(nodeModulesBin, "devflow"), 0o755);
    // Ensure devflow is NOT in PATH
    process.env.PATH = "/usr/bin:/bin";

    _resetCache();
    const result = await resolveInvocationCommand(tmpDir);
    expect(result.mode).toBe("local");
    expect(result.command).toBe("npx devflow");
  });

  it("should return 'local' mode when @tjsasakinpm/devflow is in devDependencies", async () => {
    const pkg = {
      name: "test-project",
      devDependencies: { "@tjsasakinpm/devflow": "^0.4.0" },
    };
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify(pkg),
      "utf-8",
    );
    process.env.PATH = "/usr/bin:/bin";

    _resetCache();
    const result = await resolveInvocationCommand(tmpDir);
    expect(result.mode).toBe("local");
    expect(result.command).toBe("npx devflow");
  });

  it("should return 'local' mode when @tjsasakinpm/devflow is in dependencies", async () => {
    const pkg = {
      name: "test-project",
      dependencies: { "@tjsasakinpm/devflow": "^0.4.0" },
    };
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify(pkg),
      "utf-8",
    );
    process.env.PATH = "/usr/bin:/bin";

    _resetCache();
    const result = await resolveInvocationCommand(tmpDir);
    expect(result.mode).toBe("local");
    expect(result.command).toBe("npx devflow");
  });

  it("should return 'none' mode when devflow is not installed anywhere", async () => {
    process.env.PATH = "/usr/bin:/bin";
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "test-project" }),
      "utf-8",
    );

    _resetCache();
    const result = await resolveInvocationCommand(tmpDir);
    expect(result.mode).toBe("none");
    expect(result.command).toBe("npx -y @tjsasakinpm/devflow@latest");
    expect(result.installHint).toBeDefined();
  });

  it("should return 'none' mode when there is no package.json", async () => {
    process.env.PATH = "/usr/bin:/bin";

    _resetCache();
    const result = await resolveInvocationCommand(tmpDir);
    expect(result.mode).toBe("none");
    expect(result.command).toBe("npx -y @tjsasakinpm/devflow@latest");
  });

  it("should cache the result and not re-evaluate on subsequent calls", async () => {
    process.env.PATH = "/usr/bin:/bin";
    _resetCache();
    const result1 = await resolveInvocationCommand(tmpDir);
    expect(result1.mode).toBe("none");

    // Now expose a devflow binary in PATH — cache should prevent re-eval
    const binDir = path.join(tmpDir, "bin");
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(
      path.join(binDir, "devflow"),
      "#!/usr/bin/env node\n",
      "utf-8",
    );
    await fs.chmod(path.join(binDir, "devflow"), 0o755);
    process.env.PATH = binDir + path.delimiter + (originalPath || "");

    const result2 = await resolveInvocationCommand(tmpDir);
    // Same object reference (cached)
    expect(result2).toBe(result1);
    expect(result2.mode).toBe("none");
  });
});
