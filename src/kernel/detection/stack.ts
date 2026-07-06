import path from "node:path";
import { fileExists } from "../utils/fs.js";

/**
 * Profile of a project's technology stack.
 *
 * Computed once during project inspection and propagated through
 * ProjectInspection. Used by DoD checks, cockpit generation, and
 * the implementation prompt generator to emit stack-appropriate
 * commands instead of hardcoded TypeScript tooling.
 */
export interface StackProfile {
  /** Primary programming language */
  language:
    | "typescript"
    | "javascript"
    | "python"
    | "go"
    | "rust"
    | "ruby"
    | "php"
    | "java"
    | "unknown";

  /** Test framework with canonical CLI invocation */
  testFramework: string | null;
  /** Test framework command (e.g. "npx vitest run") */
  testCommand: string | null;

  /** Linter name */
  linter: string | null;
  /** Linter command (e.g. "npx eslint src/") */
  lintCommand: string | null;

  /** Type checker name (if applicable) */
  typeChecker: string | null;
  /** Type checker command (e.g. "npx tsc --noEmit") */
  typeCheckCommand: string | null;

  /** Code formatter */
  formatter: string | null;

  /** Package manager */
  packageManager: "npm" | "yarn" | "pnpm" | "pip" | "go" | "cargo" | "bundler" | "composer" | null;

  /** Whether the project uses Docker */
  hasDocker: boolean;

  /** Whether CI configuration was detected */
  hasCI: boolean;
  /** CI provider if detected */
  ciProvider: "github-actions" | "gitlab-ci" | "circle-ci" | null;

  /** Source directory convention */
  sourceDir: string;
  /** Test directory convention */
  testDir: string;
}

const DEFAULT_PROFILE: StackProfile = {
  language: "unknown",
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

/**
 * Detect the full stack profile from project root.
 */
export async function detectStackProfile(rootPath: string): Promise<StackProfile> {
  const profile: StackProfile = { ...DEFAULT_PROFILE };

  // --- Language detection (order matters: most-specific first) ---
  if (await fileExists(path.join(rootPath, "tsconfig.json"))) {
    profile.language = "typescript";
  } else if (await fileExists(path.join(rootPath, "package.json"))) {
    profile.language = "javascript";
  } else if (
    (await fileExists(path.join(rootPath, "pyproject.toml"))) ||
    (await fileExists(path.join(rootPath, "requirements.txt"))) ||
    (await fileExists(path.join(rootPath, "setup.py")))
  ) {
    profile.language = "python";
  } else if (await fileExists(path.join(rootPath, "go.mod"))) {
    profile.language = "go";
  } else if (await fileExists(path.join(rootPath, "Cargo.toml"))) {
    profile.language = "rust";
  } else if (await fileExists(path.join(rootPath, "Gemfile"))) {
    profile.language = "ruby";
  } else if (await fileExists(path.join(rootPath, "composer.json"))) {
    profile.language = "php";
  } else if (
    (await fileExists(path.join(rootPath, "pom.xml"))) ||
    (await fileExists(path.join(rootPath, "build.gradle")))
  ) {
    profile.language = "java";
  }

  // --- Package manager ---
  if (await fileExists(path.join(rootPath, "pnpm-lock.yaml"))) {
    profile.packageManager = "pnpm";
  } else if (await fileExists(path.join(rootPath, "yarn.lock"))) {
    profile.packageManager = "yarn";
  } else if (await fileExists(path.join(rootPath, "package-lock.json"))) {
    profile.packageManager = "npm";
  } else if (await fileExists(path.join(rootPath, "package.json"))) {
    profile.packageManager = "npm";
  } else if (await fileExists(path.join(rootPath, "Pipfile"))) {
    profile.packageManager = "pip";
  } else if (await fileExists(path.join(rootPath, "go.mod"))) {
    profile.packageManager = "go";
  } else if (await fileExists(path.join(rootPath, "Cargo.toml"))) {
    profile.packageManager = "cargo";
  } else if (await fileExists(path.join(rootPath, "Gemfile.lock"))) {
    profile.packageManager = "bundler";
  } else if (await fileExists(path.join(rootPath, "composer.lock"))) {
    profile.packageManager = "composer";
  }

  // --- Stack-specific tool detection ---
  await detectStackTools(rootPath, profile);

  // --- Docker ---
  profile.hasDocker = await fileExists(path.join(rootPath, "Dockerfile"));

  // --- CI ---
  if (await fileExists(path.join(rootPath, ".github", "workflows"))) {
    profile.hasCI = true;
    profile.ciProvider = "github-actions";
  } else if (await fileExists(path.join(rootPath, ".gitlab-ci.yml"))) {
    profile.hasCI = true;
    profile.ciProvider = "gitlab-ci";
  } else if (await fileExists(path.join(rootPath, ".circleci"))) {
    profile.hasCI = true;
    profile.ciProvider = "circle-ci";
  }

  // --- Source/test directory convention ---
  if (profile.language === "python") {
    profile.sourceDir = "src";
    profile.testDir = "tests";
  } else if (profile.language === "go") {
    profile.sourceDir = ".";
    profile.testDir = ".";
  } else if (profile.language === "rust") {
    profile.sourceDir = "src";
    profile.testDir = "tests";
  } else if (profile.language === "ruby") {
    profile.sourceDir = "lib";
    profile.testDir = "spec";
  } else if (profile.language === "php") {
    profile.sourceDir = "src";
    profile.testDir = "tests";
  } else if (profile.language === "java") {
    profile.sourceDir = "src/main/java";
    profile.testDir = "src/test/java";
  }

  return profile;
}

async function detectStackTools(
  rootPath: string,
  profile: StackProfile,
): Promise<void> {
  switch (profile.language) {
    case "typescript":
    case "javascript":
      // Test framework: vitest > jest > mocha
      if (await fileExists(path.join(rootPath, "vitest.config.ts"))) {
        profile.testFramework = "vitest";
        profile.testCommand = "npx vitest run";
      } else if (await fileExists(path.join(rootPath, "vitest.config.js"))) {
        profile.testFramework = "vitest";
        profile.testCommand = "npx vitest run";
      } else if (await fileExists(path.join(rootPath, "jest.config.ts"))) {
        profile.testFramework = "jest";
        profile.testCommand = "npx jest";
      } else if (await fileExists(path.join(rootPath, "jest.config.js"))) {
        profile.testFramework = "jest";
        profile.testCommand = "npx jest";
      } else if (profile.packageManager) {
        // Check scripts in package.json
        profile.testFramework = "npm test";
        profile.testCommand = "npm test";
      }

      // Linter: eslint > prettier
      if (
        (await fileExists(path.join(rootPath, ".eslintrc.js"))) ||
        (await fileExists(path.join(rootPath, ".eslintrc.json"))) ||
        (await fileExists(path.join(rootPath, ".eslintrc.yaml"))) ||
        (await fileExists(path.join(rootPath, "eslint.config.js"))) ||
        (await fileExists(path.join(rootPath, "eslint.config.mjs")))
      ) {
        profile.linter = "eslint";
        profile.lintCommand = "npx eslint src/";
      }

      // Typechecker
      if (await fileExists(path.join(rootPath, "tsconfig.json"))) {
        profile.typeChecker = "tsc";
        profile.typeCheckCommand = "npx tsc --noEmit";
      }

      // Formatter
      if (await fileExists(path.join(rootPath, ".prettierrc"))) {
        profile.formatter = "prettier";
      }
      break;

    case "python":
      // Test framework: pytest > unittest
      if (
        (await fileExists(path.join(rootPath, "pytest.ini"))) ||
        (await fileExists(path.join(rootPath, "pyproject.toml")))
      ) {
        profile.testFramework = "pytest";
        profile.testCommand = "python -m pytest";
      } else {
        profile.testFramework = "pytest";
        profile.testCommand = "python -m pytest";
      }

      // Linter: ruff > flake8 > pylint
      if (await fileExists(path.join(rootPath, "ruff.toml"))) {
        profile.linter = "ruff";
        profile.lintCommand = "ruff check src/";
      } else if (await fileExists(path.join(rootPath, ".flake8"))) {
        profile.linter = "flake8";
        profile.lintCommand = "flake8 src/";
      } else {
        profile.linter = "ruff";
        profile.lintCommand = "ruff check src/";
      }

      // Typechecker: mypy > pyright
      profile.typeChecker = "mypy";
      profile.typeCheckCommand = "python -m mypy src/";

      // Formatter
      profile.formatter = "black";
      break;

    case "go":
      profile.testFramework = "go test";
      profile.testCommand = "go test ./...";
      profile.linter = "golangci-lint";
      profile.lintCommand = "golangci-lint run ./...";
      profile.typeChecker = null; // go build catches type errors
      profile.typeCheckCommand = null;
      profile.formatter = "gofmt";
      break;

    case "rust":
      profile.testFramework = "cargo test";
      profile.testCommand = "cargo test";
      profile.linter = "clippy";
      profile.lintCommand = "cargo clippy -- -D warnings";
      profile.typeChecker = null; // rustc handles type checking
      profile.typeCheckCommand = null;
      profile.formatter = "rustfmt";
      break;

    case "ruby":
      profile.testFramework = "rspec";
      profile.testCommand = "bundle exec rspec";
      profile.linter = "rubocop";
      profile.lintCommand = "rubocop";
      profile.typeChecker = null;
      profile.typeCheckCommand = null;
      profile.formatter = "rubocop";
      break;

    case "php":
      profile.testFramework = "phpunit";
      profile.testCommand = "vendor/bin/phpunit";
      profile.linter = "php-cs-fixer";
      profile.lintCommand = "vendor/bin/php-cs-fixer check src/";
      profile.typeChecker = "phpstan";
      profile.typeCheckCommand = "vendor/bin/phpstan analyse src/";
      profile.formatter = "php-cs-fixer";
      break;

    case "java":
      profile.testFramework = "maven";
      profile.testCommand = "mvn test";
      profile.linter = "checkstyle";
      profile.lintCommand = "mvn checkstyle:check";
      profile.typeChecker = null;
      profile.typeCheckCommand = null;
      profile.formatter = "spotless";
      break;

    default:
      // Unknown stack — leave everything null
      break;
  }
}

/**
 * Return the effective test command for the given profile.
 * Falls back to "npm test" for Node projects, null otherwise.
 */
export function getTestCommand(profile: StackProfile): string | null {
  return profile.testCommand;
}

/**
 * Return the effective lint command for the given profile.
 */
export function getLintCommand(profile: StackProfile): string | null {
  return profile.lintCommand;
}

/**
 * Return the effective typecheck command for the given profile.
 */
export function getTypeCheckCommand(profile: StackProfile): string | null {
  return profile.typeCheckCommand;
}
