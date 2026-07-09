/** DoD Check 02: Design documentado (roadmap.md). */
import type { DoDCheckDecl } from "../types.js";
import { safeReadFile } from "../../utils/fs.js";
import path from "node:path";
import { validateRoadmap, validateRoadmapVariant } from "../../validators/structural.js";
import { detectProjectType } from "../../detection/project-type.js";

export const check02Roadmap: DoDCheckDecl = {
  id: "02",
  name: "Design documentado (roadmap.md)",
  category: "artifact",
  requiredInModes: ["local", "experimental", "strict", "release"],
  inputs: ["roadmap.md"],
  outputs: [],
  timeoutMs: 5_000,
  blockingDefault: true,
  remediationTemplate:
    "Crie roadmap.md com as seções obrigatórias (5 para greenfield, 13 para brownfield).",
  evidenceSchema: "roadmap.md structural validation",

  async run(ctx) {
    const rp = path.join(ctx.featureDir, "roadmap.md");
    const content = await safeReadFile(rp);
    if (!content || content.trim().length === 0) {
      return {
        checkId: "02", name: this.name, category: "artifact",
        passed: false, detail: "roadmap.md não encontrado ou vazio",
        blocking: true, remediation: this.remediationTemplate, evidence: [], durationMs: 0,
      };
    }
    const projectType = await detectProjectType(ctx.rootPath);
    const variant = projectType === "greenfield" ? "greenfield" : "brownfield";
    const v = variant === "greenfield"
      ? validateRoadmapVariant(content, "greenfield")
      : validateRoadmap(content);
    return {
      checkId: "02", name: this.name, category: "artifact",
      passed: v.valid,
      detail: v.valid ? `Todas as seções presentes (template ${variant})` : `Seções faltando: ${v.missingSections.join(", ")}`,
      blocking: true, remediation: this.remediationTemplate, evidence: [], durationMs: 0,
    };
  },
};
