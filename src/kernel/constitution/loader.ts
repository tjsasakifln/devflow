import path from "node:path";
import { safeReadFile } from "../utils/fs.js";
import type { ConstitutionDocument, ConstitutionRule } from "../types/constitution.js";
import { DEFAULT_CONSTITUTION } from "./defaults.js";

export async function loadConstitution(
  rootPath: string
): Promise<ConstitutionDocument> {
  const constitutionPath = path.join(rootPath, ".devflow", "constitution.md");

  const raw = await safeReadFile(constitutionPath);
  if (!raw) {
    return { ...DEFAULT_CONSTITUTION };
  }

  return parseConstitution(raw);
}

export function parseConstitution(markdown: string): ConstitutionDocument {
  const doc: ConstitutionDocument = {
    version: "1.0.0",
    projectName: "unknown",
    ratified: new Date().toISOString(),
    rules: [],
  };

  // Extract version
  const versionMatch = markdown.match(/Version:\s*(\S+)/i);
  if (versionMatch && versionMatch[1]) {
    doc.version = versionMatch[1];
  }

  // Extract project name
  const projectMatch = markdown.match(/Project:\s*(\S+)/i);
  if (projectMatch && projectMatch[1]) {
    doc.projectName = projectMatch[1];
  }

  // Extract ratified date
  const ratifiedMatch = markdown.match(/Ratified:\s*(.+)/i);
  if (ratifiedMatch && ratifiedMatch[1]) {
    doc.ratified = ratifiedMatch[1].trim();
  }

  // Parse rule sections
  const rulePattern = /###\s+(C\d+)\s*[-–]\s*(.+?)(?=\n###|\n##|\n---|\n*$)/gs;
  let match;
  while ((match = rulePattern.exec(markdown)) !== null) {
    const id = match[1];
    const body = match[2];
    if (id && body) {
      const rule = parseRuleSection(id, body);
      if (rule) {
        doc.rules.push(rule);
      }
    }
  }

  return doc;
}

function parseRuleSection(id: string, body: string): ConstitutionRule | null {
  const lines = body.trim().split("\n");
  const description = lines[0]?.replace(/^\*\*Description:\*\*\s*/, "").trim() || id;

  // Extract metadata fields from body
  const extractField = (name: string): string | undefined => {
    const match = body.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)`, "i"));
    return match?.[1]?.trim();
  };

  let category: ConstitutionRule["category"] = "quality";
  const categoryField = extractField("Category");
  if (categoryField) {
    const cat = categoryField.toLowerCase().trim();
    if (["structure", "architecture", "quality", "process", "security", "domain", "oo-design"].includes(cat)) {
      category = cat as ConstitutionRule["category"];
    }
  } else if (body.includes("domain") || body.includes("encapsulad") || body.includes("serviço")) {
    category = "structure";
  } else if (
    body.includes("interface") ||
    body.includes("adapter") ||
    body.includes("repository") ||
    body.includes("camada") ||
    body.includes("dependência")
  ) {
    category = "architecture";
  } else if (body.includes("TODO") || body.includes("FIXME")) {
    category = "process";
  }

  // Extract severity
  let severity: ConstitutionRule["severity"] = "blocking";
  const severityField = extractField("Severity");
  if (severityField) {
    if (severityField.includes("critical") || severityField.includes("crítica") || severityField.includes("🔴") && severityField.includes("critical")) {
      severity = "critical";
    } else if (severityField.includes("advisory") || severityField.includes("advertência") || severityField.includes("🟡")) {
      severity = "advisory";
    } else {
      severity = "blocking";
    }
  }

  // Extract approval condition
  let approvalCondition: ConstitutionRule["approvalCondition"] = "auto";
  const approvalField = extractField("Approval Condition");
  if (approvalField) {
    if (approvalField.includes("human-review") || approvalField.includes("human")) {
      approvalCondition = "human-review";
    } else if (approvalField.includes("deferred")) {
      approvalCondition = "deferred";
    }
  }

  // Extract human review required
  let humanReviewRequired = false;
  const humanReviewField = extractField("Human Review Required");
  if (humanReviewField) {
    humanReviewRequired = humanReviewField.toLowerCase() === "true";
  }

  // Extract refusal message
  const refusalMessage = extractField("Refusal Message");

  // Determine if blocking based on severity
  const blocking = severity !== "advisory";

  // Extract verification command info
  let verification: ConstitutionRule["verification"] = {
    tool: "manual",
    command: "N/A",
    expectedOutput: "pass",
    failMessage: `Rule ${id} requires manual verification.`,
  };

  if (body.includes("dependency-cruiser")) {
    verification = {
      tool: "dependency-cruiser",
      command: "npx dependency-cruiser --config .devflow/dependency-cruiser.constitution.js src/",
      expectedOutput: "zero" as const,
      failMessage: extractField("Refusal Message") || `Rule ${id}: Forbidden dependencies detected.`,
    };
  } else if (body.includes("madge")) {
    verification = {
      tool: "madge",
      command: "npx madge --circular --extensions ts src/",
      expectedOutput: "zero" as const,
      failMessage: extractField("Refusal Message") || `Rule ${id}: Circular imports detected.`,
    };
  } else if (body.includes("jscpd")) {
    verification = {
      tool: "jscpd",
      command: "npx jscpd src/ --min-lines 5 --min-tokens 50",
      expectedOutput: "zero" as const,
      failMessage: extractField("Refusal Message") || `Rule ${id}: Code duplication detected.`,
    };
  } else if (body.includes("eslint") || body.includes("lint")) {
    verification = {
      tool: "eslint",
      command: "npx eslint src/ --config .devflow/eslintrc.constitution.json",
      expectedOutput: "pass" as const,
      failMessage: extractField("Refusal Message") || `Rule ${id}: Lint violations found.`,
    };
  } else if (body.includes("cobertura") || body.includes("coverage") || body.includes("80%")) {
    verification = {
      tool: "vitest",
      command: "npx vitest run --coverage",
      expectedOutput: "threshold" as const,
      threshold: 80,
      failMessage: extractField("Refusal Message") || `Rule ${id}: Test coverage below minimum threshold.`,
    };
  } else if (body.includes("grep")) {
    verification = {
      tool: "grep",
      command: "grep -r 'TODO\\|FIXME' src/ --include='*.ts' || true",
      expectedOutput: "zero" as const,
      failMessage: extractField("Refusal Message") || `Rule ${id}: Unresolved TODO/FIXME found.`,
    };
  }

  return {
    id,
    description,
    category,
    verification,
    blocking,
    severity,
    approvalCondition,
    refusalMessage,
    humanReviewRequired,
  };
}

export function getRuleById(
  doc: ConstitutionDocument,
  id: string
): ConstitutionRule | undefined {
  return doc.rules.find((r) => r.id === id);
}

export function getBlockingRules(doc: ConstitutionDocument): ConstitutionRule[] {
  return doc.rules.filter((r) => r.blocking);
}
