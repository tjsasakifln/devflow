/**
 * devflow tests review — Test plan vs implementation gap analysis
 *
 * Loads test-plan.md for a feature and compares against real test files
 * in the project. Detects two types of gaps:
 *   1. Tests documented in test-plan.md but missing from disk
 *   2. Tests existing on disk but not documented in test-plan.md
 *
 * Output: pipe-safe JSON via stdout, banner via stderr.
 */
import path from "node:path";
import { safeReadFile } from "../kernel/utils/fs.js";
import pc from "picocolors";

export interface TestsReviewResult {
  featureId: string;
  documentedTests: number;
  existingTestFiles: number;
  documentedButMissing: string[];
  existingButUndocumented: string[];
  coverageGapRatio: number;
  verdict: "ok" | "gaps-found" | "no-test-plan" | "no-test-files";
}

/**
 * Recursively find all test files under a root directory.
 * Matches *.test.ts, *.spec.ts, *.test.js, *.spec.js patterns.
 */
async function findTestFiles(rootPath: string): Promise<string[]> {
  const fs = await import("node:fs/promises");
  const testFiles: string[] = [];

  async function walk(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
            await walk(fullPath);
          }
        } else if (
          entry.name.endsWith(".test.ts") ||
          entry.name.endsWith(".spec.ts") ||
          entry.name.endsWith(".test.js") ||
          entry.name.endsWith(".spec.js")
        ) {
          testFiles.push(fullPath);
        }
      }
    } catch {
      // Permission errors or missing directories — skip silently
    }
  }

  // Check common test directories
  const testDirs = [
    path.join(rootPath, "test"),
    path.join(rootPath, "tests"),
    path.join(rootPath, "src", "__tests__"),
    path.join(rootPath, "src"),
  ];

  for (const dir of testDirs) {
    await walk(dir);
  }

  return testFiles;
}

/**
 * Parse test-plan.md to extract documented test names/suites.
 * Looks for:
 *   - `- Test:` or `- **Test:**` prefixes (common test-plan patterns)
 *   - `### ` heading followed by content (test suite names)
 *   - `- [ ] ` task list items describing tests
 */
function parseTestPlan(content: string): string[] {
  const documented: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Match test entries: "- Test: ..." or "- **Test:** ..."
    const testMatch = trimmed.match(/^-\s*(?:\*\*)?Test(?:\*\*)?:\s*(.+)/i);
    if (testMatch) {
      documented.push(testMatch[1]!.trim());
      continue;
    }

    // Match bullet entries that look like test descriptions
    const bulletMatch = trimmed.match(/^-\s*(?:\[.?\])\s*(.+)/);
    if (bulletMatch) {
      documented.push(bulletMatch[1]!.trim());
      continue;
    }

    // Match subheadings that could be test suite names
    const headingMatch = trimmed.match(/^###\s+(.+)/);
    if (headingMatch) {
      documented.push(headingMatch[1]!.trim());
    }
  }

  return documented.filter(Boolean);
}

/**
 * Compare a documented test name against actual test file paths.
 * Returns true if the documented name appears as a substring of any test path.
 */
function isTestImplemented(
  documentedName: string,
  testFiles: string[],
): boolean {
  const lowerName = documentedName.toLowerCase();
  // Extract the core name without prefixes like "Test: "
  const cleanName = lowerName.replace(/^(test|should|must|can)\s+/i, "");

  return testFiles.some((f) => {
    const lowerPath = path.basename(f).toLowerCase().replace(/\.(test|spec)\.(ts|js)$/, "");
    return (
      lowerPath.includes(cleanName) ||
      cleanName.includes(lowerPath) ||
      lowerPath.includes(documentedName.toLowerCase())
    );
  });
}

export async function testsReviewCommand(
  cwd: string,
  featureId: string,
): Promise<void> {
  const rootPath = path.resolve(cwd);
  const featureDir = path.join(rootPath, "_devflow", "features", featureId);
  const testPlanPath = path.join(featureDir, "test-plan.md");

  // Load test plan
  const testPlanContent = await safeReadFile(testPlanPath);

  if (!testPlanContent) {
    const result: TestsReviewResult = {
      featureId,
      documentedTests: 0,
      existingTestFiles: 0,
      documentedButMissing: [],
      existingButUndocumented: [],
      coverageGapRatio: 1,
      verdict: "no-test-plan",
    };

    console.log(JSON.stringify(result, null, 2));

    // Banner on stderr
    console.error(
      pc.yellow(`\n${pc.bold("Devflow Tests Review")}`),
    );
    console.error(pc.yellow(`  Feature: ${featureId}`));
    console.error(pc.red("  No test-plan.md found — cannot analyze coverage gaps.\n"));
    return;
  }

  // Find actual test files
  const testFiles = await findTestFiles(rootPath);

  // Parse documented tests
  const documentedTests = parseTestPlan(testPlanContent);

  // Detect gaps
  const documentedButMissing: string[] = [];
  for (const doc of documentedTests) {
    if (!isTestImplemented(doc, testFiles)) {
      documentedButMissing.push(doc);
    }
  }

  const existingButUndocumented: string[] = [];
  if (documentedTests.length > 0) {
    for (const tf of testFiles) {
      const relPath = path.relative(rootPath, tf);
      const fileName = path.basename(tf).replace(/\.(test|spec)\.(ts|js)$/, "");
      const isDocumented = documentedTests.some(
        (d) =>
          relPath.toLowerCase().includes(d.toLowerCase()) ||
          d.toLowerCase().includes(fileName.toLowerCase()),
      );
      if (!isDocumented) {
        existingButUndocumented.push(relPath);
      }
    }
  } else {
    // No documented tests — all test files are undocumented
    existingButUndocumented.push(
      ...testFiles.map((f) => path.relative(rootPath, f)),
    );
  }

  const totalExpected = Math.max(documentedTests.length, 1);
  const coverageGapRatio =
    documentedButMissing.length / totalExpected;

  let verdict: TestsReviewResult["verdict"] = "ok";
  if (testFiles.length === 0) {
    verdict = "no-test-files";
  } else if (documentedButMissing.length > 0 || existingButUndocumented.length > 0) {
    verdict = "gaps-found";
  }

  const result: TestsReviewResult = {
    featureId,
    documentedTests: documentedTests.length,
    existingTestFiles: testFiles.length,
    documentedButMissing,
    existingButUndocumented,
    coverageGapRatio,
    verdict,
  };

  // JSON output to stdout (pipe-safe)
  console.log(JSON.stringify(result, null, 2));

  // Banner to stderr
  console.error(
    pc.bold("\nDevflow Tests Review"),
  );
  console.error(pc.dim(`  Feature: ${result.featureId}`));
  console.error("");

  if (verdict === "no-test-files") {
    console.error(pc.yellow("  No test files found on disk."));
  } else if (verdict === "gaps-found") {
    console.error(
      pc.yellow(`  Found ${result.documentedButMissing.length + result.existingButUndocumented.length} gap(s):`),
    );

    if (result.documentedButMissing.length > 0) {
      console.error(pc.red(`\n  Documented but missing (${result.documentedButMissing.length}):`));
      for (const g of result.documentedButMissing) {
        console.error(pc.red(`    ✗ ${g}`));
      }
    }

    if (result.existingButUndocumented.length > 0) {
      console.error(pc.yellow(`\n  Existing but undocumented (${result.existingButUndocumented.length}):`));
      for (const g of result.existingButUndocumented) {
        console.error(pc.yellow(`    ? ${g}`));
      }
    }
  } else {
    console.error(pc.green("  All documented tests are implemented. No gaps found."));
  }

  console.error("");
}
