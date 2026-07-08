import path from "node:path";
import fs from "node:fs/promises";
import pc from "picocolors";

// ── Types ──

export interface RequirementsAuditIssue {
  category: "clarity" | "coverage" | "testability";
  severity: "error" | "warning" | "info";
  description: string;
  line?: number;
  suggestion: string;
}

export interface RequirementsAuditResult {
  score: number; // 0-100
  maxScore: number;
  issues: RequirementsAuditIssue[];
  summary: {
    clarity: { score: number; max: number };
    coverage: { score: number; max: number };
    testability: { score: number; max: number };
  };
  featureId: string;
}

// ── Checks ──

interface CheckResult {
  issues: RequirementsAuditIssue[];
  score: number;
  max: number;
}

function checkClarity(content: string, lines: string[]): CheckResult {
  const issues: RequirementsAuditIssue[] = [];
  let score = 0;
  const max = 30;

  // Check for very long lines (>120 chars) — hard to read
  let longLineCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.length > 120 && !line.startsWith("|") && !line.startsWith("```")) {
      longLineCount++;
      if (longLineCount <= 3) {
        issues.push({
          category: "clarity",
          severity: "warning",
          description: `Line ${i + 1} is ${line.length} characters long (max recommended: 120)`,
          line: i + 1,
          suggestion: "Break long sentences into shorter ones or use bullet points.",
        });
      }
    }
  }
  score += longLineCount === 0 ? 10 : Math.max(0, 10 - longLineCount);

  // Check for bullet points / structured lists
  const bulletCount = (content.match(/^\s*[-*]\s/gm) || []).length;
  const numberedCount = (content.match(/^\s*\d+\.\s/gm) || []).length;
  const hasStructure = bulletCount > 0 || numberedCount > 0;
  if (!hasStructure) {
    issues.push({
      category: "clarity",
      severity: "warning",
      description: "No bullet points or numbered lists found — requirements should be structured",
      suggestion: "Use bullet points (-) or numbered lists (1.) to organize requirements.",
    });
  }
  score += hasStructure ? 10 : 0;

  // Check for section headings
  const headingCount = (content.match(/^##+\s/gm) || []).length;
  if (headingCount < 2) {
    issues.push({
      category: "clarity",
      severity: "warning",
      description: `Only ${headingCount} section heading(s) found — requirements need clear sections`,
      suggestion: "Add ## sections to organize requirements (e.g., ## Overview, ## Functional Requirements).",
    });
  }
  score += headingCount >= 2 ? 10 : Math.max(0, headingCount * 3);

  return { issues, score, max };
}

function checkCoverage(content: string, _lines: string[]): CheckResult {
  const issues: RequirementsAuditIssue[] = [];
  let score = 0;
  const max = 40;

  // Check for FR-* (functional requirement) references
  const frMatches = content.match(/FR-\d+/g) || [];
  if (frMatches.length === 0) {
    issues.push({
      category: "coverage",
      severity: "error",
      description: "No functional requirement identifiers found (FR-1, FR-2, etc.)",
      suggestion: "Tag each requirement with FR-N identifiers for traceability.",
    });
    score += 0;
  } else {
    score += Math.min(15, frMatches.length * 2);
  }

  // Check for NFR-* (non-functional requirement) references
  const nfrMatches = content.match(/NFR-\d+/g) || [];
  if (nfrMatches.length === 0) {
    issues.push({
      category: "coverage",
      severity: "warning",
      description: "No non-functional requirement identifiers found (NFR-1, etc.)",
      suggestion: "Consider adding non-functional requirements (performance, security, etc.).",
    });
  } else {
    score += Math.min(10, nfrMatches.length * 3);
  }

  // Check content length — very short docs likely miss coverage
  const textContent = content.replace(/```[\s\S]*?```/g, "").replace(/#+\s+/g, "");
  const wordCount = textContent.split(/\s+/).filter(Boolean).length;
  if (wordCount < 50) {
    issues.push({
      category: "coverage",
      severity: "error",
      description: `Very short document (${wordCount} words) — likely missing requirements coverage`,
      suggestion: "Expand requirements to cover all functional and non-functional aspects.",
    });
  } else {
    score += 10;
  }

  // Check for undefined/abstract terms
  const vagueTerms = ["etc", "and so on", "various", "appropriate", "as needed", "maybe", "might", "could"];
  for (const term of vagueTerms) {
    const regex = new RegExp(`\\b${term}\\b`, "gi");
    const matches = content.match(regex);
    if (matches) {
      issues.push({
        category: "coverage",
        severity: "warning",
        description: `Vague term "${term}" found ${matches.length} time(s)`,
        suggestion: `Replace "${term}" with specific, measurable language.`,
      });
      score = Math.max(0, score - 2);
    }
  }

  // Check for measurable criteria
  const measurablePatterns = [/\d+%/g, /\d+ ms/g, /\d+ seconds?/g, /\d+ requests?/g, "concurrent", "maximum", "minimum"];
  const hasMeasurable = measurablePatterns.some((p) =>
    typeof p === "string" ? content.toLowerCase().includes(p) : p.test(content),
  );
  if (!hasMeasurable) {
    issues.push({
      category: "coverage",
      severity: "warning",
      description: "No measurable criteria found (e.g., percentages, time limits, concurrency)",
      suggestion: "Add measurable targets: response times, throughput, uptime percentages.",
    });
  } else {
    score += 5;
  }

  return { issues, score, max };
}

function checkTestability(content: string, _lines: string[]): CheckResult {
  const issues: RequirementsAuditIssue[] = [];
  let score = 0;
  const max = 30;

  // Check for Given/When/Then patterns
  const gwtCount = (content.match(/\b(Given|When|Then)\b/g) || []).length;
  if (gwtCount === 0) {
    issues.push({
      category: "testability",
      severity: "warning",
      description: "No Given/When/Then patterns found",
      suggestion: "Use Given/When/Then format for acceptance criteria to improve testability.",
    });
  } else {
    score += Math.min(15, gwtCount * 3);
  }

  // Check for "should" statements (testable)
  const shouldCount = (content.match(/\bshould\b/gi) || []).length;
  if (shouldCount < 3) {
    issues.push({
      category: "testability",
      severity: "info",
      description: `Only ${shouldCount} "should" statement(s) found`,
      suggestion: 'Use "should" statements to define expected behavior (e.g., "The system should...").',
    });
  }
  score += Math.min(10, shouldCount * 2);

  // Check for "test" or "verify" mentions
  const testWords = (content.match(/\b(test|verify|validate|check)\b/gi) || []).length;
  if (testWords === 0) {
    issues.push({
      category: "testability",
      severity: "info",
      description: 'No "test", "verify", or "validate" keywords found',
      suggestion: "Mention how each requirement will be tested or verified.",
    });
  }
  score += testWords >= 2 ? 5 : 0;

  return { issues, score, max };
}

// ── Main command ──

export interface RequirementsAuditOptions {
  featureId: string;
}

export async function requirementsAuditCommand(
  cwd: string,
  options: RequirementsAuditOptions,
): Promise<void> {
  const rootPath = path.resolve(cwd);
  const { featureId } = options;

  // ── Banner to stderr ──
  process.stderr.write(
    pc.bold("\nDevflow Requirements Audit\n") +
    pc.dim(`Auditing requirements for feature: ${featureId}\n\n`),
  );

  // ── Load requirements.md ──
  const featureDir = path.join(rootPath, "_devflow", "features", featureId);
  const reqPath = path.join(featureDir, "requirements.md");

  let content: string;
  try {
    content = await fs.readFile(reqPath, "utf-8");
  } catch {
    const errorResult: RequirementsAuditResult = {
      score: 0,
      maxScore: 100,
      issues: [
        {
          category: "coverage",
          severity: "error",
          description: `requirements.md not found at ${path.relative(rootPath, reqPath)}`,
          suggestion: "Create a requirements.md file in the feature workspace first.",
        },
      ],
      summary: {
        clarity: { score: 0, max: 30 },
        coverage: { score: 0, max: 40 },
        testability: { score: 0, max: 30 },
      },
      featureId,
    };

    process.stderr.write(pc.red("✖ ") + pc.bold("File not found\n"));
    process.stderr.write(pc.dim(`  Expected at: ${path.relative(rootPath, reqPath)}\n\n`));

    console.log(JSON.stringify(errorResult, null, 2));
    return;
  }

  const lines = content.split("\n");

  // ── Run checks ──
  process.stderr.write(pc.dim("Checking clarity...\n"));
  const clarityResult = checkClarity(content, lines);

  process.stderr.write(pc.dim("Checking coverage...\n"));
  const coverageResult = checkCoverage(content, lines);

  process.stderr.write(pc.dim("Checking testability...\n"));
  const testabilityResult = checkTestability(content, lines);

  const allIssues = [
    ...clarityResult.issues,
    ...coverageResult.issues,
    ...testabilityResult.issues,
  ];

  const totalScore = clarityResult.score + coverageResult.score + testabilityResult.score;
  const totalMax = clarityResult.max + coverageResult.max + testabilityResult.max;

  const result: RequirementsAuditResult = {
    score: totalScore,
    maxScore: totalMax,
    issues: allIssues,
    summary: {
      clarity: { score: clarityResult.score, max: clarityResult.max },
      coverage: { score: coverageResult.score, max: coverageResult.max },
      testability: { score: testabilityResult.score, max: testabilityResult.max },
    },
    featureId,
  };

  // ── Print summary to stderr ──
  const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
  const scoreColor = pct >= 80 ? pc.green : pct >= 50 ? pc.yellow : pc.red;
  process.stderr.write(
    pc.bold("\nScore: ") + scoreColor(`${pct}%`) +
    pc.dim(` (${totalScore}/${totalMax})\n`),
  );
  process.stderr.write(
    pc.dim(`  Clarity: ${clarityResult.score}/${clarityResult.max}`) +
    pc.dim(` · Coverage: ${coverageResult.score}/${coverageResult.max}`) +
    pc.dim(` · Testability: ${testabilityResult.score}/${testabilityResult.max}\n`),
  );

  if (allIssues.length > 0) {
    process.stderr.write(pc.bold(`\nIssues (${allIssues.length}):\n`));
    for (const issue of allIssues) {
      const icon = issue.severity === "error" ? pc.red("✖") : issue.severity === "warning" ? pc.yellow("◆") : pc.blue("◇");
      process.stderr.write(`  ${icon} [${issue.category}] ${issue.description}\n`);
      process.stderr.write(`    ${pc.dim("→ " + issue.suggestion)}\n`);
    }
  } else {
    process.stderr.write(pc.green("\n  No issues found — great!\n"));
  }

  process.stderr.write("\n");

  // ── Pipe-safe JSON to stdout ──
  console.log(JSON.stringify(result, null, 2));
}
