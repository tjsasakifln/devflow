/**
 * DoD Check 01: Requirements Complete
 * Category: artifact
 * Verifies requirements.md exists with all mandatory sections.
 * Uses variant-aware validation (greenfield vs brownfield).
 */

import type { DoDCheckDecl } from "../types.js";
import { safeReadFile } from "../../utils/fs.js";
import path from "node:path";
import { validateRequirements, validateRequirementsVariant } from "../../validators/structural.js";
import { detectProjectType } from "../../detection/project-type.js";

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
    "Preencha requirements.md com todas as seções obrigatórias (10 para greenfield, 15 para brownfield).",
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
    const projectType = await detectProjectType(ctx.rootPath);
    const variant = projectType === "greenfield" ? "greenfield" : "brownfield";
    const validation = variant === "greenfield"
      ? validateRequirementsVariant(content, "greenfield")
      : validateRequirements(content);
    return {
      checkId: "01",
      name: "Requirements claros e completos",
      category: "artifact",
      passed: validation.valid,
      detail: validation.valid
        ? `Todas as seções obrigatórias presentes (template ${variant})`
        : `Seções faltando: ${validation.missingSections.join(", ")}${validation.emptySections.length > 0 ? `. Seções vazias: ${validation.emptySections.join(", ")}` : ""}`,
      blocking: true,
      remediation: this.remediationTemplate,
      evidence: [],
      durationMs: 0,
    };
  },
};
