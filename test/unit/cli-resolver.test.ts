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
import { resolveInvocationCommand, _resetCache, isNpxTempPath } from "../../src/kernel/utils/cli-resolver.js";

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

  // ── Regression: npx temp path filtering ──

  it("should reject devflow found in _npx temp directory (return 'none')", async () => {
    // Simulate npx injecting a temp binary into a _npx directory
    const npxTempDir = path.join(tmpDir, "_npx", "abc123", "bin");
    await fs.mkdir(npxTempDir, { recursive: true });
    await fs.writeFile(
      path.join(npxTempDir, "devflow"),
      "#!/usr/bin/env node\nconsole.log('fake');\n",
      "utf-8",
    );
    await fs.chmod(path.join(npxTempDir, "devflow"), 0o755);

    // PATH contains _npx — no local install, no package.json dep
    process.env.PATH = npxTempDir + path.delimiter + "/usr/bin:/bin";

    _resetCache();
    const result = await resolveInvocationCommand(tmpDir);
    expect(result.mode).toBe("none");
    expect(result.command).toBe("npx -y @tjsasakinpm/devflow@latest");
  });

  it("should prefer local .bin over _npx temp binary in PATH", async () => {
    // Create a temp _npx binary in PATH (simulating npx transient)
    const npxTempDir = path.join(tmpDir, "_npx", "xyz789", "bin");
    await fs.mkdir(npxTempDir, { recursive: true });
    await fs.writeFile(
      path.join(npxTempDir, "devflow"),
      "#!/usr/bin/env node\nconsole.log('fake');\n",
      "utf-8",
    );
    await fs.chmod(path.join(npxTempDir, "devflow"), 0o755);

    // Also create a real local node_modules/.bin/devflow
    const nodeModulesBin = path.join(tmpDir, "node_modules", ".bin");
    await fs.mkdir(nodeModulesBin, { recursive: true });
    await fs.writeFile(
      path.join(nodeModulesBin, "devflow"),
      "#!/usr/bin/env node\nconsole.log('local');\n",
      "utf-8",
    );
    await fs.chmod(path.join(nodeModulesBin, "devflow"), 0o755);

    // PATH has both — local should take priority (checked first)
    process.env.PATH = npxTempDir + path.delimiter + "/usr/bin:/bin";

    _resetCache();
    const result = await resolveInvocationCommand(tmpDir);
    expect(result.mode).toBe("local");
    expect(result.command).toBe("npx devflow");
  });

  it("should reject node_modules/.bin/devflow that points into _npx temp dir", async () => {
    // Create the real binary inside an _npx temp directory
    const npxTempDir = path.join(tmpDir, "_npx", "def456", "bin");
    await fs.mkdir(npxTempDir, { recursive: true });
    const realBinary = path.join(npxTempDir, "devflow");
    await fs.writeFile(
      realBinary,
      "#!/usr/bin/env node\nconsole.log('fake');\n",
      "utf-8",
    );
    await fs.chmod(realBinary, 0o755);

    // Create a .bin/devflow symlink pointing into _npx
    const nodeModulesBin = path.join(tmpDir, "node_modules", ".bin");
    await fs.mkdir(nodeModulesBin, { recursive: true });
    await fs.symlink(realBinary, path.join(nodeModulesBin, "devflow"));

    // No persistent PATH binary, no package.json dep
    process.env.PATH = "/usr/bin:/bin";

    _resetCache();
    const result = await resolveInvocationCommand(tmpDir);
    // The .bin/devflow resolves to an _npx path → should fall through to 'none'
    expect(result.mode).toBe("none");
    expect(result.command).toBe("npx -y @tjsasakinpm/devflow@latest");
  });

  it("should accept global devflow in a normal PATH directory", async () => {
    // Normal directory (not _npx) with devflow binary
    const normalBinDir = path.join(tmpDir, "usr", "local", "bin");
    await fs.mkdir(normalBinDir, { recursive: true });
    await fs.writeFile(
      path.join(normalBinDir, "devflow"),
      "#!/usr/bin/env node\nconsole.log('real');\n",
      "utf-8",
    );
    await fs.chmod(path.join(normalBinDir, "devflow"), 0o755);

    // No local .bin, no package.json dep
    process.env.PATH = normalBinDir + path.delimiter + "/usr/bin:/bin";

    _resetCache();
    const result = await resolveInvocationCommand(tmpDir);
    expect(result.mode).toBe("global");
    expect(result.command).toBe("devflow");
  });
});

describe("isNpxTempPath", () => {
  it("should detect _npx directories", () => {
    expect(isNpxTempPath("/home/user/_npx/abc123/bin/devflow")).toBe(true);
    expect(isNpxTempPath("/tmp/_npx/xyz/node_modules/.bin/devflow")).toBe(true);
  });

  it("should detect .npm/_npx directories", () => {
    expect(isNpxTempPath("/home/user/.npm/_npx/abc123/node_modules/.bin/devflow")).toBe(true);
  });

  it("should detect npm-cache/_npx directories", () => {
    expect(isNpxTempPath("/home/user/.npm/npm-cache/_npx/abc/bin/devflow")).toBe(true);
  });

  it("should not flag normal paths", () => {
    expect(isNpxTempPath("/usr/local/bin/devflow")).toBe(false);
    expect(isNpxTempPath("/home/user/project/node_modules/.bin/devflow")).toBe(false);
    expect(isNpxTempPath("/opt/devflow/bin/devflow")).toBe(false);
  });
});
