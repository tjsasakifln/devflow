import path from "node:path";
import fs from "node:fs/promises";
import pc from "picocolors";

// ── Types ──

export interface DesignReviewIssue {
  category: "over-engineering" | "missing-layer" | "inconsistency" | "recommendation";
  severity: "error" | "warning" | "info";
  description: string;
  suggestion: string;
}

export interface DesignReviewResult {
  score: number;
  maxScore: number;
  issues: DesignReviewIssue[];
  summary: {
    overEngineering: { score: number; max: number };
    missingLayers: { score: number; max: number };
    consistency: { score: number; max: number };
  };
  featureId: string;
}

// ── YAGNI / Over-engineering detection patterns ──

const OVER_ENGINEERING_PATTERNS: Array<{
  pattern: RegExp;
  description: string;
  suggestion: string;
  severity: "error" | "warning" | "info";
}> = [
  {
    pattern: /\b(microservices?|micro-services?)\b/i,
    description: 'Mentions "microservices" — consider if a simpler modular monolith would suffice',
    suggestion: 'Default to modular monolith. Only split into services when there is a proven scaling or team boundary need.',
    severity: "warning",
  },
  {
    pattern: /\b(event[-\s]?sourcing|Event\s*Store|CQRS)\b/i,
    description: "Mentions event sourcing or CQRS — complex patterns that add significant operational cost",
    suggestion: "Only adopt event sourcing/CQRS if you have verified event-driven requirements. Most CRUD apps don't need it.",
    severity: "warning",
  },
  {
    pattern: /\b(kubernetes|k8s)\b/i,
    description: "Mentions Kubernetes — significant operational overhead for small-medium projects",
    suggestion: "Consider simpler deployment: Docker Compose, Railway, or platform-as-a-service before committing to K8s.",
    severity: "warning",
  },
  {
    pattern: /\b(Hexagonal|Clean\s*Architecture|Onion)\b/i,
    description: "Mentions a formal architecture pattern by name — verify it's justified",
    suggestion: "Architecture patterns should solve real coupling problems, not be applied preemptively. Verify each layer justifies its existence.",
    severity: "info",
  },
  {
    pattern: /\b(Redis|cache|Cache)\b.*\b(everything|all|global)\b/i,
    description: "Caching strategy may be overly broad",
    suggestion: "Cache only what profiling shows is slow. Preemptive caching adds complexity without measured benefit.",
    severity: "info",
  },
  {
    pattern: /\b(WebSocket|websocket)\b/i,
    description: "Mentions WebSocket — consider if Server-Sent Events (SSE) or polling is sufficient",
    suggestion: "WebSockets add bidirectional complexity. Use SSE for server-to-client streaming, polling for infrequent updates.",
    severity: "info",
  },
  {
    pattern: /\b(graphql|GraphQL|GQL)\b/i,
    description: "Mentions GraphQL — consider if REST is sufficient",
    suggestion: "GraphQL adds resolver complexity, caching challenges, and query cost analysis. Use REST by default; adopt GraphQL only for complex client data requirements.",
    severity: "info",
  },
  {
    pattern: /\b(Saga|Two[-\s]?Phase[-\s]?Commit|distributed\s+transaction)\b/i,
    description: "Mentions distributed transaction patterns — these add significant complexity",
    suggestion: "Prefer eventual consistency and design that avoids distributed transactions. Sagas are a last resort.",
    severity: "warning",
  },
];

// ── Missing layer patterns ──

const MISSING_LAYER_PATTERNS: Array<{
  check: (content: string, lines: string[]) => DesignReviewIssue | null;
}> = [
  {
    check: (content: string, _lines: string[]) => {
      if (!/\berror\b/i.test(content) && !/\bexception\b/i.test(content) && !/\bfailure\b/i.test(content)) {
        return {
          category: "missing-layer",
          severity: "warning",
          description: "No error handling strategy mentioned",
          suggestion: "Document error handling approach: error types, recovery strategies, observability.",
        };
      }
      return null;
    },
  },
  {
    check: (content: string, _lines: string[]) => {
      if (!/\btest\b/i.test(content) && !/\btesting\b/i.test(content)) {
        return {
          category: "missing-layer",
          severity: "warning",
          description: "No testing strategy mentioned",
          suggestion: "Document testing approach: unit, integration, and E2E test strategy.",
        };
      }
      return null;
    },
  },
  {
    check: (content: string, _lines: string[]) => {
      if (!/\b(security|auth|permission|RBAC|authentication|authorization)\b/i.test(content)) {
        return {
          category: "missing-layer",
          severity: "warning",
          description: "No security or authentication considerations mentioned",
          suggestion: "Document authentication, authorization, and data protection approach.",
        };
      }
      return null;
    },
  },
  {
    check: (content: string, _lines: string[]) => {
      if (
        !/\b(log|logging|monitor|observability|telemetry|tracing)\b/i.test(content)
      ) {
        return {
          category: "missing-layer",
          severity: "warning",
          description: "No logging or monitoring strategy mentioned",
          suggestion: "Document logging, metrics, and monitoring approach.",
        };
      }
      return null;
    },
  },
  {
    check: (content: string, _lines: string[]) => {
      if (!/\b(database|DB|persistence|storage|schema|model)\b/i.test(content)) {
        return {
          category: "missing-layer",
          severity: "warning",
          description: "No data layer or persistence strategy mentioned",
          suggestion: "Document data model, database choice, migration strategy, and storage approach.",
        };
      }
      return null;
    },
  },
  {
    check: (content: string, _lines: string[]) => {
      if (!/\b(API|endpoint|interface|contract|REST|GraphQL|gRPC)\b/i.test(content)) {
        return {
          category: "missing-layer",
          severity: "info",
          description: "No API or interface contract mentioned",
          suggestion: "Document API contracts, versioning strategy, and integration patterns.",
        };
      }
      return null;
    },
  },
  {
    check: (content: string, _lines: string[]) => {
      if (!/\b(config|environment|env|secret)\b/i.test(content)) {
        return {
          category: "missing-layer",
          severity: "info",
          description: "No configuration management mentioned",
          suggestion: "Document configuration approach: env vars, secret management, environment separation.",
        };
      }
      return null;
    },
  },
];

// ── Consistency checks ──

const CONSISTENCY_CHECKS: Array<{
  name: string;
  check: (content: string, lines: string[]) => DesignReviewIssue | null;
}> = [
  {
    name: "version consistency",
    check: (content: string, _lines: string[]) => {
      const versions = content.match(/\d+\.\d+\.\d+/g);
      if (versions && new Set(versions).size > 1 && versions.length > 1) {
        // Multiple different versions — possible inconsistency
        const uniqueVersions = [...new Set(versions)];
        if (uniqueVersions.length > 1) {
          return {
            category: "inconsistency",
            severity: "info",
            description: `Multiple version references found (${uniqueVersions.join(", ")}) — verify they are consistent`,
            suggestion: "Ensure all version references are consistent and match the project's actual dependencies.",
          };
        }
      }
      return null;
    },
  },
  {
    name: "technology references",
    check: (content: string, _lines: string[]) => {
      // Check if the document references specific technologies but lacks justification
      const techRefs = content.match(/\b(React|Node|PostgreSQL|MongoDB|Redis|Docker|AWS|GCP|Azure)\b/g);
      if (techRefs && techRefs.length > 5) {
        return {
          category: "inconsistency",
          severity: "info",
          description: `Many technology references (${techRefs.length}) — verify decisions are justified, not assumed`,
          suggestion: "Each technology choice should include a brief rationale sentence.",
        };
      }
      return null;
    },
  },
];

// ── Main command ──

export interface DesignReviewOptions {
  featureId: string;
}

export async function designReviewCommand(
  cwd: string,
  options: DesignReviewOptions,
): Promise<void> {
  const rootPath = path.resolve(cwd);
  const { featureId } = options;

  // ── Banner to stderr ──
  process.stderr.write(
    pc.bold("\nDevflow Design Review\n") +
    pc.dim(`Reviewing design for feature: ${featureId}\n\n`),
  );

  // ── Load roadmap.md ──
  const featureDir = path.join(rootPath, "_devflow", "features", featureId);
  const roadmapPath = path.join(featureDir, "roadmap.md");

  let content: string;
  try {
    content = await fs.readFile(roadmapPath, "utf-8");
  } catch {
    const errorResult: DesignReviewResult = {
      score: 0,
      maxScore: 100,
      issues: [
        {
          category: "missing-layer",
          severity: "error",
          description: `roadmap.md not found at ${path.relative(rootPath, roadmapPath)}`,
          suggestion: "Create a roadmap.md file in the feature workspace first. Run `devflow feature new` to scaffold.",
        },
      ],
      summary: {
        overEngineering: { score: 0, max: 40 },
        missingLayers: { score: 0, max: 40 },
        consistency: { score: 0, max: 20 },
      },
      featureId,
    };

    process.stderr.write(pc.red("✖ ") + pc.bold("File not found\n"));
    process.stderr.write(pc.dim(`  Expected at: ${path.relative(rootPath, roadmapPath)}\n\n`));

    console.log(JSON.stringify(errorResult, null, 2));
    return;
  }

  const lines = content.split("\n");

  // ── Run checks ──
  process.stderr.write(pc.dim("Checking for over-engineering patterns...\n"));
  const overEngineeringIssues: DesignReviewIssue[] = [];
  for (const pattern of OVER_ENGINEERING_PATTERNS) {
    const matches = content.match(pattern.pattern);
    if (matches) {
      overEngineeringIssues.push({
        category: "over-engineering",
        severity: pattern.severity,
        description: pattern.description + ` (found: "${matches[0]}")`,
        suggestion: pattern.suggestion,
      });
    }
  }

  const overEngineeringScore = Math.max(0, 40 - overEngineeringIssues.length * 8);
  const overEngineeringMax = 40;

  process.stderr.write(pc.dim("Checking for missing architecture layers...\n"));
  const missingLayerIssues: DesignReviewIssue[] = [];
  for (const check of MISSING_LAYER_PATTERNS) {
    const issue = check.check(content, lines);
    if (issue) {
      missingLayerIssues.push(issue);
    }
  }

  const missingLayerScore = Math.max(0, 40 - missingLayerIssues.length * 6);
  const missingLayerMax = 40;

  process.stderr.write(pc.dim("Checking consistency...\n"));
  const consistencyIssues: DesignReviewIssue[] = [];
  for (const check of CONSISTENCY_CHECKS) {
    const issue = check.check(content, lines);
    if (issue) {
      consistencyIssues.push(issue);
    }
  }

  const consistencyScore = Math.max(0, 20 - consistencyIssues.length * 5);
  const consistencyMax = 20;

  const allIssues = [
    ...overEngineeringIssues,
    ...missingLayerIssues,
    ...consistencyIssues,
  ];

  const totalScore = overEngineeringScore + missingLayerScore + consistencyScore;
  const totalMax = overEngineeringMax + missingLayerMax + consistencyMax;

  const result: DesignReviewResult = {
    score: totalScore,
    maxScore: totalMax,
    issues: allIssues,
    summary: {
      overEngineering: { score: overEngineeringScore, max: overEngineeringMax },
      missingLayers: { score: missingLayerScore, max: missingLayerMax },
      consistency: { score: consistencyScore, max: consistencyMax },
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
    pc.dim(`  Over-engineering: ${overEngineeringScore}/${overEngineeringMax}`) +
    pc.dim(` · Missing Layers: ${missingLayerScore}/${missingLayerMax}`) +
    pc.dim(` · Consistency: ${consistencyScore}/${consistencyMax}\n`),
  );

  if (allIssues.length > 0) {
    process.stderr.write(pc.bold(`\nIssues (${allIssues.length}):\n`));
    for (const issue of allIssues) {
      const icon = issue.severity === "error" ? pc.red("✖") : issue.severity === "warning" ? pc.yellow("◆") : pc.blue("◇");
      process.stderr.write(`  ${icon} [${issue.category}] ${issue.description}\n`);
      process.stderr.write(`    ${pc.dim("→ " + issue.suggestion)}\n`);
    }
  } else {
    process.stderr.write(pc.green("\n  No issues found — good design!\n"));
  }

  process.stderr.write("\n");

  // ── Pipe-safe JSON to stdout ──
  console.log(JSON.stringify(result, null, 2));
}
