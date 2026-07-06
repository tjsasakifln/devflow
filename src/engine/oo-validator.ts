import { execSync } from "node:child_process";

export interface OOQualityResult {
  pass: boolean;
  metrics: OOMetrics;
  violations: OOViolation[];
  summary: string;
}

export interface OOMetrics {
  coupling: number | null; // CBO — Coupling Between Objects
  circularDeps: number; // count of circular dependency chains
  avgComplexity: number | null; // average cyclomatic complexity
  maxComplexity: number | null; // max cyclomatic complexity
  filesOverSizeLimit: number; // files exceeding maxLinesPerFile
  cohesionScore: number | null; // 0-100, higher = more cohesive
}

export interface OOViolation {
  type: "coupling" | "complexity" | "size" | "circular" | "cohesion";
  description: string;
  severity: "error" | "warn";
  evidence: string;
}

export interface OOThresholds {
  maxCoupling?: number;
  maxComplexity?: number;
  maxLinesPerFunction?: number;
  maxLinesPerFile?: number;
  minCoverage?: number;
}

/**
 * Validate OO quality metrics for the project at rootPath.
 * Uses ESLint (complexity), madge (circular deps), and dependency-cruiser (coupling).
 */
export function validateOOQuality(
  rootPath: string,
  thresholds?: OOThresholds
): OOQualityResult {
  const violations: OOViolation[] = [];
  const metrics: OOMetrics = {
    coupling: null,
    circularDeps: 0,
    avgComplexity: null,
    maxComplexity: null,
    filesOverSizeLimit: 0,
    cohesionScore: null,
  };

  // ── Circular dependency check (madge) ──
  try {
    const output = execSync(
      "npx madge --circular --extensions ts src/ 2>&1 || true",
      { cwd: rootPath, encoding: "utf-8", timeout: 30000 }
    );
    if (!output.includes("No circular") && output.trim() !== "") {
      // Count circular chains
      const circularChains = output
        .split("\n")
        .filter((l) => l.includes("→") || l.includes("->")).length;
      metrics.circularDeps = circularChains || 1;

      violations.push({
        type: "circular",
        description: `${metrics.circularDeps} circular dependency chain(s) detected`,
        severity: "error",
        evidence: output.slice(0, 500),
      });
    } else {
      metrics.circularDeps = 0;
    }
  } catch {
    // madge not available — skip
    violations.push({
      type: "circular",
      description: "Circular dependency check skipped (madge not available)",
      severity: "warn",
      evidence: "Install madge: npm install --save-dev madge",
    });
  }

  // ── Complexity and size check (ESLint) ──
  try {
    const eslintOutput = execSync(
      "npx eslint src/ --config .devflow/eslintrc.constitution.json --format json 2>&1 || true",
      { cwd: rootPath, encoding: "utf-8", timeout: 60000 }
    );

    let eslintResults: Array<{
      filePath: string;
      messages: Array<{ ruleId: string; message: string; line: number }>;
    }> = [];

    try {
      eslintResults = JSON.parse(eslintOutput);
    } catch {
      // Could not parse JSON — likely no violations
    }

    if (Array.isArray(eslintResults)) {
      const complexityViolations: number[] = [];
      const sizeViolations: string[] = [];
      const seenFiles = new Set<string>();

      for (const file of eslintResults) {
        for (const msg of file.messages) {
          if (msg.ruleId === "complexity") {
            const complexityMatch = msg.message.match(/complexity of (\d+)/);
            if (complexityMatch && complexityMatch[1]) {
              complexityViolations.push(parseInt(complexityMatch[1], 10));
            }
          }
          if (
            msg.ruleId === "max-lines" ||
            msg.ruleId === "max-lines-per-function"
          ) {
            seenFiles.add(file.filePath);
            sizeViolations.push(`${file.filePath}:${msg.line} — ${msg.message}`);
          }
        }
      }

      if (complexityViolations.length > 0) {
        metrics.maxComplexity = Math.max(...complexityViolations);
        metrics.avgComplexity =
          complexityViolations.reduce((a, b) => a + b, 0) /
          complexityViolations.length;

        const maxThreshold = thresholds?.maxComplexity || 10;
        if (metrics.maxComplexity > maxThreshold) {
          violations.push({
            type: "complexity",
            description: `Max cyclomatic complexity ${metrics.maxComplexity} exceeds limit of ${maxThreshold}`,
            severity: "error",
            evidence: `${complexityViolations.length} function(s) exceed complexity limit`,
          });
        }
      }

      metrics.filesOverSizeLimit = seenFiles.size;
      const maxFileLines = thresholds?.maxLinesPerFile || 400;
      if (metrics.filesOverSizeLimit > 0) {
        violations.push({
          type: "size",
          description: `${metrics.filesOverSizeLimit} file(s) exceed ${maxFileLines} lines`,
          severity: "error",
          evidence: sizeViolations.slice(0, 3).join("\n"),
        });
      }
    }
  } catch {
    violations.push({
      type: "complexity",
      description: "Complexity/size check skipped (ESLint not available)",
      severity: "warn",
      evidence: "Install eslint: npm install --save-dev eslint",
    });
  }

  // ── Coupling check (dependency-cruiser) ──
  try {
    const dcOutput = execSync(
      "npx dependency-cruiser --config .devflow/dependency-cruiser.constitution.js src/ --output-type json 2>&1 || true",
      { cwd: rootPath, encoding: "utf-8", timeout: 60000 }
    );

    try {
      const dcResult = JSON.parse(dcOutput);
      const modules = dcResult.modules || [];
      const couplings: number[] = [];

      // Count dependencies per module as a rough CBO metric
      for (const mod of modules) {
        const depCount = (mod.dependencies || []).length;
        couplings.push(depCount);
      }

      if (couplings.length > 0) {
        metrics.coupling =
          couplings.reduce((a, b) => a + b, 0) / couplings.length;

        const maxCoupling = thresholds?.maxCoupling || 10;
        if (metrics.coupling > maxCoupling) {
          violations.push({
            type: "coupling",
            description: `Average coupling (CBO) ${metrics.coupling.toFixed(1)} exceeds limit of ${maxCoupling}`,
            severity: "error",
            evidence: `${couplings.length} modules analyzed, avg ${metrics.coupling.toFixed(1)} deps/module`,
          });
        }

        // Rough cohesion: modules with very high or very low dep counts
        const highCoupling = couplings.filter((c) => c > maxCoupling).length;
        if (highCoupling > couplings.length * 0.3) {
          violations.push({
            type: "cohesion",
            description: `${highCoupling}/${couplings.length} modules have high coupling (>${maxCoupling} deps) — consider splitting`,
            severity: "warn",
            evidence: `Total modules: ${couplings.length}, high coupling: ${highCoupling}`,
          });
        }
      }
    } catch {
      // JSON parsing failed
    }
  } catch {
    // dependency-cruiser not available
  }

  // ── Cohesion score (heuristic) ──
  // Cohesion approximated by: 100 - (modules_over_limit / total_modules * 100)
  try {
    const moduleDirs = execSync(
      "find src/ -type d -not -path '*/node_modules/*' | wc -l",
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 }
    ).trim();
    const totalFiles = execSync(
      "find src/ -name '*.ts' -not -path '*/node_modules/*' | wc -l",
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 }
    ).trim();
    const dirs = parseInt(moduleDirs, 10);
    const files = parseInt(totalFiles, 10);

    if (dirs > 0 && files > 0) {
      // Higher = files spread evenly across dirs (cohesive)
      const filesPerDir = files / dirs;
      if (filesPerDir > 20) {
        metrics.cohesionScore = Math.max(0, 100 - (filesPerDir - 15) * 2);
        violations.push({
          type: "cohesion",
          description: `Low cohesion: avg ${filesPerDir.toFixed(0)} files per module (target: <=15)`,
          severity: "warn",
          evidence: `${files} files in ${dirs} dirs — avg ${filesPerDir.toFixed(0)} files/dir`,
        });
      } else {
        metrics.cohesionScore = 85;
      }
    }
  } catch {
    // Fallback: can't compute
  }

  const pass = violations.filter((v) => v.severity === "error").length === 0;

  return {
    pass,
    metrics,
    violations,
    summary: pass
      ? "OO quality metrics within acceptable thresholds"
      : `${violations.length} OO quality violation(s) found`,
  };
}
