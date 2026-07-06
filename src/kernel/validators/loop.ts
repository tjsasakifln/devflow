import { logger } from "../utils/logger.js";
import type { GuardCheck } from "../types/guards.js";

export interface LoopSpec {
  goal: string;
  input: string;
  output: string;
  action: string;
  stopCondition: string;
  maxIterations: number;
  externalCheck: string;
  evidenceLog: string;
  humanDecision: boolean;
  retryOnFailure?: boolean;
  rateLimit?: number;
}

export interface LoopValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateLoopSpec(spec: LoopSpec): LoopValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!spec.goal || spec.goal.trim().length === 0) {
    errors.push("Loop must have an explicit goal.");
  }

  if (!spec.action || spec.action.trim().length === 0) {
    errors.push("Loop must have a named action.");
  }

  if (!spec.stopCondition || spec.stopCondition.trim().length === 0) {
    errors.push("Loop must have an explicit stop condition.");
  }

  if (!spec.maxIterations || spec.maxIterations < 1) {
    errors.push("Loop must specify maxIterations (>= 1).");
  }

  if (spec.maxIterations > 10) {
    warnings.push(
      `maxIterations=${spec.maxIterations} is high. Consider breaking into smaller loops.`
    );
  }

  if (!spec.externalCheck || spec.externalCheck.trim().length === 0) {
    errors.push(
      "Loop must have an externalCheck. 'Parece que funcionou' is not verification. " +
        "Specify a deterministic command (e.g., 'npm test -- --reporter=json', 'npx tsc --noEmit')."
    );
  }

  if (!spec.evidenceLog || spec.evidenceLog.trim().length === 0) {
    errors.push(
      "Loop must have an evidenceLog path for append-only iteration records."
    );
  }

  // Vague loop detection
  if (
    spec.goal &&
    /melhorar\s+(o\s+)?c[oó]digo/i.test(spec.goal) &&
    !spec.externalCheck
  ) {
    errors.push(
      "Rejected: Loop with vague goal without external check. 'Melhorar o código' is not engineering — specify a metric, limit, and proof."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Scan actions.md for loop patterns (YAML blocks with loop: key).
 */
export function scanActionsForLoops(actionsMd: string): LoopSpec[] {
  const loops: LoopSpec[] = [];

  // Match YAML-style loop blocks in markdown
  const loopPattern = /```ya?ml\s*\n\s*loop:\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = loopPattern.exec(actionsMd)) !== null) {
    const body = match[1] || "";
    const spec: Partial<LoopSpec> = {};

    const extractField = (name: string): string | undefined => {
      const m = body.match(new RegExp(`${name}:\\s*(.+)`, "im"));
      return m?.[1]?.trim();
    };

    spec.goal = extractField("goal") || "";
    spec.input = extractField("input") || "";
    spec.output = extractField("output") || "";
    spec.action = extractField("action") || "";
    spec.stopCondition = extractField("stopCondition") || "";
    spec.maxIterations = parseInt(extractField("maxIterations") || "0", 10);
    spec.externalCheck = extractField("externalCheck") || "";
    spec.evidenceLog = extractField("evidenceLog") || "";
    spec.humanDecision =
      extractField("humanDecision")?.toLowerCase() === "true";

    loops.push(spec as LoopSpec);
  }

  return loops;
}

/**
 * Validate all loops found in the feature's actions.md.
 * Returns a combined validation result.
 */
export function validateLoopsInFeature(
  actionsMd: string
): LoopValidationResult {
  const loops = scanActionsForLoops(actionsMd);
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  if (loops.length === 0) {
    return { valid: true, errors: [], warnings: [] };
  }

  for (let i = 0; i < loops.length; i++) {
    const loop = loops[i];
    if (!loop) continue;
    const result = validateLoopSpec(loop);
    if (!result.valid) {
      allErrors.push(
        `Loop #${i + 1} (${loop.action}): ${result.errors.join("; ")}`
      );
    }
    allWarnings.push(
      ...result.warnings.map((w) => `Loop #${i + 1}: ${w}`)
    );
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Create a pipeline GuardCheck for loop validation.
 * Returns null if no loops found (not an error — loops are optional).
 */
export function integrateIntoPipelineCheck(actionsMd: string): GuardCheck | null {
  const loops = scanActionsForLoops(actionsMd);
  if (loops.length === 0) return null;

  const result = validateLoopsInFeature(actionsMd);

  return {
    checkId: "loop-validation",
    description: `Validated ${loops.length} agentic loop(s) in actions.md`,
    passed: result.valid,
    reason: result.valid
      ? `All ${loops.length} loop(s) have valid specs with external checks`
      : result.errors.join("; "),
    blocking: true,
    gateNumber: 14,
    remediation: "Fix loop specs: add goal, stopCondition, maxIterations, and externalCheck to each loop block in actions.md",
  };
}

export function formatLoopRefusal(
  validation: LoopValidationResult
): string {
  const lines = [
    "## ⛔ Loop Recusado — Requisitos Não Atendidos",
    "",
    "Devflow recusa loops sem verificabilidade externa. IA sem check externo " +
      "não é engenharia — é prompt girando até parecer convincente.",
    "",
    "### Estrutura Obrigatória de Loop Agentic",
    "",
    "```yaml",
    "loop:",
    "  goal: 'Implementar X'           # objetivo explícito",
    "  input: 'contrato.md'            # entrada clara",
    "  output: 'src/X.ts'              # saída esperada",
    "  action: 'T001 — Implementar X'  # ação nomeada",
    "  stopCondition: '3 testes OK'    # condição de parada",
    "  maxIterations: 5                # orçamento máximo",
    "  externalCheck: 'npm test'       # verificação determinística",
    "  evidenceLog: 'log.jsonl'        # evidência por iteração",
    "  humanDecision: false            # ação irreversível?",
    "```",
    "",
    "### Erros Encontrados",
    ...validation.errors.map((e, i) => `${i + 1}. **Erro:** ${e}`),
    "",
  ];

  if (validation.warnings.length > 0) {
    lines.push("### Avisos");
    lines.push(
      ...validation.warnings.map((w) => `- ⚠️ ${w}`)
    );
  }

  return lines.join("\n");
}

export function logLoopIteration(
  _evidenceLogPath: string,
  iteration: number,
  action: string,
  checkResult: string,
  evidence: string
): string {
  const entry = {
    ts: new Date().toISOString(),
    iteration,
    action,
    checkResult,
    evidence: evidence.slice(0, 1000),
  };

  logger.info(`[LOOP] Iteration ${iteration}: ${checkResult}`);
  return JSON.stringify(entry);
}
