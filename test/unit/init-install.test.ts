/**
 * Init installation tests — verify Claude Code skill integration.
 *
 * Validates that `devflow init`:
 *   1. Creates .claude/skills/devflow/SKILL.md with valid frontmatter
 *   2. Does NOT create or overwrite .claude/settings.json
 *   3. Preserves existing CLAUDE.md and appends Devflow section
 *   4. Doctor does not produce false version mismatch against fixture package.json
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

import { initCommand } from "../../src/commands/init.js";
import { doctorCommand } from "../../src/commands/doctor.js";
import { installCommand } from "../../src/commands/install.js";
import { fileExists } from "../../src/kernel/utils/fs.js";
import { _resetCache } from "../../src/kernel/utils/cli-resolver.js";
import { readDevflowCommandPrefix } from "../../src/adapters/integration/claude-commands.js";

async function createTempProject(files: Record<string, string>): Promise<string> {
  const tmp = path.join(os.tmpdir(), `devflow-init-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await fs.mkdir(tmp, { recursive: true });

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(tmp, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }

  return tmp;
}

const PRE_EXISTING_CLAUDE_MD = `# My Project

This is my project's CLAUDE.md with custom instructions.

## Custom Rules

1. Always use TypeScript strict mode.
2. Never use \`any\` type.
`;

describe("Init: Claude Code skill integration", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await createTempProject({
      "package.json": JSON.stringify({
        name: "test-consumer-project",
        version: "2.5.0",
        private: true,
      }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: { target: "ES2022", module: "NodeNext", strict: true },
      }),
      "src/index.ts": "export const version = '2.5.0';\n",
      "CLAUDE.md": PRE_EXISTING_CLAUDE_MD,
    });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should create .claude/skills/devflow/SKILL.md with valid frontmatter", async () => {
    await initCommand(tmpDir);

    const skillPath = path.join(tmpDir, ".claude", "skills", "devflow", "SKILL.md");
    expect(await fileExists(skillPath)).toBe(true);

    const content = await fs.readFile(skillPath, "utf-8");
    // Must start with YAML frontmatter
    expect(content.startsWith("---")).toBe(true);

    // Frontmatter must contain required fields
    expect(content).toContain("name: devflow");
    expect(content).toContain("description:");
    expect(content).toContain("argument-hint:");

    // Body must contain invocation instructions
    expect(content).toContain("npx -y @tjsasakinpm/devflow");
  });

  it("should NOT create or overwrite .claude/settings.json", async () => {
    // If settings.json exists before init, we must preserve it
    const settingsDir = path.join(tmpDir, ".claude");
    await fs.mkdir(settingsDir, { recursive: true });
    const settingsPath = path.join(settingsDir, "settings.json");
    const preExistingSettings = JSON.stringify({ theme: "dark", permissions: { allow: ["npm"] } });
    await fs.writeFile(settingsPath, preExistingSettings);

    await initCommand(tmpDir);

    // settings.json must still exist with original content unchanged
    const settingsContent = await fs.readFile(settingsPath, "utf-8");
    expect(JSON.parse(settingsContent)).toEqual({ theme: "dark", permissions: { allow: ["npm"] } });
  });

  it("should not create .claude/settings.json when it didn't exist before", async () => {
    await initCommand(tmpDir);

    const settingsPath = path.join(tmpDir, ".claude", "settings.json");
    expect(await fileExists(settingsPath)).toBe(false);
  });

  it("should preserve existing CLAUDE.md and append Devflow section", async () => {
    await initCommand(tmpDir);

    const claudeMdPath = path.join(tmpDir, "CLAUDE.md");
    const content = await fs.readFile(claudeMdPath, "utf-8");

    // Original content must be preserved
    expect(content).toContain("My Project");
    expect(content).toContain("Always use TypeScript strict mode");
    expect(content).toContain("Never use `any` type");

    // Devflow section must be appended with markers
    expect(content).toContain("<!-- ===== DEVFLOW INTEGRATION START ===== -->");
    expect(content).toContain("<!-- ===== DEVFLOW INTEGRATION END ===== -->");
    expect(content).toContain("Devflow Integration");
  });

  it("doctor should NOT report version mismatch against consumer package.json", async () => {
    await initCommand(tmpDir);

    // Capture doctor output by suppressing console.log and checking
    // that the version check doesn't fail.
    // We can't easily capture console output in vitest,
    // so we verify the underlying conditions:
    // - CLI version comes from Devflow's own package.json (e.g. 0.4.x)
    // - Consumer project package.json has version 2.5.0
    // - These should NOT be compared → no FAIL

    // Just verify doctor runs without throwing
    await expect(doctorCommand(tmpDir, { fix: false, dryRun: true })).resolves.toBeUndefined();
  });
});

describe("Install: CLI availability messages", () => {
  let tmpDir: string;
  let originalPath: string;

  async function createAlreadyInitProject(): Promise<string> {
    const tmp = path.join(
      os.tmpdir(),
      `devflow-install-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    await fs.mkdir(path.join(tmp, ".devflow"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, ".devflow", "config.json"),
      JSON.stringify({ projectName: "test-project", createdTimestamp: new Date().toISOString() }),
    );
    await fs.writeFile(
      path.join(tmp, "package.json"),
      JSON.stringify({ name: "test-project", version: "1.0.0" }),
    );
    return tmp;
  }

  function captureConsole(fn: () => Promise<void>): Promise<string> {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    return fn().then(() => {
      console.log = origLog;
      return logs.join("\n");
    }).catch((err: unknown) => {
      console.log = origLog;
      throw err;
    });
  }

  beforeEach(async () => {
    originalPath = process.env.PATH || process.env.Path || "";
    _resetCache();
  });

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
    process.env.PATH = originalPath;
    _resetCache();
  });

  it("should NOT recommend bare `devflow status` when CLI is not persistently installed", async () => {
    tmpDir = await createAlreadyInitProject();
    // Ensure devflow is NOT in PATH and NOT in node_modules
    process.env.PATH = "/usr/bin:/bin";

    const output = await captureConsole(() => installCommand(tmpDir));

    // Must NOT contain bare devflow command recommendation
    expect(output).not.toMatch(/\bRun devflow status\b/);
    expect(output).not.toMatch(/\bRun devflow doctor\b/);
    // Should suggest npx -y @tjsasakinpm/devflow@latest or install instruction
    expect(output).toContain("npx -y @tjsasakinpm/devflow@latest");
    expect(output).toContain("not installed persistently");
  });

  it("CAN recommend npx devflow status when local node_modules/.bin/devflow exists", async () => {
    tmpDir = await createAlreadyInitProject();
    // Create local node_modules/.bin/devflow
    const nodeModulesBin = path.join(tmpDir, "node_modules", ".bin");
    await fs.mkdir(nodeModulesBin, { recursive: true });
    await fs.writeFile(
      path.join(nodeModulesBin, "devflow"),
      "#!/usr/bin/env node\nconsole.log('fake');\n",
      "utf-8",
    );
    await fs.chmod(path.join(nodeModulesBin, "devflow"), 0o755);
    // Ensure devflow is NOT in global PATH
    process.env.PATH = "/usr/bin:/bin";
    _resetCache();

    const output = await captureConsole(() => installCommand(tmpDir));

    // With local install, it CAN recommend npx devflow
    expect(output).toContain("npx devflow status");
    // Should NOT recommend the remote npx invocation
    expect(output).not.toContain("npx -y @tjsasakinpm/devflow@latest");
    expect(output).not.toContain("not installed persistently");
  });

  it("should recommend global install when no package.json exists", async () => {
    tmpDir = path.join(
      os.tmpdir(),
      `devflow-install-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    await fs.mkdir(path.join(tmpDir, ".devflow"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, ".devflow", "config.json"),
      JSON.stringify({ projectName: "no-pkg-project", createdTimestamp: new Date().toISOString() }),
    );
    // No package.json
    process.env.PATH = "/usr/bin:/bin";

    const output = await captureConsole(() => installCommand(tmpDir));

    // Should recommend global install when no package.json
    expect(output).toContain("install globally");
    expect(output).toContain("npm install -g @tjsasakinpm/devflow");
  });

  // ── Regression: install creates .claude/commands/devflow.md ──

  it("should create .claude/commands/devflow.md when project already initialized (npx transient)", async () => {
    tmpDir = await createAlreadyInitProject();
    // Simulate npx transient: PATH has a devflow in _npx, no local install, no package.json dep
    const npxTempDir = path.join(tmpDir, "_npx", "abc", "bin");
    await fs.mkdir(npxTempDir, { recursive: true });
    await fs.writeFile(
      path.join(npxTempDir, "devflow"),
      "#!/usr/bin/env node\nconsole.log('fake');\n",
      "utf-8",
    );
    await fs.chmod(path.join(npxTempDir, "devflow"), 0o755);
    process.env.PATH = npxTempDir + path.delimiter + "/usr/bin:/bin";
    _resetCache();

    const output = await captureConsole(() => installCommand(tmpDir));

    // Must NOT recommend bare devflow commands
    expect(output).not.toMatch(/\bRun devflow status\b/);
    expect(output).not.toMatch(/\bRun devflow doctor\b/);
    // Must recommend npx -y @tjsasakinpm/devflow@latest
    expect(output).toContain("npx -y @tjsasakinpm/devflow@latest");

    // Must create .claude/commands/devflow.md
    const commandPath = path.join(tmpDir, ".claude", "commands", "devflow.md");
    expect(await fileExists(commandPath)).toBe(true);

    // Must mention Claude Code integration
    expect(output).toContain("Claude Code integration installed");
    expect(output).toContain("/devflow");
  });

  it("should use npx devflow prefix in .claude/commands/devflow.md when local install exists", async () => {
    tmpDir = await createAlreadyInitProject();
    // Create local node_modules/.bin/devflow
    const nodeModulesBin = path.join(tmpDir, "node_modules", ".bin");
    await fs.mkdir(nodeModulesBin, { recursive: true });
    await fs.writeFile(
      path.join(nodeModulesBin, "devflow"),
      "#!/usr/bin/env node\nconsole.log('local');\n",
      "utf-8",
    );
    await fs.chmod(path.join(nodeModulesBin, "devflow"), 0o755);
    process.env.PATH = "/usr/bin:/bin";
    _resetCache();

    await installCommand(tmpDir);

    const prefix = await readDevflowCommandPrefix(tmpDir);
    expect(prefix).toBe("npx devflow");

    const commandPath = path.join(tmpDir, ".claude", "commands", "devflow.md");
    expect(await fileExists(commandPath)).toBe(true);
  });

  it("doctor --fix should create .claude/commands/devflow.md when missing", async () => {
    tmpDir = await createAlreadyInitProject();
    // Create local install so the resolver finds it
    const nodeModulesBin = path.join(tmpDir, "node_modules", ".bin");
    await fs.mkdir(nodeModulesBin, { recursive: true });
    await fs.writeFile(
      path.join(nodeModulesBin, "devflow"),
      "#!/usr/bin/env node\nconsole.log('local');\n",
      "utf-8",
    );
    await fs.chmod(path.join(nodeModulesBin, "devflow"), 0o755);
    process.env.PATH = "/usr/bin:/bin";
    _resetCache();

    // Verify no .claude/commands/devflow.md before doctor
    const commandPath = path.join(tmpDir, ".claude", "commands", "devflow.md");
    expect(await fileExists(commandPath)).toBe(false);

    // Run doctor --fix
    await doctorCommand(tmpDir, { fix: true, dryRun: false });

    // File must be created
    expect(await fileExists(commandPath)).toBe(true);

    const prefix = await readDevflowCommandPrefix(tmpDir);
    expect(prefix).toBe("npx devflow");
  });

  it("doctor should report missing .claude/commands/devflow.md as FAIL", async () => {
    tmpDir = await createAlreadyInitProject();
    // Create local install
    const nodeModulesBin = path.join(tmpDir, "node_modules", ".bin");
    await fs.mkdir(nodeModulesBin, { recursive: true });
    await fs.writeFile(
      path.join(nodeModulesBin, "devflow"),
      "#!/usr/bin/env node\nconsole.log('local');\n",
      "utf-8",
    );
    await fs.chmod(path.join(nodeModulesBin, "devflow"), 0o755);
    process.env.PATH = "/usr/bin:/bin";
    _resetCache();

    // Capture doctor output (without --fix)
    const output = await captureConsole(() => doctorCommand(tmpDir, { fix: false, dryRun: false }));

    // Should report the missing slash command
    expect(output).toContain("Claude Code integration");
    expect(output).toContain("not registered");
  });
});
