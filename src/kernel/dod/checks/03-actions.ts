/** DoD Check 03: Actions com evidências (todas [X]). */
import type { DoDCheckDecl } from "../types.js";
import { safeReadFile } from "../../utils/fs.js";
import path from "node:path";

export const check03Actions: DoDCheckDecl = {
  id: "03",
  name: "Actions com evidências (todas [X])",
  category: "artifact",
  requiredInModes: ["local", "experimental", "strict", "release"],
  inputs: ["actions.md"],
  outputs: [],
  timeoutMs: 5_000,
  blockingDefault: true,
  remediationTemplate:
    "Complete todas as ações em actions.md. Cada ação deve estar marcada como [X] com evidência registrada.",
  evidenceSchema: "actions.md task completion",

  async run(ctx) {
    const ap = path.join(ctx.featureDir, "actions.md");
    const content = await safeReadFile(ap);
    if (!content || content.trim().length === 0) {
      return {
        checkId: "03", name: this.name, category: "artifact",
        passed: false, detail: "actions.md não encontrado ou vazio",
        blocking: true, remediation: this.remediationTemplate, evidence: [], durationMs: 0,
      };
    }
    const totalActions = (content.match(/^-\s*\[.\]\s*T\d+/gm) || []).length;
    const completedActions = (content.match(/^-\s*\[[xX]\s*\]\s*T\d+/gm) || []).length;
    const ratio = totalActions > 0 ? completedActions / totalActions : 0;
    return {
      checkId: "03", name: this.name, category: "artifact",
      passed: ratio >= 1.0,
      detail: `${completedActions}/${totalActions} ações concluídas (${Math.round(ratio * 100)}%)`,
      blocking: true, remediation: this.remediationTemplate, evidence: [], durationMs: 0,
    };
  },
};
