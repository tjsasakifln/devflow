import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";

const mockFileExists = vi.hoisted(() => vi.fn());
vi.mock("../../src/kernel/utils/fs.js", () => ({
  fileExists: mockFileExists,
  safeReadFile: vi.fn().mockResolvedValue(""),
}));

import { detectStackProfile, getTestCommand, getLintCommand, getTypeCheckCommand } from "../../src/kernel/detection/stack.js";

describe("detectStackProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no files exist
    mockFileExists.mockResolvedValue(false);
  });

  it("detects TypeScript with tsconfig.json", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("tsconfig.json") ||
        filePath.endsWith("vitest.config.ts") ||
        filePath.endsWith("package-lock.json") ||
        filePath.endsWith(".eslintrc.js");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.language).toBe("typescript");
    expect(profile.packageManager).toBe("npm");
    expect(profile.testFramework).toBe("vitest");
    expect(profile.testCommand).toBe("npx vitest run");
    expect(profile.linter).toBe("eslint");
    expect(profile.typeChecker).toBe("tsc");
  });

  it("detects JavaScript with package.json only", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("package.json") || filePath.endsWith("yarn.lock");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.language).toBe("javascript");
    expect(profile.packageManager).toBe("yarn");
  });

  it("detects Python with pyproject.toml", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("pyproject.toml") ||
        filePath.endsWith("ruff.toml");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.language).toBe("python");
    expect(profile.linter).toBe("ruff");
    expect(profile.sourceDir).toBe("src");
    expect(profile.testDir).toBe("tests");
  });

  it("detects Python with requirements.txt", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("requirements.txt") ||
        filePath.endsWith(".flake8");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.language).toBe("python");
    expect(profile.linter).toBe("flake8");
  });

  it("detects Python with setup.py", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("setup.py") ||
        filePath.endsWith("pytest.ini");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.language).toBe("python");
    expect(profile.testFramework).toBe("pytest");
  });

  it("detects Go with go.mod", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("go.mod");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.language).toBe("go");
    expect(profile.packageManager).toBe("go");
    expect(profile.testCommand).toBe("go test ./...");
    expect(profile.sourceDir).toBe(".");
    expect(profile.testDir).toBe(".");
  });

  it("detects Rust with Cargo.toml", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("Cargo.toml");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.language).toBe("rust");
    expect(profile.packageManager).toBe("cargo");
    expect(profile.testCommand).toBe("cargo test");
    expect(profile.linter).toBe("clippy");
  });

  it("detects Ruby with Gemfile", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("Gemfile") || filePath.endsWith("Gemfile.lock");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.language).toBe("ruby");
    expect(profile.packageManager).toBe("bundler");
    expect(profile.testCommand).toBe("bundle exec rspec");
    expect(profile.sourceDir).toBe("lib");
    expect(profile.testDir).toBe("spec");
  });

  it("detects PHP with composer.json", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("composer.json") || filePath.endsWith("composer.lock");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.language).toBe("php");
    expect(profile.packageManager).toBe("composer");
    expect(profile.testCommand).toBe("vendor/bin/phpunit");
    expect(profile.typeChecker).toBe("phpstan");
  });

  it("detects Java with pom.xml", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("pom.xml");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.language).toBe("java");
    expect(profile.testCommand).toBe("mvn test");
    expect(profile.sourceDir).toBe("src/main/java");
    expect(profile.testDir).toBe("src/test/java");
  });

  it("detects Java with build.gradle", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("build.gradle");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.language).toBe("java");
  });

  it("returns unknown for unrecognized project", async () => {
    // No files exist (all mocked to false)
    const profile = await detectStackProfile("/empty");
    expect(profile.language).toBe("unknown");
    expect(profile.packageManager).toBeNull();
    expect(profile.testFramework).toBeNull();
  });

  it("detects Docker", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("Dockerfile");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.hasDocker).toBe(true);
  });

  it("detects GitHub Actions CI", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("workflows") || filePath.includes(".github/workflows");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.hasCI).toBe(true);
    expect(profile.ciProvider).toBe("github-actions");
  });

  it("detects GitLab CI", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith(".gitlab-ci.yml");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.hasCI).toBe(true);
    expect(profile.ciProvider).toBe("gitlab-ci");
  });

  it("detects CircleCI", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith(".circleci");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.hasCI).toBe(true);
    expect(profile.ciProvider).toBe("circle-ci");
  });

  it("detects pnpm as package manager", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("pnpm-lock.yaml");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.packageManager).toBe("pnpm");
  });

  it("detects jest test framework when no vitest config", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("tsconfig.json") ||
        filePath.endsWith("jest.config.ts") ||
        filePath.endsWith("package-lock.json") ||
        filePath.endsWith(".prettierrc");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.language).toBe("typescript");
    expect(profile.testFramework).toBe("jest");
    expect(profile.testCommand).toBe("npx jest");
    expect(profile.formatter).toBe("prettier");
  });

  it("detects mocha when no dedicated test config but has packageManager", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("tsconfig.json") ||
        filePath.endsWith("package-lock.json");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.language).toBe("typescript");
    // With no vitest or jest config but has packageManager
    expect(profile.testFramework).toBe("npm test");
    expect(profile.testCommand).toBe("npm test");
  });

  it("detects eslint config in yaml format", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("tsconfig.json") ||
        filePath.endsWith("vitest.config.ts") ||
        filePath.endsWith("package-lock.json") ||
        filePath.endsWith(".eslintrc.yaml");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.linter).toBe("eslint");
  });

  it("detects eslint config as eslint.config.mjs", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("tsconfig.json") ||
        filePath.endsWith("vitest.config.ts") ||
        filePath.endsWith("package-lock.json") ||
        filePath.endsWith("eslint.config.mjs");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.linter).toBe("eslint");
  });

  it("detects vitest.config.js (not .ts)", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("tsconfig.json") ||
        filePath.endsWith("vitest.config.js") ||
        filePath.endsWith("package-lock.json");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.testFramework).toBe("vitest");
  });

  it("detects jest.config.js (not .ts)", async () => {
    mockFileExists.mockImplementation(async (filePath: string) => {
      return filePath.endsWith("tsconfig.json") ||
        filePath.endsWith("jest.config.js") ||
        filePath.endsWith("package-lock.json");
    });

    const profile = await detectStackProfile("/project");
    expect(profile.testFramework).toBe("jest");
  });
});

describe("getTestCommand", () => {
  it("returns the test command from the profile", () => {
    const profile = {
      language: "go" as const,
      testFramework: "go test",
      testCommand: "go test ./...",
      linter: "golangci-lint",
      lintCommand: "golangci-lint run ./...",
      typeChecker: null,
      typeCheckCommand: null,
      formatter: "gofmt",
      packageManager: "go" as const,
      hasDocker: false,
      hasCI: false,
      ciProvider: null,
      sourceDir: ".",
      testDir: ".",
    };
    expect(getTestCommand(profile)).toBe("go test ./...");
  });

  it("returns null for profile with no test command", () => {
    const profile = {
      language: "unknown" as const,
      testFramework: null,
      testCommand: null,
      linter: null,
      lintCommand: null,
      typeChecker: null,
      typeCheckCommand: null,
      formatter: null,
      packageManager: null,
      hasDocker: false,
      hasCI: false,
      ciProvider: null,
      sourceDir: "src",
      testDir: "test",
    };
    expect(getTestCommand(profile)).toBeNull();
  });
});

describe("getLintCommand", () => {
  it("returns the lint command", () => {
    const profile = {
      language: "typescript" as const,
      testFramework: null,
      testCommand: null,
      linter: "eslint",
      lintCommand: "npx eslint src/",
      typeChecker: null,
      typeCheckCommand: null,
      formatter: null,
      packageManager: "npm" as const,
      hasDocker: false,
      hasCI: false,
      ciProvider: null,
      sourceDir: "src",
      testDir: "test",
    };
    expect(getLintCommand(profile)).toBe("npx eslint src/");
  });
});

describe("getTypeCheckCommand", () => {
  it("returns the typecheck command", () => {
    const profile = {
      language: "typescript" as const,
      testFramework: null,
      testCommand: null,
      linter: null,
      lintCommand: null,
      typeChecker: "tsc",
      typeCheckCommand: "npx tsc --noEmit",
      formatter: null,
      packageManager: null,
      hasDocker: false,
      hasCI: false,
      ciProvider: null,
      sourceDir: "src",
      testDir: "test",
    };
    expect(getTypeCheckCommand(profile)).toBe("npx tsc --noEmit");
  });

  it("returns null for Go profile", () => {
    const profile = {
      language: "go" as const,
      testFramework: null,
      testCommand: null,
      linter: null,
      lintCommand: null,
      typeChecker: null,
      typeCheckCommand: null,
      formatter: null,
      packageManager: null,
      hasDocker: false,
      hasCI: false,
      ciProvider: null,
      sourceDir: ".",
      testDir: ".",
    };
    expect(getTypeCheckCommand(profile)).toBeNull();
  });
});
