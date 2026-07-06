import { logger } from "../utils/logger.js";

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

  return {
    valid: errors.length === 0,
    errors,
    warnings,
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
