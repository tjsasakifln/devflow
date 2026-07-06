/**
 * DoD Check 01: Requirements Complete
 * Category: artifact
 * Verifies requirements.md exists with all mandatory sections.
 */

import type { DoDCheckDecl } from "../types.js";
import { safeReadFile } from "../../utils/fs.js";
import path from "node:path";
import { validateRequirements } from "../../validators/structural.js";

export const check01Requirements: DoDCheckDecl = {
  id: "01",
  name: "Requirements claros e completos",
  category: "artifact",
  requiredInModes: ["local", "experimental", "strict", "release"],
  inputs: ["requirements.md"],
  outputs: [],
  timeoutMs: 5_000,
  blockingDefault: true,
  remediationTemplate:
    "Preencha requirements.md com todas as seções obrigatórias: Descricao Funcional, Comportamento Esperado, Criterios de Aceitacao, etc.",
  evidenceSchema: "requirements.md structural validation",

  async run(ctx) {
    const reqPath = path.join(ctx.featureDir, "requirements.md");
    const content = await safeReadFile(reqPath);
    if (!content || content.trim().length === 0) {
      return {
        checkId: "01",
        name: "Requirements claros e completos",
        category: "artifact",
        passed: false,
        detail: "requirements.md não encontrado ou vazio",
        blocking: true,
        remediation: "Crie requirements.md com todas as seções obrigatórias.",
        evidence: [],
        durationMs: 0,
      };
    }
    const validation = validateRequirements(content);
    return {
      checkId: "01",
      name: "Requirements claros e completos",
      category: "artifact",
      passed: validation.valid,
      detail: validation.valid
        ? "Todas as seções obrigatórias presentes"
        : `Seções faltando: ${validation.missingSections.join(", ")}${validation.emptySections.length > 0 ? `. Seções vazias: ${validation.emptySections.join(", ")}` : ""}`,
      blocking: true,
      remediation: this.remediationTemplate,
      evidence: [],
      durationMs: 0,
    };
  },
};
